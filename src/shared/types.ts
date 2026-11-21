/** Types shared between main, preload and renderer. Keep this file free of runtime imports. */

import type { AppSettings } from './app'
import type { AutomationSettings, QueueStatus } from './automation'
import type { RpcSettings, RpcStatus } from './rpc'
import type { UpdateStatus } from './update'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

/**
 * Client gameflow phase as reported by the LCU: "None", "Lobby", "Matchmaking", "ReadyCheck",
 * "ChampSelect", "GameStart", "InProgress", "WaitingForStats", "PreEndOfGame", "EndOfGame",
 * "Reconnect", ... Kept as a string so unknown phases don't break anything.
 */
export type GamePhase = string

export interface RankedQueue {
  /** Upper-case LCU tier, e.g. "DIAMOND", "MASTER". `null` when unranked. */
  tier: string | null
  /** "I".."IV". `null` when unranked or for apex tiers (Master+), which have no division. */
  division: string | null
  leaguePoints: number
  wins: number
  losses: number
  /** Whole-number percentage, `null` when no games have been played. */
  winrate: number | null
}

/**
 * Everything the UI needs to render one player. Account and teammate cards are driven purely
 * by this object.
 */
export interface Profile {
  puuid: string
  gameName: string
  tagLine: string
  /** Platform short code, e.g. "EUNE". `null` if unknown. */
  region: string | null
  summonerLevel: number
  profileIconId: number
  /** Profile icon as a `data:` URL, fetched through the LCU in main. `null` if it could not be loaded. */
  profileIconDataUrl: string | null
  /** `null` while ranked stats have not loaded yet (or could not be loaded). */
  ranked: {
    solo: RankedQueue
    flex: RankedQueue
  } | null
}

export interface ChampionMastery {
  championId: number
  name: string
  /** Mastery level. */
  level: number
  points: number
}

export interface RecentForm {
  games: number
  wins: number
  losses: number
  /** Whole-number percentage. */
  winrate: number
}

/** Extra context about a player, loaded once per champ select. */
export interface PlayerInsights {
  /** Top champions by mastery points (up to 3). */
  mostPlayed: ChampionMastery[]
  /** Ranked Solo/Duo results among the last 20 games; `null` if none / unavailable. */
  recentSolo: RecentForm | null
}

export interface ChampionSummary {
  id: number
  name: string
  /** Tags like "fighter", "mage", "support". */
  roles: string[]
}

export interface LobbyChampion {
  id: number
  name: string
  /** True once the pick is locked in; false while only hovered / selected. */
  locked: boolean
  /** Selected skin id (full id, e.g. 429003), or 0/undefined for the base skin / none. */
  skinId?: number
}

/** One teammate slot in champ select. */
export interface LobbyPlayer {
  cellId: number
  isLocalPlayer: boolean
  /** "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY", or `null` when the queue has no roles. */
  position: string | null
  champion: LobbyChampion | null
  /** `null` when the client hides this player (ranked anonymity, bots) or the lookup failed. */
  profile: Profile | null
  /** `null` whenever `profile` is `null`. */
  insights: PlayerInsights | null
}

/** A champ select, live or finished. */
export interface Lobby {
  id: string
  /** Epoch ms when Kali first saw this champ select. */
  startedAt: number
  /** e.g. "Ranked Solo/Duo". `null` if unknown. */
  queueName: string | null
  players: LobbyPlayer[]
  /** Your team's side; `null` when the queue has no sides (e.g. blind/ARAM). */
  side: 'blue' | 'red' | null
  /** Which team gets the last pick, relative to you; `null` when picks are simultaneous. */
  lastPick: 'your' | 'enemy' | null
  /** Set when the champ select ends: did it go into a game or not? Absent while live. */
  outcome?: LobbyOutcome
}

export type LobbyOutcome = 'played' | 'dodged'

/** One player in a live game (gameflow identity merged with the in-game live data). */
export interface LivePlayer {
  puuid: string | null
  /** "name#tag" from the in-game API; empty if the live data wasn't available. */
  riotId: string
  gameName: string
  tagLine: string
  championId: number
  championName: string
  /** Selected skin id and name, from the live game. */
  skinId: number
  skinName: string
  /** Relative to the local player. */
  side: 'your' | 'enemy'
  position: string | null
  level: number
  kills: number
  deaths: number
  assists: number
  creepScore: number
  /** Item ids in slot order (trinket last). */
  items: number[]
  /** Solo/Duo rank; `null` if unranked or unavailable. */
  ranked: RankedQueue | null
  isBot: boolean
}

export interface LiveGame {
  queueName: string | null
  /** Seconds into the game. */
  gameTime: number
  /** Your team first, then the enemy team. */
  players: LivePlayer[]
}

export interface KaliSnapshot {
  version: string
  connection: ConnectionState
  profile: Profile | null
  phase: GamePhase
  /** The champ select in progress, or `null`. */
  lobby: Lobby | null
  /** Finished champ selects, newest first. */
  recentLobbies: Lobby[]
  /** The live game in progress, or `null`. */
  liveGame: LiveGame | null
  maximized: boolean
}

/** Third-party stats sites Kali can open players on. */
export type LookupProvider = 'opgg' | 'ugg'

/** Images that are loaded on demand and cached in the renderer instead of riding along in every update. */
export type AssetKind = 'emblem' | 'champion' | 'item'

/** The API exposed on `window.kali` by the preload script. */
export interface KaliApi {
  getSnapshot(): Promise<KaliSnapshot>
  /** Subscribe to connection state changes. Returns an unsubscribe function. */
  onConnectionState(listener: (state: ConnectionState) => void): () => void
  /** Subscribe to profile updates (`null` when the client goes away). Returns an unsubscribe function. */
  onProfile(listener: (profile: Profile | null) => void): () => void
  onPhase(listener: (phase: GamePhase) => void): () => void
  onLobby(listener: (lobby: Lobby | null) => void): () => void
  onRecentLobbies(listener: (lobbies: Lobby[]) => void): () => void
  onLiveGame(listener: (game: LiveGame | null) => void): () => void
  /** Re-fetch the profile now. Resolves when the attempt has finished (no-op while disconnected). */
  refreshProfile(): Promise<void>
  /**
   * Image as a `data:` URL, or `null` if unavailable.
   * - `emblem`: key is a tier ("MASTER") or "UNRANKED"
   * - `champion`: key is the champion id
   */
  getAsset(kind: AssetKind, key: string): Promise<string | null>
  /** Full champion list (id, name, roles) for the automation pick lists. */
  getChampions(): Promise<ChampionSummary[]>
  copyText(text: string): Promise<void>
  /** Open a team multi-search for these Riot IDs ("name#tag") in the default browser. */
  openMultiSearch(provider: LookupProvider, region: string, riotIds: string[]): Promise<void>
  /** Open one player's profile on the lookup site in the default browser. */
  openPlayerProfile(provider: LookupProvider, region: string, riotId: string): Promise<void>
  /** Current automation settings + queue status. */
  getAutomation(): Promise<{ settings: AutomationSettings; status: QueueStatus }>
  /** Persist automation settings (validated/clamped in main); resolves with the stored value. */
  setAutomation(settings: AutomationSettings): Promise<AutomationSettings>
  /** Subscribe to live queue-automation status (pause / searching). Returns an unsubscribe function. */
  onQueueStatus(listener: (status: QueueStatus) => void): () => void
  /** App-level settings (e.g. close-to-tray). */
  getAppSettings(): Promise<AppSettings>
  setAppSettings(settings: AppSettings): Promise<AppSettings>
  /** Discord Rich Presence settings + current status. */
  getRpc(): Promise<{ settings: RpcSettings; status: RpcStatus }>
  setRpc(settings: RpcSettings): Promise<RpcSettings>
  onRpcStatus(listener: (status: RpcStatus) => void): () => void
  /** Fired when champ select starts and "show on champ select" is on (navigate to Lobby). */
  onShowChampSelect(listener: () => void): () => void
  /** Auto-update status + controls. */
  getUpdateStatus(): Promise<UpdateStatus>
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
  downloadUpdate(): void
  installUpdate(): void
  /** Subscribe to the window being maximized / restored. Returns an unsubscribe function. */
  onMaximized(listener: (maximized: boolean) => void): () => void
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
  }
}

export const IPC = {
  getSnapshot: 'kali:get-snapshot',
  connectionState: 'kali:connection-state',
  profile: 'kali:profile',
  phase: 'kali:phase',
  lobby: 'kali:lobby',
  recentLobbies: 'kali:recent-lobbies',
  liveGame: 'kali:live-game',
  refreshProfile: 'kali:refresh-profile',
  getAsset: 'kali:get-asset',
  getChampions: 'kali:get-champions',
  copyText: 'kali:copy-text',
  openMultiSearch: 'kali:open-multi-search',
  openPlayerProfile: 'kali:open-player-profile',
  automationGet: 'kali:automation-get',
  automationSet: 'kali:automation-set',
  queueStatus: 'kali:queue-status',
  appSettingsGet: 'kali:app-settings-get',
  appSettingsSet: 'kali:app-settings-set',
  rpcGet: 'kali:rpc-get',
  rpcSet: 'kali:rpc-set',
  rpcStatus: 'kali:rpc-status',
  updateGet: 'kali:update-get',
  updateStatus: 'kali:update-status',
  updateDownload: 'kali:update-download',
  updateInstall: 'kali:update-install',
  showChampSelect: 'kali:show-champ-select',
  maximized: 'kali:maximized',
  windowMinimize: 'kali:window-minimize',
  windowToggleMaximize: 'kali:window-toggle-maximize',
  windowClose: 'kali:window-close'
} as const
