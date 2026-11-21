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
const splashArt = (championId: number, skinId: number): string => {
  const num = skinId >= 1000 ? skinId % 1000 : skinId // champ select gives full ids, live gives the number
  return `https://cdn.communitydragon.org/latest/champion/${championId}/splash-art/skin/${num}`
}

const capitalize = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase()

// Shown when hovering the large image (the app/brand); the bold line above it is the Discord
// application's name, which the user sets on the dev portal (e.g. "League of Legends").
const HOVER_TEXT = 'discord.gg/kaliapp'

const PARTY_PHASES = new Set(['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'])
const PARTY_TTL_MS = 4000

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
    if (!this.settings.enabled || !this.settings.showParty || !PARTY_PHASES.has(state.phase)) {
      if (this.party.size !== 0) {
        this.party = { size: 0, max: 0, at: 0 }
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
        gameConfig?: { maxLobbySize?: number }
      }>('GET', '/lol-lobby/v2/lobby')
      const size = lobby?.members?.length ?? 0
      const max = lobby?.gameConfig?.maxLobbySize ?? size
      if (size !== this.party.size || max !== this.party.max) {
        this.party = { size, max, at: Date.now() }
        this.rebuild()
      }
    } catch {
      // Not in a lobby (solo queue dodge etc.): leave party as-is.
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
    // The skin/champion name goes in the hover tooltip when known, otherwise the brand.
    if (this.settings.useSkinSplash && championId > 0) {
      return { large_image: splashArt(championId, skinId), large_text: skinName || championName }
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

    switch (state.phase) {
      case 'Lobby':
        return withButton({ details: 'In the lobby', timestamps: timer, assets: idleAssets, party })
      case 'Matchmaking':
        return withButton({ details: 'In queue', timestamps: timer, assets: idleAssets, party })
      case 'ReadyCheck':
        return withButton({ details: 'Match found', timestamps: timer, assets: idleAssets })
      case 'ChampSelect': {
        const champ = state.lobby?.players.find((p) => p.isLocalPlayer)?.champion
        const large = this.largeImage(champ?.id ?? 0, champ?.name ?? '', champ?.skinId ?? 0, '', idleLarge)
        return withButton({
          details: state.lobby?.queueName ?? 'Champ select',
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
        const large = this.largeImage(
          me?.championId ?? 0,
          me?.championName ?? '',
          me?.skinId ?? 0,
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
