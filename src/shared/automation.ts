/** Client automation settings + status. Shared between main, preload and renderer. */

export interface AutoRule {
  enabled: boolean
  delaySeconds: number
}

export interface PauseRule {
  enabled: boolean
  /** Seconds to pause, or `null` for indefinite. */
  seconds: number | null
}

export interface QueueAutomation {
  /** Accept a ready-check after a short wait (so you can still decline). */
  autoAccept: AutoRule
  /** Re-enter the same queue after a game ends. */
  queueAgain: AutoRule
  /** Leave and rejoin the queue once you're this many seconds past League's estimate. */
  restartLongQueue: AutoRule
  /** After a dodge, pause auto-requeue for a while (or until cleared). */
  pauseAfterDodge: PauseRule
}

export type Role = 'top' | 'jungle' | 'middle' | 'bottom' | 'utility'
export const ROLES: Role[] = ['top', 'jungle', 'middle', 'bottom', 'utility']

/** When to commit an automated ban / lock: right away, or near the end of the timer. */
export type ActTiming = 'instant' | 'last'

export interface ChampSelectAutomation {
  /** Open your multi-search once all five names are in, or after the wait. */
  openLookup: { enabled: boolean; delaySeconds: number }
  /** Ban your hover, or else the first available champion from this ordered list. */
  autoBan: { enabled: boolean; timing: ActTiming; championIds: number[] }
  /** Lock your hover, or else the first available champion for the role you got. */
  autoLock: { enabled: boolean; timing: ActTiming; picks: Record<Role, number[]> }
}

export interface AutomationSettings {
  queue: QueueAutomation
  champSelect: ChampSelectAutomation
}

/** Allowed option values; also used to clamp incoming settings in main. */
export const ACCEPT_DELAYS = [0, 2, 5, 10] as const
export const QUEUE_AGAIN_DELAYS = [5, 10, 30, 60] as const
export const RESTART_DELAYS = [15, 30, 60] as const
export const PAUSE_SECONDS = [null, 30, 60, 120] as const
export const LOOKUP_DELAYS = [0, 3, 6, 10] as const
/** Max champions per ban / per-role pick list. */
export const MAX_LIST = 10

function emptyPicks(): Record<Role, number[]> {
  return { top: [], jungle: [], middle: [], bottom: [], utility: [] }
}

export const DEFAULT_AUTOMATION: AutomationSettings = {
  queue: {
    autoAccept: { enabled: false, delaySeconds: 2 },
    queueAgain: { enabled: false, delaySeconds: 30 },
    restartLongQueue: { enabled: false, delaySeconds: 30 },
    pauseAfterDodge: { enabled: false, seconds: null }
  },
  champSelect: {
    openLookup: { enabled: false, delaySeconds: 6 },
    autoBan: { enabled: false, timing: 'last', championIds: [] },
    autoLock: { enabled: false, timing: 'last', picks: emptyPicks() }
  }
}

export interface QueueStatus {
  paused: boolean
  /** Epoch ms when the pause ends, or `null` if indefinite / not paused. */
  pausedUntil: number | null
  searching: boolean
}

export const INITIAL_QUEUE_STATUS: QueueStatus = {
  paused: false,
  pausedUntil: null,
  searching: false
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback
}

function cleanRule(value: unknown, allowed: readonly number[], fallback: AutoRule): AutoRule {
  const rule = (value ?? {}) as Partial<AutoRule>
  return {
    enabled: typeof rule.enabled === 'boolean' ? rule.enabled : fallback.enabled,
    delaySeconds: pick(rule.delaySeconds, allowed, fallback.delaySeconds)
  }
}

function cleanIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const out: number[] = []
  for (const v of value) {
    if (typeof v === 'number' && Number.isInteger(v) && v > 0 && !out.includes(v)) out.push(v)
    if (out.length >= MAX_LIST) break
  }
  return out
}

function cleanTiming(value: unknown): ActTiming {
  return value === 'instant' ? 'instant' : 'last'
}

/** Accept anything shaped roughly right; replace out-of-range values with defaults. */
export function sanitizeAutomation(value: unknown): AutomationSettings {
  const root = (value ?? {}) as Partial<AutomationSettings>
  const queue = (root.queue ?? {}) as Partial<QueueAutomation>
  const dq = DEFAULT_AUTOMATION.queue
  const pause = (queue.pauseAfterDodge ?? {}) as Partial<PauseRule>

  const cs = (root.champSelect ?? {}) as Partial<ChampSelectAutomation>
  const dcs = DEFAULT_AUTOMATION.champSelect
  const lookup = (cs.openLookup ?? {}) as Partial<ChampSelectAutomation['openLookup']>
  const ban = (cs.autoBan ?? {}) as Partial<ChampSelectAutomation['autoBan']>
  const lock = (cs.autoLock ?? {}) as Partial<ChampSelectAutomation['autoLock']>
  const rawPicks = (lock.picks ?? {}) as Partial<Record<Role, unknown>>
  const picks = {} as Record<Role, number[]>
  for (const role of ROLES) picks[role] = cleanIds(rawPicks[role])

  return {
    queue: {
      autoAccept: cleanRule(queue.autoAccept, ACCEPT_DELAYS, dq.autoAccept),
      queueAgain: cleanRule(queue.queueAgain, QUEUE_AGAIN_DELAYS, dq.queueAgain),
      restartLongQueue: cleanRule(queue.restartLongQueue, RESTART_DELAYS, dq.restartLongQueue),
      pauseAfterDodge: {
        enabled: typeof pause.enabled === 'boolean' ? pause.enabled : dq.pauseAfterDodge.enabled,
        seconds: pick(pause.seconds, PAUSE_SECONDS, dq.pauseAfterDodge.seconds)
      }
    },
    champSelect: {
      openLookup: {
        enabled: typeof lookup.enabled === 'boolean' ? lookup.enabled : dcs.openLookup.enabled,
        delaySeconds: pick(lookup.delaySeconds, LOOKUP_DELAYS, dcs.openLookup.delaySeconds)
      },
      autoBan: {
        enabled: typeof ban.enabled === 'boolean' ? ban.enabled : dcs.autoBan.enabled,
        timing: cleanTiming(ban.timing),
        championIds: cleanIds(ban.championIds)
      },
      autoLock: {
        enabled: typeof lock.enabled === 'boolean' ? lock.enabled : dcs.autoLock.enabled,
        timing: cleanTiming(lock.timing),
        picks
      }
    }
  }
}
