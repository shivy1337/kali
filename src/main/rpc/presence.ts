import {
  DEFAULT_RPC_SETTINGS,
  DISCORD_INVITE,
  effectiveAppId,
  INITIAL_RPC_STATUS,
  type RpcSettings,
  type RpcStatus
} from '../../shared/rpc'
import type { GamePhase, LiveGame, Lobby, Profile, RankedQueue } from '../../shared/types'
import type { LcuClient } from '../lcu/client'
import { log } from '../log'
import { DiscordClient, type DiscordActivity } from './discordClient'

/** Everything the presence is built from — fed from Kali's existing LCU state. */
export interface PresenceState {
  connected: boolean
  phase: GamePhase
  profile: Profile | null
  lobby: Lobby | null
  liveGame: LiveGame | null
}

const CDN = 'https://raw.communitydragon.org/latest/plugins'
const championIcon = (id: number): string =>
  `${CDN}/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`
const profileIcon = (id: number): string =>
  `${CDN}/rcp-be-lol-game-data/global/default/v1/profile-icons/${id}.jpg`
const rankEmblem = (tier: string): string =>
  `${CDN}/rcp-fe-lol-shared-components/global/default/${tier.toLowerCase()}.png`
const skinTile = (championId: number, skinId: number): string => {
  const num = skinId >= 1000 ? skinId % 1000 : skinId // champ select gives full ids, live gives the number
  return `https://cdn.communitydragon.org/latest/champion/${championId}/tile/skin/${num}`
}

const capitalize = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase()

/** Convert an LCU game-data asset path to its public Community Dragon URL. */
function modeIconUrl(assetPath: string): string {
  const rel = assetPath.replace(/^\/?lol-game-data\/assets\//i, '').toLowerCase()
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/${rel}`
}

// Shown when hovering the large image (the app/brand); the bold line above it is the Discord
// application's name, which the user sets on the dev portal (e.g. "League of Legends").
const HOVER_TEXT = 'discord.gg/kaliapp'

const PARTY_PHASES = new Set(['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'])
const PARTY_TTL_MS = 4000

/** Queue id -> display name (for the lobby/queue presence). */
const QUEUE_NAMES: Record<number, string> = {
  420: 'Ranked Solo/Duo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
  490: 'Quickplay',
  480: 'Swiftplay',
  700: 'Clash',
  720: 'ARAM Clash',
  900: 'ARURF',
  1700: 'Arena',
  1900: 'URF',
  830: 'Co-op vs. AI',
  840: 'Co-op vs. AI',
  850: 'Co-op vs. AI'
}

/**
 * Turns Kali's LCU state into a Discord Rich Presence and keeps it in sync, reconnecting to Discord
 * on its own. Images are Community Dragon URLs (no asset uploads / tokens needed).
 */
export class PresenceManager {
  private readonly client: DiscordClient
  private settings: RpcSettings = DEFAULT_RPC_SETTINGS
  private state: PresenceState | null = null
  private phaseSince = Date.now()
  private lastPhase = ''
  private lastActivityJson = ''
  private status: RpcStatus = INITIAL_RPC_STATUS
  private party = { size: 0, max: 0, at: 0 }
  private lobbyQueue: string | null = null
  private mapName: string | null = null
  private modeIcon: string | null = null
  private modeIconMapId = 0
  private mapNames: Map<number, string> | null = null
  private mapIcons: Map<number, string> | null = null
  // Live Client Data reports skinID as 0 even when a skin is equipped, so we remember the skin
  // the local player picked in champ select and reuse it for the in-game tile.
  private lastSkin: { championId: number; skinId: number } | null = null

  constructor(
    private readonly onStatus: (status: RpcStatus) => void,
    private readonly getClient: () => LcuClient | null
  ) {
    this.client = new DiscordClient((connected) => this.onDiscord(connected))
  }

  setSettings(settings: RpcSettings): void {
    this.settings = settings
    this.reconcile()
    this.rebuild()
  }

  apply(state: PresenceState): void {
    if (state.phase !== this.lastPhase) {
      this.phaseSince = Date.now()
      this.lastPhase = state.phase
    }
    this.state = state
    void this.refreshParty(state)
    this.rebuild()
  }

  stop(): void {
    this.client.stop()
  }

  private reconcile(): void {
    const appId = effectiveAppId(this.settings)
    if (this.settings.enabled && appId) {
      this.client.start(appId)
      this.setStatus(this.client.connected ? 'connected' : 'waiting-for-discord')
    } else {
      this.client.stop()
      this.lastActivityJson = ''
      this.setStatus(this.settings.enabled && !appId ? 'no-app-id' : 'off')
    }
  }

  private onDiscord(connected: boolean): void {
    if (connected) {
      this.lastActivityJson = ''
      this.setStatus('connected')
      this.rebuild()
    } else if (this.settings.enabled && effectiveAppId(this.settings)) {
      this.setStatus('waiting-for-discord')
    }
  }

  private async refreshParty(state: PresenceState): Promise<void> {
    if (!this.settings.enabled || !PARTY_PHASES.has(state.phase)) {
      if (this.party.size !== 0 || this.lobbyQueue !== null || this.modeIcon !== null) {
        this.party = { size: 0, max: 0, at: 0 }
        this.lobbyQueue = null
        this.mapName = null
        this.modeIcon = null
        this.modeIconMapId = 0
        this.rebuild()
      }
      return
    }
    if (Date.now() - this.party.at < PARTY_TTL_MS) return
    this.party.at = Date.now()
    const client = this.getClient()
    if (!client) return
    try {
      const lobby = await client.request<{
        members?: unknown[]
        gameConfig?: { maxLobbySize?: number; queueId?: number; mapId?: number }
      }>('GET', '/lol-lobby/v2/lobby')
      const size = lobby?.members?.length ?? 0
      const max = lobby?.gameConfig?.maxLobbySize ?? size
      const queue = QUEUE_NAMES[lobby?.gameConfig?.queueId ?? -1] ?? null
      let changed = size !== this.party.size || max !== this.party.max || queue !== this.lobbyQueue

      const mapId = lobby?.gameConfig?.mapId ?? 0
      if (mapId && mapId !== this.modeIconMapId) {
        this.modeIconMapId = mapId
        changed = true
        await this.resolveMap(client, mapId)
        log(`[rpc] map ${mapId} (${this.mapName ?? '?'}) icon=${this.modeIcon ?? 'MISSING'}`)
      }

      if (changed) {
        this.party = { size, max, at: Date.now() }
        this.lobbyQueue = queue
        this.rebuild()
      }
    } catch {
      // Not in a lobby (solo queue dodge etc.): leave as-is.
    }
  }

  /**
   * Sets mapName + modeIcon for a map id from the client's static game data. The old
   * /lol-maps/v2/map/{id} endpoint 404s, so we read maps.json (names) and map-assets.json
   * (the game-select mode icon), both cached for the session.
   */
  private async resolveMap(client: LcuClient, mapId: number): Promise<void> {
    try {
      if (!this.mapNames || !this.mapIcons) {
        const [maps, assets] = await Promise.all([
          client.request<{ id: number; name?: string }[]>(
            'GET',
            '/lol-game-data/assets/v1/maps.json'
          ),
          client.request<Record<string, { assets?: Record<string, string> }[]>>(
            'GET',
            '/lol-game-data/assets/v1/map-assets/map-assets.json'
          )
        ])
        this.mapNames = new Map((maps ?? []).map((m) => [m.id, m.name ?? '']))
        const icons = new Map<number, string>()
        for (const [id, configs] of Object.entries(assets ?? {})) {
          const a = configs?.[0]?.assets ?? {}
          // Prefer the full-colour "hover" tile (brightest), then "active", then the dark default.
          const path =
            a['game-select-icon-hover'] ||
            a['game-select-icon-active'] ||
            a['game-select-icon-default']
          if (typeof path === 'string' && path) icons.set(Number(id), modeIconUrl(path))
        }
        this.mapIcons = icons
      }
      this.mapName = this.mapNames.get(mapId) || null
      this.modeIcon = this.mapIcons.get(mapId) ?? null
    } catch (error) {
      this.mapNames = null // let a later lobby retry the fetch
      this.mapIcons = null
      this.mapName = null
      this.modeIcon = null
      log(`[rpc] map assets fetch failed: ${(error as Error).message}`)
    }
  }

  private rebuild(): void {
    if (!this.settings.enabled || !effectiveAppId(this.settings) || !this.client.connected) return
    const activity = this.build()
    const json = JSON.stringify(activity)
    if (json === this.lastActivityJson) return
    this.lastActivityJson = json
    this.client.setActivity(activity)
    this.setStatus(
      'connected',
      activity ? `${activity.details ?? ''} ${activity.state ?? ''}`.trim() : 'Idle'
    )
  }

  // --- building -----------------------------------------------------------------------------

  private rankAssets(profile: Profile | null): Partial<DiscordActivity['assets']> {
    if (!this.settings.showRank || !profile?.ranked) return {}
    const queue = this.settings.rankQueue === 'flex' ? profile.ranked.flex : profile.ranked.solo
    if (!queue.tier) return {}
    return { small_image: rankEmblem(queue.tier), small_text: this.rankText(queue) }
  }

  private rankText(queue: RankedQueue): string {
    const name = queue.division
      ? `${capitalize(queue.tier!)} ${queue.division}`
      : capitalize(queue.tier!)
    const label = this.settings.rankQueue === 'flex' ? ' (Flex)' : ''
    let text = `${name}${label} · ${queue.leaguePoints} LP`
    if (this.settings.showWinLoss && queue.wins + queue.losses > 0) {
      text += ` · ${queue.wins}W ${queue.losses}L`
    }
    return text
  }

  private largeImage(
    championId: number,
    championName: string,
    skinId: number,
    skinName: string,
    idleLarge?: string
  ): Pick<NonNullable<DiscordActivity['assets']>, 'large_image' | 'large_text'> {
    // Square champion/skin tile (not the wide splash). Hover tooltip shows the skin/champ name.
    if (this.settings.useSkinSplash && championId > 0) {
      return { large_image: skinTile(championId, skinId), large_text: skinName || championName }
    }
    if (this.settings.showChampion && championId > 0) {
      return { large_image: championIcon(championId), large_text: championName }
    }
    return { large_image: idleLarge, large_text: HOVER_TEXT }
  }

  private build(): DiscordActivity | null {
    const state = this.state
    if (!state || !state.connected) return null
    const cfg = this.settings
    const profile = state.profile
    const rank = this.rankAssets(profile)
    const timer = cfg.showTimer ? { start: this.phaseSince } : undefined
    const idleLarge = profile ? profileIcon(profile.profileIconId) : undefined
    const idleAssets = { large_image: idleLarge, large_text: HOVER_TEXT, ...rank }
    // In the lobby/queue: big image = the game-mode icon (Summoner's Rift / ARAM / Arena…),
    // small image = your rank, and the queue name shows as the state line.
    const lobbyAssets = {
      large_image: this.modeIcon ?? idleLarge,
      large_text: this.lobbyQueue ?? 'League of Legends',
      ...rank
    }
    const party =
      cfg.showParty && this.party.size > 1
        ? { size: [this.party.size, Math.max(this.party.max, this.party.size)] as [number, number] }
        : undefined

    const withButton = (activity: DiscordActivity | null): DiscordActivity | null => {
      if (activity && cfg.showJoinButton) {
        activity.buttons = [{ label: 'Join the Discord', url: DISCORD_INVITE }]
      }
      return activity
    }

    // "Summoner's Rift (Ranked Solo/Duo)" — the map + queue, like the client's own presence.
    const mapQueue =
      this.mapName && this.lobbyQueue
        ? `${this.mapName} (${this.lobbyQueue})`
        : (this.lobbyQueue ?? this.mapName ?? undefined)

    switch (state.phase) {
      case 'Lobby':
        return withButton({
          details: mapQueue ?? 'In the lobby',
          state: 'In Lobby',
          timestamps: timer,
          assets: lobbyAssets,
          party
        })
      case 'Matchmaking':
        return withButton({
          details: mapQueue ?? 'League of Legends',
          state: 'In queue',
          timestamps: timer,
          assets: lobbyAssets,
          party
        })
      case 'ReadyCheck':
        return withButton({
          details: mapQueue ?? 'Match found',
          state: 'Match found',
          timestamps: timer,
          assets: lobbyAssets
        })
      case 'ChampSelect': {
        const champ = state.lobby?.players.find((p) => p.isLocalPlayer)?.champion
        if (champ?.id && champ.skinId) this.lastSkin = { championId: champ.id, skinId: champ.skinId }
        const large = this.largeImage(champ?.id ?? 0, champ?.name ?? '', champ?.skinId ?? 0, '', idleLarge)
        return withButton({
          details: mapQueue ?? state.lobby?.queueName ?? 'Champ select',
          state: champ?.name ? `Champ select · ${champ.name}` : 'In champ select',
          timestamps: timer,
          assets: { ...large, ...rank },
          party
        })
      }
      case 'InProgress': {
        const me = state.liveGame?.players.find(
          (p) => p.puuid && p.puuid === profile?.puuid
        )
        // The live API's skinID is unreliable (often 0); fall back to the champ-select pick.
        const liveSkin = me?.skinId ?? 0
        const skinId =
          liveSkin > 0
            ? liveSkin
            : this.lastSkin && this.lastSkin.championId === (me?.championId ?? 0)
              ? this.lastSkin.skinId
              : 0
        const large = this.largeImage(
          me?.championId ?? 0,
          me?.championName ?? '',
          skinId,
          me?.skinName ?? '',
          idleLarge
        )
        const kda =
          cfg.showStats && me
            ? ` · ${me.kills}/${me.deaths}/${me.assists} · ${me.creepScore} CS`
            : ''
        const stats = me ? `${me.championName}${kda}` : undefined
        const start = state.liveGame ? Date.now() - state.liveGame.gameTime * 1000 : this.phaseSince
        return withButton({
          details: state.liveGame?.queueName ?? 'In game',
          state: stats,
          timestamps: cfg.showTimer ? { start } : undefined,
          assets: { ...large, ...rank }
        })
      }
      case 'None':
      default:
        if (state.phase !== 'None' || !cfg.idleEnabled) return null
        if (cfg.idleMode === 'profile' && profile) {
          return withButton({
            details: `${profile.gameName}#${profile.tagLine}`,
            state: `Level ${profile.summonerLevel}`,
            timestamps: timer,
            assets: idleAssets
          })
        }
        return withButton({ details: cfg.idleText, timestamps: timer, assets: idleAssets })
    }
  }

  private setStatus(state: RpcStatus['state'], detail = ''): void {
    if (this.status.state === state && this.status.detail === detail) return
    this.status = { state, detail }
    console.log(`[rpc] ${state}${detail ? ` — ${detail}` : ''}`)
    this.onStatus(this.status)
  }
}
