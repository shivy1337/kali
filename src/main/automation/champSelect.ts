import type { AutomationSettings, Role } from '../../shared/automation'
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

interface CsMember {
  cellId?: number
  assignedPosition?: string
  championPickIntent?: number
}

interface CsSession {
  localPlayerCellId?: number
  myTeam?: CsMember[]
  actions?: CsAction[][]
  timer?: {
    adjustedTimeLeftInPhase?: number
    internalNowInEpochMs?: number
    phase?: string
  }
}

/** Fast poll so we never miss the last moments of a turn (the client updates on events only). */
const POLL_MS = 250
/** "last" timing commits once this little of the turn remains (ms). */
const LAST_THRESHOLD_MS = 2500
/** Give up on a turn with nothing to do once it's this close to the end (ms). */
const GIVE_UP_MS = 400
const PICKABLE_TTL_MS = 2000
const MAX_ATTEMPTS = 3

function normalizeRole(position: string | undefined): Role | null {
  const role = position?.toLowerCase()
  return role && (ROLES as string[]).includes(role) ? (role as Role) : null
}

/**
 * Automates the local player's own ban and lock-in through the champ select API. Approach mirrors
 * steele123/reveal (re-implemented here, not copied): poll fast, compute the real time left from
 * the timer, and commit in ONE atomic PATCH (`championId` + `completed: true`) — no separate hover
 * step, which is what used to leave empty bans. Only ever acts on the local player's in-progress
 * action, only while the matching toggle is on; your own hover always wins.
 */
export class ChampSelectAutomation {
  private poll: NodeJS.Timeout | null = null
  private running = false
  private readonly inFlight = new Set<number>()
  private readonly finished = new Set<number>()
  private readonly failures = new Map<number, number>()
  private readonly loggedTurn = new Set<number>()
  private pickable: { ids: Set<number>; at: number } | null = null

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

  /** Feed a champ select session (from the event socket) for an extra-fast reaction to hovers. */
  onSession(session: unknown): void {
    void this.process(session as CsSession)
  }

  reset(): void {
    this.running = false
    if (this.poll) clearInterval(this.poll)
    this.poll = null
    this.inFlight.clear()
    this.finished.clear()
    this.failures.clear()
    this.loggedTurn.clear()
    this.pickable = null
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
      // Session gone (champ select ended): the phase change resets us.
    }
  }

  private async process(session: CsSession): Promise<void> {
    if (!session || typeof session.localPlayerCellId !== 'number') return
    // Only the ban/pick sub-phase is actionable (not planning or finalization).
    if (session.timer?.phase && session.timer.phase !== 'BAN_PICK') return

    const local = session.localPlayerCellId
    const me = session.myTeam?.find((member) => member.cellId === local)
    const role = normalizeRole(me?.assignedPosition)
    const timeLeft = this.timeLeftMs(session)

    // Champions already banned or locked, and what teammates intend to pick.
    const locked = new Set<number>()
    for (const group of session.actions ?? []) {
      for (const a of group ?? []) {
        if (a.completed && typeof a.championId === 'number' && a.championId > 0) locked.add(a.championId)
      }
    }
    const teammatesWant = new Set<number>()
    for (const member of session.myTeam ?? []) {
      if (member.cellId !== local && member.championPickIntent && member.championPickIntent > 0) {
        teammatesWant.add(member.championPickIntent)
      }
    }

    for (const group of session.actions ?? []) {
      for (const action of group ?? []) {
        if (
          action.actorCellId !== local ||
          action.completed ||
          !action.isInProgress ||
          typeof action.id !== 'number' ||
          (action.type !== 'ban' && action.type !== 'pick')
        ) {
          continue
        }
        const kind = action.type
        const enabled = kind === 'ban' ? this.cs.autoBan.enabled : this.cs.autoLock.enabled
        if (!enabled) continue

        if (!this.loggedTurn.has(action.id)) {
          this.loggedTurn.add(action.id)
          log(
            `[auto] my ${kind} turn (action ${action.id}, hover=${action.championId ?? 0}, timeLeft=${Math.round(timeLeft)}ms)`
          )
        }
        if (this.finished.has(action.id)) continue

        // Timing: "instant" acts on sight, "last" waits until the final seconds of the turn.
        const timing = kind === 'ban' ? this.cs.autoBan.timing : this.cs.autoLock.timing
        if (timing !== 'instant' && timeLeft > LAST_THRESHOLD_MS) continue

        const champ = await this.choose(action, kind, role, me, locked, teammatesWant)
        if (!champ) {
          // A hover may still come in, so keep looking until the turn is nearly over.
          if (timeLeft <= GIVE_UP_MS) {
            this.finished.add(action.id)
            log(`[auto] ${kind}: nothing available to ${kind} (role=${role ?? 'none'})`)
          }
          continue
        }
        await this.commit(action.id, champ, kind)
      }
    }
  }

  /** Real time left in the turn: the client only recomputes the timer on events. */
  private timeLeftMs(session: CsSession): number {
    const timer = session.timer
    const adjusted = timer?.adjustedTimeLeftInPhase ?? 0
    const internalNow = timer?.internalNowInEpochMs ?? 0
    const since = internalNow > 0 ? Math.max(0, Date.now() - internalNow) : 0
    return adjusted - since
  }

  /** What to ban/lock: your own hover, else the first free champion from your list. */
  private async choose(
    action: CsAction,
    kind: 'ban' | 'pick',
    role: Role | null,
    me: CsMember | undefined,
    locked: Set<number>,
    teammatesWant: Set<number>
  ): Promise<number | null> {
    const hover =
      kind === 'ban'
        ? (action.championId ?? 0)
        : [action.championId ?? 0, me?.championPickIntent ?? 0].find((id) => id > 0) ?? 0
    const list = kind === 'ban' ? this.cs.autoBan.championIds : role ? this.cs.autoLock.picks[role] : []

    // Picks must be genuinely pickable; bans aren't filtered (you can ban almost anything).
    const pickable = kind === 'pick' ? await this.pickableIds() : null
    const free = (id: number): boolean => !locked.has(id) && (!pickable || pickable.has(id))
    // Your own hover stands even if a teammate wants it; we just never ban a teammate's intent.
    const hoverOk = (id: number): boolean => free(id) && (kind !== 'ban' || !teammatesWant.has(id))

    if (hover > 0 && hoverOk(hover)) return hover
    return (list ?? []).find((id) => free(id) && !teammatesWant.has(id)) ?? null
  }

  /** One atomic PATCH sets the champion and locks it in — no fragile hover-then-complete. */
  private async commit(id: number, champ: number, kind: 'ban' | 'pick'): Promise<void> {
    if (this.inFlight.has(id)) return
    const client = this.getClient()
    if (!client) return
    this.inFlight.add(id)
    try {
      await client.request('PATCH', `/lol-champ-select/v1/session/actions/${id}`, {
        championId: champ,
        completed: true
      })
      this.finished.add(id)
      log(`[auto] ${kind === 'ban' ? 'BANNED' : 'LOCKED'} champion ${champ} (action ${id})`)
    } catch (error) {
      const count = (this.failures.get(id) ?? 0) + 1
      this.failures.set(id, count)
      if (count >= MAX_ATTEMPTS) {
        this.finished.add(id)
        log(`[auto] ${kind} FAILED ${MAX_ATTEMPTS}x (action ${id}): ${(error as Error).message}`)
      } else {
        log(`[auto] ${kind} failed (action ${id}), retrying: ${(error as Error).message}`)
      }
    } finally {
      this.inFlight.delete(id)
    }
  }

  private async pickableIds(): Promise<Set<number> | null> {
    if (this.pickable && Date.now() - this.pickable.at < PICKABLE_TTL_MS) return this.pickable.ids
    const client = this.getClient()
    if (!client) return null
    try {
      const ids = await client.request<number[]>('GET', '/lol-champ-select/v1/pickable-champion-ids')
      // An empty list means "unknown" (some modes), not "nothing allowed": don't filter on it.
      if (!Array.isArray(ids) || ids.length === 0) return null
      const set = new Set(ids)
      this.pickable = { ids: set, at: Date.now() }
      return set
    } catch {
      return null
    }
  }
}
