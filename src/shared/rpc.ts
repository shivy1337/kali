/** Discord Rich Presence settings + status. Shared between main, preload and renderer. */

/**
 * The shared Kali Discord application id, baked into the app so every user gets Rich Presence
 * with no setup — just the Enable toggle. A user can still override it with their own id.
 */
export const BUNDLED_APP_ID: string = '1573611902083539097'

/** The invite the "Join the Discord" presence button points to. */
export const DISCORD_INVITE = 'https://discord.gg/kaliapp'

/** The id actually used: the user's override if set, otherwise the bundled Kali app. */
export function effectiveAppId(settings: Pick<RpcSettings, 'appId'>): string {
  return settings.appId || BUNDLED_APP_ID
}

export type RankQueueChoice = 'solo' | 'flex'
export type IdleMode = 'text' | 'profile'

export interface RpcSettings {
  enabled: boolean
  /** Advanced override; normally empty so the bundled Kali app is used. */
  appId: string
  /** Use the skin's splash art + name as the large image (instead of the champion icon). */
  useSkinSplash: boolean
  /** Show the champion as the large image (when not using skin splash). */
  showChampion: boolean
  /** Show your rank as the small image + text. */
  showRank: boolean
  /** Which queue's rank to show. */
  rankQueue: RankQueueChoice
  /** Add wins/losses next to the rank. */
  showWinLoss: boolean
  /** Show live KDA / CS / level in game. */
  showStats: boolean
  /** Show your party size in the lobby/queue. */
  showParty: boolean
  /** Show elapsed time (queue / champ select / in game). */
  showTimer: boolean
  /** Add a "Join the Discord" button to your presence. */
  showJoinButton: boolean
  /** Show a presence while sitting idle in the client. */
  idleEnabled: boolean
  /** Idle presence style: your custom text, or your profile info. */
  idleMode: IdleMode
  /** Text shown while idle (idleMode = "text"). */
  idleText: string
}

export const DEFAULT_RPC_SETTINGS: RpcSettings = {
  enabled: false,
  appId: '',
  useSkinSplash: true,
  showChampion: true,
  showRank: true,
  rankQueue: 'solo',
  showWinLoss: false,
  showStats: true,
  showParty: true,
  showTimer: true,
  showJoinButton: true,
  idleEnabled: true,
  idleMode: 'text',
  idleText: 'In the client'
}

/** Whether Kali is currently pushing presence to Discord. */
export type RpcState = 'off' | 'no-app-id' | 'waiting-for-discord' | 'connected'

export interface RpcStatus {
  state: RpcState
  detail: string
}

export const INITIAL_RPC_STATUS: RpcStatus = { state: 'off', detail: '' }

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function sanitizeRpcSettings(value: unknown): RpcSettings {
  const v = (value ?? {}) as Partial<RpcSettings>
  const d = DEFAULT_RPC_SETTINGS
  const appId = typeof v.appId === 'string' && /^\d{17,20}$/.test(v.appId.trim()) ? v.appId.trim() : ''
  const idleText =
    typeof v.idleText === 'string' && v.idleText.trim() ? v.idleText.trim().slice(0, 128) : d.idleText
  return {
    enabled: bool(v.enabled, d.enabled),
    appId,
    useSkinSplash: bool(v.useSkinSplash, d.useSkinSplash),
    showChampion: bool(v.showChampion, d.showChampion),
    showRank: bool(v.showRank, d.showRank),
    rankQueue: v.rankQueue === 'flex' ? 'flex' : 'solo',
    showWinLoss: bool(v.showWinLoss, d.showWinLoss),
    showStats: bool(v.showStats, d.showStats),
    showParty: bool(v.showParty, d.showParty),
    showTimer: bool(v.showTimer, d.showTimer),
    showJoinButton: bool(v.showJoinButton, d.showJoinButton),
    idleEnabled: bool(v.idleEnabled, d.idleEnabled),
    idleMode: v.idleMode === 'profile' ? 'profile' : 'text',
    idleText
  }
}
