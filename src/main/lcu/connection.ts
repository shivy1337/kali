import { dirname } from 'node:path'
import {
  DEFAULT_AUTOMATION,
  type AutomationSettings,
  type QueueStatus
} from '../../shared/automation'
import type {
  AssetKind,
  ChampionSummary,
  ConnectionState,
  GamePhase,
  LiveGame,
  Lobby,
  Profile
} from '../../shared/types'
import { ChampSelectAutomation } from '../automation/champSelect'
import { AutomationEngine } from '../automation/engine'
import { LiveGameTracker } from '../live/liveGame'
import { ChampionData } from './champions'
import { LcuClient } from './client'
import {
  isProcessAlive,
  LOCKFILE_PATH,
  readLockfile,
  readProcessCredentials,
  sameCredentials,
  type LcuCredentials
} from './credentials'
import { EmblemStore } from './emblems'
import { InsightsFetcher } from './insights'
import { LobbyTracker, type LcuChampSelectSession } from './lobby'
import { fetchImage, ProfileFetcher } from './profile'
import { LcuSocket, type LcuEvent } from './socket'

const POLL_MS = 2000
const PROFILE_REFRESH_MS = 60_000
/** The PowerShell fallback is slow (~0.5s per spawn), so only try it every Nth poll. */
const PROCESS_LOOKUP_EVERY = 3

/** Phases that can only follow a champ select that went through. Anything else = dodged. */
const PLAYED_PHASES = new Set(['GameStart', 'InProgress', 'Reconnect', 'FailedToLaunch'])

const URI_PHASE = '/lol-gameflow/v1/gameflow-phase'
const URI_CHAMP_SELECT = '/lol-champ-select/v1/session'
const URI_READY_CHECK = '/lol-matchmaking/v1/ready-check'
const URI_SEARCH_STATE = '/lol-lobby/v2/lobby/matchmaking/search-state'
const SOCKET_URIS = [URI_PHASE, URI_CHAMP_SELECT, URI_READY_CHECK, URI_SEARCH_STATE]

export interface LcuConnectionEvents {
  onState(state: ConnectionState): void
  onProfile(profile: Profile | null): void
  onPhase(phase: GamePhase): void
  onLobby(lobby: Lobby | null): void
  /** A champ select ended and should be archived. */
  onLobbyFinished(lobby: Lobby): void
  onQueueStatus(status: QueueStatus): void
  onLiveGame(game: LiveGame | null): void
}

/**
 * Owns the connection lifecycle.
 *
 * A loop ticks every 2s to find the client and notice it going away:
 *  - no credentials / client process gone -> `disconnected`
 *  - credentials found but summoner not loaded (booting, login screen) -> `connecting`
 *  - summoner loaded -> `connected`, profile refreshed every 60s
 *
 * While connected, a WebSocket delivers gameflow phase and champ select changes instantly.
 * Nothing in here throws out of the loop, so a missing League install is harmless.
 */
export class LcuConnection {
  state: ConnectionState = 'disconnected'
  profile: Profile | null = null
  phase: GamePhase = 'None'

  private client: LcuClient | null = null
  private socket: LcuSocket | null = null
  private readonly profiles = new ProfileFetcher()
  private readonly champions = new ChampionData()
  private readonly emblems = new EmblemStore()
  private readonly lobbyTracker: LobbyTracker
  private readonly automation: AutomationEngine
  private readonly champSelectAuto: ChampSelectAutomation
  private readonly liveGameTracker: LiveGameTracker
  private readonly itemIcons = new Map<number, string>()
  private itemPaths: Map<number, string> | null = null
  private automationSettings: AutomationSettings = DEFAULT_AUTOMATION
  private timer: NodeJS.Timeout | null = null
  private running = false
  private inFlight: Promise<void> | null = null
  private nextProfileAt = 0
  private ticksSinceProcessLookup = PROCESS_LOOKUP_EVERY // look immediately on first miss
  private installDir = dirname(LOCKFILE_PATH)

  constructor(private readonly events: LcuConnectionEvents) {
    this.lobbyTracker = new LobbyTracker(
      this.profiles,
      this.champions,
      new InsightsFetcher(this.champions),
      (lobby) => this.events.onLobby(lobby),
      (lobby) => this.events.onLobbyFinished(lobby)
    )
    this.automation = new AutomationEngine({
      getClient: () => this.client,
      getSettings: () => this.automationSettings,
      onStatus: (status) => this.events.onQueueStatus(status)
    })
    this.champSelectAuto = new ChampSelectAutomation(
      () => this.client,
      () => this.automationSettings
    )
    this.liveGameTracker = new LiveGameTracker(
      () => this.client,
      () => this.profile?.puuid ?? null,
      this.profiles,
      this.champions,
      (game) => this.events.onLiveGame(game)
    )
  }

  get liveGame(): LiveGame | null {
    return this.liveGameTracker.current
  }

  get lobby(): Lobby | null {
    return this.lobbyTracker.current
  }

  /** Full champion list for the automation pick lists. */
  getChampions(): Promise<ChampionSummary[]> {
    return this.champions.list(this.client)
  }

  /** Replace the automation settings (from the persisted store / the Settings UI). */
  setAutomation(settings: AutomationSettings): void {
    this.automationSettings = settings
    this.automation.onSettingsChanged()
  }

  start(): void {
    if (this.running) return
    this.running = true
    void this.loop()
  }

  stop(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.socket?.close()
    this.socket = null
    this.client?.dispose()
    this.client = null
  }

  /** Force a profile fetch now instead of waiting for the 60s refresh. */
  async refresh(): Promise<void> {
    if (!this.running) return
    // Let a tick that is already running finish first, then run a fresh one.
    if (this.inFlight) await this.inFlight
    if (!this.running) return
    this.nextProfileAt = 0
    await this.loop()
  }

  /** On-demand images for the renderer (see `KaliApi.getAsset`). */
  async getAsset(kind: AssetKind, key: string): Promise<string | null> {
    if (kind === 'emblem') {
      return this.emblems.get(this.installDir, key === 'UNRANKED' ? null : key)
    }
    if (kind === 'champion') {
      return this.champions.icon(this.client, Number(key))
    }
    if (kind === 'item') {
      return this.fetchItemIcon(Number(key))
    }
    return null
  }

  private async fetchItemIcon(id: number): Promise<string | null> {
    if (!this.client || !Number.isInteger(id) || id <= 0) return null
    const cached = this.itemIcons.get(id)
    if (cached) return cached
    // Item icons are served at the per-item `iconPath` from items.json, not a plain id path.
    if (!this.itemPaths) {
      try {
        const items = await this.client.request<{ id: number; iconPath: string }[]>(
          'GET',
          '/lol-game-data/assets/v1/items.json'
        )
        this.itemPaths = new Map(items.filter((i) => i.iconPath).map((i) => [i.id, i.iconPath]))
      } catch {
        return null
      }
    }
    const path = this.itemPaths.get(id)
    if (!path) return null
    const dataUrl = await fetchImage(this.client, path)
    if (dataUrl) this.itemIcons.set(id, dataUrl)
    return dataUrl
  }

  private loop(): Promise<void> {
    if (this.inFlight) return this.inFlight
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.inFlight = this.tick()
      .catch((error) => console.error('[lcu] unexpected error in poll loop', error))
      .finally(() => {
        this.inFlight = null
        if (this.running) this.timer = setTimeout(() => void this.loop(), POLL_MS)
      })
    return this.inFlight
  }

  private async tick(): Promise<void> {
    const credentials = await this.findCredentials()
    if (!this.running) return

    if (!credentials) {
      this.dropClient()
      this.setState('disconnected')
      return
    }

    if (!this.client || !sameCredentials(this.client.credentials, credentials)) {
      // New client instance (first launch or a restart): start over.
      this.dropClient()
      this.client = new LcuClient(credentials)
      this.installDir = credentials.installDir
      this.nextProfileAt = 0
      this.setState('connecting')
    }

    if (this.state !== 'connected' || Date.now() >= this.nextProfileAt) {
      try {
        const { profile, complete } = await this.profiles.fetchCurrent(this.client)
        if (!this.running) return
        // Retry on the next tick if ranked stats / icon were still loading.
        this.nextProfileAt = complete ? Date.now() + PROFILE_REFRESH_MS : 0
        this.setState('connected')
        this.setProfile(profile)
      } catch {
        // Port not open yet, or summoner endpoints 404/500 on the login screen.
        // The process is alive, so keep waiting; the next tick retries.
        this.nextProfileAt = 0
        this.setState('connecting')
        return
      }
    }

    // Live events: (re)open the socket whenever we are connected without one.
    if (this.state === 'connected' && (!this.socket || !this.socket.isOpen)) {
      this.openSocket(this.client)
    }
  }

  private openSocket(client: LcuClient): void {
    this.socket?.close()
    const socket = new LcuSocket(client.credentials, SOCKET_URIS, {
      onOpen: () => {
        console.log('[lcu] event socket open')
        // Catch up on state that changed before we were listening.
        void this.syncLiveState(client)
      },
      onEvent: (event) => {
        if (this.client === client) this.handleEvent(client, event)
      },
      onClose: () => {
        // The poll loop notices (`isOpen` is false) and reconnects if the client is still up.
        console.log('[lcu] event socket closed')
      }
    })
    this.socket = socket
  }

  private async syncLiveState(client: LcuClient): Promise<void> {
    try {
      const phase = await client.request<string>('GET', URI_PHASE)
      if (this.client !== client) return
      this.setPhase(phase)
      if (phase === 'ChampSelect') {
        const session = await client.request<LcuChampSelectSession>('GET', URI_CHAMP_SELECT)
        if (this.client === client) await this.lobbyTracker.update(client, session)
      }
    } catch {
      // Not fatal: events will bring us up to date.
    }
  }

  private handleEvent(client: LcuClient, event: LcuEvent): void {
    if (event.uri === URI_READY_CHECK) {
      this.automation.onReadyCheck(event.eventType === 'Delete' ? null : event.data)
      return
    }
    if (event.uri === URI_SEARCH_STATE) {
      this.automation.onSearchState(event.eventType === 'Delete' ? null : event.data)
      return
    }
    if (event.uri === URI_PHASE) {
      this.setPhase(typeof event.data === 'string' ? event.data : 'None')
      return
    }
    if (event.uri === URI_CHAMP_SELECT) {
      // A "Delete" needs no handling: the phase change that follows archives the lobby and
      // tells us whether it became a game or was dodged.
      if (event.eventType !== 'Delete' && event.data && this.phase === 'ChampSelect') {
        // (Updates that arrive outside the ChampSelect phase are stragglers; entering the
        // phase fetches the session explicitly, so nothing is lost by ignoring them.)
        this.champSelectAuto.onSession(event.data)
        void this.lobbyTracker
          .update(client, event.data as LcuChampSelectSession)
          .catch((error) => console.error('[lcu] champ select update failed', error))
      }
    }
  }

  private async findCredentials(): Promise<LcuCredentials | null> {
    const fromLockfile = await readLockfile()
    if (fromLockfile) {
      // A stale lockfile can survive a crash; only trust it if its process exists.
      return isProcessAlive(fromLockfile.pid) ? fromLockfile : null
    }

    // No lockfile. Keep using process-sourced credentials for as long as that process lives.
    const current = this.client?.credentials
    if (current?.source === 'process' && isProcessAlive(current.pid)) return current

    if (++this.ticksSinceProcessLookup < PROCESS_LOOKUP_EVERY) return null
    this.ticksSinceProcessLookup = 0
    return readProcessCredentials()
  }

  private dropClient(): void {
    this.socket?.close()
    this.socket = null
    this.client?.dispose()
    this.client = null
    this.profiles.reset()
    this.emblems.reset()
    this.lobbyTracker.clear()
    this.automation.reset()
    this.champSelectAuto.reset()
    this.liveGameTracker.clear()
    this.setPhase('None')
    this.setProfile(null)
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return
    this.state = state
    console.log(`[lcu] ${state}`)
    this.events.onState(state)
  }

  private setPhase(phase: GamePhase): void {
    if (this.phase === phase) return
    const previous = this.phase
    this.phase = phase
    console.log(`[lcu] phase ${phase}`)
    this.events.onPhase(phase)
    this.automation.onPhase(previous, phase)
    this.champSelectAuto.onPhase(previous, phase)
    this.liveGameTracker.onPhase(previous, phase)
    if (previous === 'ChampSelect') {
      const played = PLAYED_PHASES.has(phase)
      this.lobbyTracker.finish(played ? 'played' : 'dodged')
      if (!played) this.automation.onDodge()
    }
    if (phase === 'ChampSelect' && this.client) {
      const client = this.client
      void client
        .request<LcuChampSelectSession>('GET', URI_CHAMP_SELECT)
        .then((session) => {
          if (this.client === client && this.phase === 'ChampSelect') {
            this.champSelectAuto.onSession(session)
            return this.lobbyTracker.update(client, session)
          }
          return undefined
        })
        .catch(() => {
          // Session not ready yet: the next session event fills it in.
        })
    }
  }

  private setProfile(profile: Profile | null): void {
    if (profile === null && this.profile === null) return
    this.profile = profile
    this.events.onProfile(profile)
  }
}
