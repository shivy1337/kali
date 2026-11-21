/** Discord Rich Presence settings + status. Shared between main, preload and renderer. */

/**
 * The shared Kali Discord application id, baked into the app so every user gets Rich Presence
 * with no setup — just the Enable toggle. Empty until the one Kali Discord app is created; set it
 * here and all users pick it up. A user can still override it with their own id in settings.
 */
export const BUNDLED_APP_ID = '1573611902083539097'

/** The id actually used: the user's override if set, otherwise the bundled Kali app. */
export function effectiveAppId(settings: Pick<RpcSettings, 'appId'>): string {
  return settings.appId || BUNDLED_APP_ID
}

export interface RpcSettings {
  enabled: boolean
  /** Discord Application (client) ID the user creates on the Discord developer portal. */
  appId: string
  /** Show your Solo/Duo rank as the small image + text. */
  showRank: boolean
  /** Show the champion you're playing / hovering as the large image. */
  showChampion: boolean
  /** Show elapsed time (queue / champ select / in game). */
  showTimer: boolean
  /** Show a presence while sitting idle in the client. */
  idleEnabled: boolean
  /** Text shown while idle. */
  idleText: string
}

export const DEFAULT_RPC_SETTINGS: RpcSettings = {
  enabled: false,
  appId: '',
  showRank: true,
  showChampion: true,
  showTimer: true,
  idleEnabled: true,
  idleText: 'In the client'
}

/** Whether Kali is currently pushing presence to Discord. */
export type RpcState = 'off' | 'no-app-id' | 'waiting-for-discord' | 'connected'

export interface RpcStatus {
  state: RpcState
  /** Short human-readable detail, e.g. the current presence line or an error. */
  detail: string
}

export const INITIAL_RPC_STATUS: RpcStatus = { state: 'off', detail: '' }

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function sanitizeRpcSettings(value: unknown): RpcSettings {
  const v = (value ?? {}) as Partial<RpcSettings>
  const d = DEFAULT_RPC_SETTINGS
  // Discord application ids are 17-20 digit snowflakes.
  const appId = typeof v.appId === 'string' && /^\d{17,20}$/.test(v.appId.trim()) ? v.appId.trim() : ''
  const idleText =
    typeof v.idleText === 'string' && v.idleText.trim() ? v.idleText.trim().slice(0, 128) : d.idleText
  return {
    enabled: bool(v.enabled, d.enabled),
    appId,
    showRank: bool(v.showRank, d.showRank),
    showChampion: bool(v.showChampion, d.showChampion),
    showTimer: bool(v.showTimer, d.showTimer),
    idleEnabled: bool(v.idleEnabled, d.idleEnabled),
    idleText
  }
}
