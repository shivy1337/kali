import type { ActTiming, AutomationSettings, Role } from '../../shared/automation'
import { ROLES } from '../../shared/automation'
import type { GamePhase } from '../../shared/types'
import type { LcuClient } from '../lcu/client'
import { log } from '../log'

interface CsAction {
  id?: number
  actorCellId?: number
  championId?: number
  type?: string
  completed?: boolean
  isInProgress?: boolean
}

interface CsSession {
  localPlayerCellId?: number
  myTeam?: { cellId?: number; assignedPosition?: string }[]
  actions?: CsAction[][]
  timer?: { adjustedTimeLeftInPhase?: number }
}

/** Commit a ban/lock this close to the end of the phase when timing is "last" (ms). */
const LAST_THRESHOLD_MS = 2500
const POLL_MS = 1000
const VALID_IDS_TTL_MS = 3000

function normalizeRole(position: string | undefined): Role | null {
  const role = position?.toLowerCase()
  return role && (ROLES as string[]).includes(role) ? (role as Role) : null
}

/**
 * Automates the local player's own ban and lock-in through the champ select API: PATCH to hover,
 * POST to complete. Only ever acts on the local player's in-progress action, only for champions
 * the client reports as bannable/pickable, and only when the matching toggle is on. The user's
 * own hover always wins; "last" timing leaves the pick overridable until the final seconds.
 */
export class ChampSelectAutomation {
  private poll: NodeJS.Timeout | null = null
  private running = false
  private readonly acted = new Set<number>()
  private readonly hovered = new Map<number, number>()
  private readonly inFlight = new Set<number>()
  private readonly loggedActions = new Set<number>()
  private validCache = new Map<'ban' | 'pick', { ids: Set<number>; at: number }>()

  constructor(
    private readonly getClient: () => LcuClient | null,
    private readonly getSettings: () => AutomationSettings
  ) {}

  private get cs(): AutomationSettings['champSelect'] {
    return this.getSettings().champSelect
  }

  onPhase(previous: GamePhase, next: GamePhase): void {
    if (next === 'ChampSelect') this.startPoll()
    else if (previous === 'ChampSelect') this.reset()
  }

  /** Feed a champ select session (from the event socket) for a fast reaction to hovers. */
  onSession(session: unknown): void {
    void this.process(session as CsSession)
  }

  reset(): void {
    this.running = false
    if (this.poll) clearInterval(this.poll)
    this.poll = null
    this.acted.clear()
    this.hovered.clear()
    this.inFlight.clear()
    this.loggedActions.clear()
    this.validCache.clear()
  }

  private startPoll(): void {
    if (this.running) return
    this.running = true
    log(
      `[auto] champ select entered — autoBan=${this.cs.autoBan.enabled} (${this.cs.autoBan.timing}, ids=[${this.cs.autoBan.championIds.join(',')}]) autoLock=${this.cs.autoLock.enabled}`
    )
    this.poll = setInterval(() => void this.tick(), POLL_MS)
  }

  private async tick(): Promise<void> {
    if (!this.cs.autoBan.enabled && !this.cs.autoLock.enabled) return
    const client = this.getClient()
    if (!client) return
    try {
      const session = await client.request<CsSession>('GET', '/lol-champ-select/v1/session')
      await this.process(session)
    } catch {
      // Session gone (champ select ended): the phase change will reset us.
    }
  }

  private async process(session: CsSession): Promise<void> {
    if (!session || typeof session.localPlayerCellId !== 'number') return
    const local = session.localPlayerCellId
    const me = session.myTeam?.find((cell) => cell.cellId === local)
    const role = normalizeRole(me?.assignedPosition)
    const timeLeft = session.timer?.adjustedTimeLeftInPhase ?? 0

    for (const group of session.actions ?? []) {
      for (const action of group ?? []) {
        if (
          action.actorCellId !== local ||
          action.completed ||
          !action.isInProgress ||
          typeof action.id !== 'number'
        ) {
          continue
        }
        if (!this.loggedActions.has(action.id)) {
          this.loggedActions.add(action.id)
          const on = action.type === 'ban' ? this.cs.autoBan.enabled : this.cs.autoLock.enabled
          log(
            `[auto] my ${action.type} turn (action ${action.id}, hover=${action.championId ?? 0}, enabled=${on}, timeLeft=${Math.round(timeLeft)}ms)`
          )
        }
        if (action.type === 'ban' && this.cs.autoBan.enabled) {
          await this.handle(action.id, action.championId ?? 0, 'ban', role, timeLeft)
        } else if (action.type === 'pick' && this.cs.autoLock.enabled) {
          await this.handle(action.id, action.championId ?? 0, 'pick', role, timeLeft)
        }
      }
    }
  }

  private async handle(
    id: number,
    hoverId: number,
    kind: 'ban' | 'pick',
    role: Role | null,
    timeLeft: number
  ): Promise<void> {
    if (this.acted.has(id) || this.inFlight.has(id)) return
    const client = this.getClient()
    if (!client) return

    this.inFlight.add(id)
    try {
      const champ = hoverId > 0 ? hoverId : await this.firstAvailable(client, kind, role)
      if (!champ) {
        log(`[auto] ${kind}: no champion to ${kind} (hover=${hoverId}, role=${role ?? 'none'})`)
        return
      }

      // Show the pick as a hover first (so "last" timing is visibly pending and overridable).
      if (this.hovered.get(id) !== champ) {
        await client.request('PATCH', `/lol-champ-select/v1/session/actions/${id}`, {
          championId: champ,
          completed: false
        })
        this.hovered.set(id, champ)
      }

      const timing: ActTiming = kind === 'ban' ? this.cs.autoBan.timing : this.cs.autoLock.timing
      if (timing === 'instant' || timeLeft <= LAST_THRESHOLD_MS) {
        this.acted.add(id)
        await client.request('POST', `/lol-champ-select/v1/session/actions/${id}/complete`)
        log(`[auto] ${kind === 'ban' ? 'BANNED' : 'LOCKED'} champion ${champ} (action ${id})`)
      }
    } catch (error) {
      this.acted.delete(id) // let a later tick retry
      log(`[auto] champ select ${kind} FAILED: ${(error as Error).message}`)
    } finally {
      this.inFlight.delete(id)
    }
  }

  private async firstAvailable(
    client: LcuClient,
    kind: 'ban' | 'pick',
    role: Role | null
  ): Promise<number | null> {
    const list =
      kind === 'ban' ? this.cs.autoBan.championIds : role ? this.cs.autoLock.picks[role] : []
    if (!list || list.length === 0) return null
    const valid = await this.validIds(client, kind)
    if (!valid) return list[0]
    return list.find((id) => valid.has(id)) ?? null
  }

  private async validIds(client: LcuClient, kind: 'ban' | 'pick'): Promise<Set<number> | null> {
    const cached = this.validCache.get(kind)
    if (cached && Date.now() - cached.at < VALID_IDS_TTL_MS) return cached.ids
    const path =
      kind === 'ban'
        ? '/lol-champ-select/v1/bannable-champion-ids'
        : '/lol-champ-select/v1/pickable-champion-ids'
    try {
      const ids = await client.request<number[]>('GET', path)
      if (!Array.isArray(ids)) return null
      const set = new Set(ids)
      this.validCache.set(kind, { ids: set, at: Date.now() })
      return set
    } catch {
      return null // fall back to the raw list order
    }
  }
}
