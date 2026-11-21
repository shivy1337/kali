import {
  DEFAULT_RPC_SETTINGS,
  effectiveAppId,
  INITIAL_RPC_STATUS,
  type RpcSettings,
  type RpcStatus
} from '../../shared/rpc'
import type { GamePhase, LiveGame, Lobby, Profile, RankedQueue } from '../../shared/types'
import { DiscordClient, type DiscordActivity } from './discordClient'

/** Everything the presence is built from — fed from Kali's existing LCU state. */
export interface PresenceState {
  /** Is League (the LCU) connected? When false we clear presence. */
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

function capitalize(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function rankText(rank: RankedQueue): string {
  if (!rank.tier) return 'Unranked'
  const name = rank.division ? `${capitalize(rank.tier)} ${rank.division}` : capitalize(rank.tier)
  return `${name} · ${rank.leaguePoints} LP`
}

/** Idle, lobby, queue, champ select and in-game phases map to active presence; the rest clear it. */
const ACTIVE = new Set(['None', 'Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect', 'InProgress'])

/**
 * Turns Kali's LCU state into a Discord Rich Presence and keeps it in sync, reconnecting to Discord
 * on its own. Images are plain Community Dragon URLs (no asset uploads / tokens needed).
 */
export class PresenceManager {
  private readonly client: DiscordClient
  private settings: RpcSettings = DEFAULT_RPC_SETTINGS
  private state: PresenceState | null = null
  private phaseSince = Date.now()
  private lastPhase = ''
  private lastActivityJson = ''
  private status: RpcStatus = INITIAL_RPC_STATUS

  constructor(private readonly onStatus: (status: RpcStatus) => void) {
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
    this.rebuild()
  }

  stop(): void {
    this.client.stop()
  }

  /** Start / stop the Discord connection based on the settings. */
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

  private rebuild(): void {
    if (!this.settings.enabled || !effectiveAppId(this.settings) || !this.client.connected) return
    const activity = this.build()
    const json = JSON.stringify(activity)
    if (json === this.lastActivityJson) return
    this.lastActivityJson = json
    this.client.setActivity(activity)
    this.setStatus('connected', activity ? `${activity.details ?? ''} ${activity.state ?? ''}`.trim() : 'Idle')
  }

  private build(): DiscordActivity | null {
    const state = this.state
    if (!state || !state.connected) return null // League closed: no presence
    const cfg = this.settings
    const solo = cfg.showRank ? (state.profile?.ranked?.solo ?? null) : null
    const small =
      solo && solo.tier
        ? { small_image: rankEmblem(solo.tier), small_text: rankText(solo) }
        : {}
    const timer = cfg.showTimer ? { start: this.phaseSince } : undefined
    const idleLarge = state.profile ? profileIcon(state.profile.profileIconId) : undefined

    const base = (details: string, extra?: Partial<DiscordActivity>): DiscordActivity => ({
      details,
      timestamps: timer,
      assets: { large_image: idleLarge, large_text: 'League of Legends', ...small },
      ...extra
    })

    switch (state.phase) {
      case 'Lobby':
        return base('In the lobby')
      case 'Matchmaking':
        return base('In queue')
      case 'ReadyCheck':
        return base('Match found')
      case 'ChampSelect': {
        const champ = state.lobby?.players.find((p) => p.isLocalPlayer)?.champion
        const assets =
          cfg.showChampion && champ
            ? { large_image: championIcon(champ.id), large_text: champ.name, ...small }
            : { large_image: idleLarge, large_text: 'League of Legends', ...small }
        return { details: 'In champ select', state: champ?.name, timestamps: timer, assets }
      }
      case 'InProgress': {
        const me = state.liveGame?.players.find(
          (p) => p.puuid && p.puuid === state.profile?.puuid
        )
        const start = state.liveGame
          ? Date.now() - state.liveGame.gameTime * 1000
          : this.phaseSince
        const assets =
          cfg.showChampion && me
            ? { large_image: championIcon(me.championId), large_text: me.championName, ...small }
            : { large_image: idleLarge, large_text: 'League of Legends', ...small }
        return {
          details: me ? `Playing ${me.championName}` : 'In game',
          state: state.liveGame?.queueName ?? undefined,
          timestamps: cfg.showTimer ? { start } : undefined,
          assets
        }
      }
      case 'None':
      default:
        if (!ACTIVE.has(state.phase) || !cfg.idleEnabled) return null
        return base(cfg.idleText)
    }
  }

  private setStatus(state: RpcStatus['state'], detail = ''): void {
    if (this.status.state === state && this.status.detail === detail) return
    this.status = { state, detail }
    console.log(`[rpc] ${state}${detail ? ` — ${detail}` : ''}`)
    this.onStatus(this.status)
  }
}
