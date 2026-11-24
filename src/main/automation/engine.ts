import type { AutomationSettings, QueueStatus } from '../../shared/automation'
import { INITIAL_QUEUE_STATUS } from '../../shared/automation'
import type { GamePhase } from '../../shared/types'
import type { LcuClient } from '../lcu/client'
import { log } from '../log'

interface ReadyCheck {
  state?: string
  playerResponse?: string
}

interface MatchSearch {
  searchState?: string
  timeInQueue?: number
  estimatedQueueTime?: number
}

interface LobbyInfo {
  canStartActivity?: boolean
  gameConfig?: { isCustom?: boolean; queueId?: number }
}

/** Phases that mean a game was actually in progress (so a return to lobby = "game ended"). */
const GAME_PHASES = new Set(['InProgress', 'WaitingForStats', 'PreEndOfGame', 'EndOfGame', 'Reconnect'])

const RESTART_POLL_MS = 2500
/** Backup poll for ready-checks, in case the socket misses the push event. */
const ACCEPT_POLL_MS = 1500
/** After a rejoin, ignore the long-queue check briefly so we don't bounce in a loop. */
const REJOIN_COOLDOWN_MS = 6000

export interface AutomationEngineOptions {
  getClient(): LcuClient | null
  getSettings(): AutomationSettings
  onStatus(status: QueueStatus): void
}

/**
 * Performs queue-side client automation through the LCU: auto-accept ready-checks, re-queue
 * after a game, restart over-long queues, and pause after a dodge. Every action is one the
 * user could do by hand; nothing runs unless the matching setting is enabled.
 */
export class AutomationEngine {
  private searching = false
  private pauseUntil = 0 // epoch ms; Infinity = indefinite; <=0 = not paused
  private acceptTimer: NodeJS.Timeout | null = null
  private acceptPoll: NodeJS.Timeout | null = null
  private requeueTimer: NodeJS.Timeout | null = null
  private pauseTimer: NodeJS.Timeout | null = null
  private restartPoll: NodeJS.Timeout | null = null
  private cooldownUntil = 0
  private rejoining = false

  constructor(private readonly opts: AutomationEngineOptions) {
    this.syncAcceptPoll()
  }

  private get queue(): AutomationSettings['queue'] {
    return this.opts.getSettings().queue
  }

  private get paused(): boolean {
    return this.pauseUntil === Infinity || (this.pauseUntil > 0 && Date.now() < this.pauseUntil)
  }

  /** Client went away: drop all timers and pause state. */
  reset(): void {
    this.clearTimer('acceptTimer')
    this.clearTimer('requeueTimer')
    this.clearTimer('pauseTimer')
    this.stopRestartPoll()
    this.searching = false
    this.pauseUntil = 0
    this.rejoining = false
    this.emitStatus()
  }

  /** The user changed a setting: cancel anything that is now disabled. */
  onSettingsChanged(): void {
    if (!this.queue.autoAccept.enabled) this.clearTimer('acceptTimer')
    this.syncAcceptPoll()
    if (!this.queue.queueAgain.enabled) this.clearTimer('requeueTimer')
    if (!this.queue.pauseAfterDodge.enabled) this.clearPause()
    this.syncRestartPoll()
  }

  // --- LCU inputs -------------------------------------------------------------------------

  onReadyCheck(data: unknown): void {
    const check = (data ?? {}) as ReadyCheck
    if (!this.queue.autoAccept.enabled) return
    if (check.state === 'InProgress' && check.playerResponse === 'None') {
      if (!this.acceptTimer) {
        log(`[auto] ready check found — accepting in ${this.queue.autoAccept.delaySeconds}s`)
        this.acceptTimer = setTimeout(
          () => void this.accept(),
          this.queue.autoAccept.delaySeconds * 1000
        )
      }
    } else {
      // Resolved, declined, or gone: stop waiting.
      this.clearTimer('acceptTimer')
    }
  }

  onSearchState(data: unknown): void {
    const searching = ((data ?? {}) as { searchState?: string }).searchState === 'Searching'
    if (searching !== this.searching) {
      this.searching = searching
      if (!searching) this.cooldownUntil = 0
      this.emitStatus()
    }
    this.syncRestartPoll()
  }

  onPhase(previous: GamePhase, next: GamePhase): void {
    if (GAME_PHASES.has(previous) && next === 'Lobby') this.scheduleRequeue()
    if (next !== 'ReadyCheck') this.clearTimer('acceptTimer')
  }

  /** A champ select ended in a dodge. */
  onDodge(): void {
    this.clearTimer('requeueTimer')
    if (!this.queue.pauseAfterDodge.enabled) return
    const { seconds } = this.queue.pauseAfterDodge
    this.pauseUntil = seconds === null ? Infinity : Date.now() + seconds * 1000
    this.clearTimer('pauseTimer')
    if (seconds !== null) {
      this.pauseTimer = setTimeout(() => this.clearPause(), seconds * 1000)
    }
    this.syncRestartPoll()
    this.emitStatus()
  }

  // --- actions ----------------------------------------------------------------------------

  private async accept(): Promise<void> {
    this.acceptTimer = null
    const result = await this.call('POST', '/lol-matchmaking/v1/ready-check/accept')
    log(result === null ? '[auto] ready check accept FAILED' : '[auto] accepted ready check')
  }

  private scheduleRequeue(): void {
    if (!this.queue.queueAgain.enabled) return
    this.clearTimer('requeueTimer')
    this.requeueTimer = setTimeout(
      () => void this.requeue(),
      this.queue.queueAgain.delaySeconds * 1000
    )
  }

  private async requeue(): Promise<void> {
    this.requeueTimer = null
    if (this.paused || !this.queue.queueAgain.enabled) return
    const lobby = await this.call<LobbyInfo>('GET', '/lol-lobby/v2/lobby')
    const config = lobby?.gameConfig
    if (!lobby?.canStartActivity || !config || config.isCustom || !config.queueId) return
    await this.call('POST', '/lol-lobby/v2/lobby/matchmaking/search')
    console.log('[auto] re-entered queue after game')
  }

  private syncRestartPoll(): void {
    const wanted = this.searching && this.queue.restartLongQueue.enabled && !this.paused
    if (wanted && !this.restartPoll) {
      this.restartPoll = setInterval(() => void this.checkLongQueue(), RESTART_POLL_MS)
    } else if (!wanted) {
      this.stopRestartPoll()
    }
  }

  private async checkLongQueue(): Promise<void> {
    if (this.rejoining || Date.now() < this.cooldownUntil) return
    const search = await this.call<MatchSearch>('GET', '/lol-matchmaking/v1/search')
    if (!search || search.searchState !== 'Searching') return
    const estimate = search.estimatedQueueTime ?? 0
    const elapsed = search.timeInQueue ?? 0
    if (estimate <= 0 || elapsed <= estimate + this.queue.restartLongQueue.delaySeconds) return

    this.rejoining = true
    try {
      await this.call('DELETE', '/lol-lobby/v2/lobby/matchmaking/search')
      await new Promise((resolve) => setTimeout(resolve, 1500))
      if (!this.paused) await this.call('POST', '/lol-lobby/v2/lobby/matchmaking/search')
      this.cooldownUntil = Date.now() + REJOIN_COOLDOWN_MS
      console.log('[auto] restarted a long queue')
    } finally {
      this.rejoining = false
    }
  }

  // --- helpers ----------------------------------------------------------------------------

  private async call<T>(method: 'GET' | 'POST' | 'DELETE', path: string): Promise<T | null> {
    const client = this.opts.getClient()
    if (!client) return null
    try {
      return await client.request<T>(method, path)
    } catch (error) {
      log(`[auto] ${method} ${path} failed: ${(error as Error).message}`)
      return null
    }
  }

  private clearPause(): void {
    this.clearTimer('pauseTimer')
    if (this.pauseUntil !== 0) {
      this.pauseUntil = 0
      this.syncRestartPoll()
      this.emitStatus()
    }
  }

  /**
   * The ready-check event is only pushed over the socket; if that drops the message, auto-accept
   * would silently never fire. So we also poll the ready-check endpoint while auto-accept is on.
   */
  private syncAcceptPoll(): void {
    const want = this.queue.autoAccept.enabled
    if (want && !this.acceptPoll) {
      this.acceptPoll = setInterval(() => void this.pollReadyCheck(), ACCEPT_POLL_MS)
    } else if (!want && this.acceptPoll) {
      clearInterval(this.acceptPoll)
      this.acceptPoll = null
    }
  }

  private async pollReadyCheck(): Promise<void> {
    const client = this.opts.getClient()
    if (!client) return
    try {
      const data = await client.request('GET', '/lol-matchmaking/v1/ready-check')
      this.onReadyCheck(data)
    } catch {
      // 404 when there's no ready check in progress — nothing to do.
    }
  }

  private clearTimer(name: 'acceptTimer' | 'requeueTimer' | 'pauseTimer'): void {
    const timer = this[name]
    if (timer) {
      clearTimeout(timer)
      this[name] = null
    }
  }

  private stopRestartPoll(): void {
    if (this.restartPoll) {
      clearInterval(this.restartPoll)
      this.restartPoll = null
    }
  }

  private emitStatus(): void {
    this.opts.onStatus({
      ...INITIAL_QUEUE_STATUS,
      paused: this.paused,
      pausedUntil: this.pauseUntil === Infinity || this.pauseUntil <= 0 ? null : this.pauseUntil,
      searching: this.searching
    })
  }
}
