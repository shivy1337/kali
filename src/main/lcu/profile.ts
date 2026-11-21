import type { Profile, RankedQueue } from '../../shared/types'
import type { LcuClient } from './client'

interface LcuSummoner {
  gameName: string
  tagLine: string
  summonerLevel: number
  profileIconId: number
  puuid: string
}

interface LcuRankedEntry {
  queueType: string
  tier: string
  division: string
  leaguePoints: number
  wins: number
  losses: number
}

interface LcuRankedStats {
  queues?: LcuRankedEntry[]
  queueMap?: Record<string, LcuRankedEntry>
}

interface LcuRegionLocale {
  region: string
}

const UNRANKED: RankedQueue = {
  tier: null,
  division: null,
  leaguePoints: 0,
  wins: 0,
  losses: 0,
  winrate: null
}

function toRankedQueue(entry: LcuRankedEntry | undefined): RankedQueue {
  if (!entry) return UNRANKED
  const tier = entry.tier && entry.tier !== 'NONE' ? entry.tier.toUpperCase() : null
  const wins = entry.wins ?? 0
  const losses = entry.losses ?? 0
  const games = wins + losses
  return {
    tier,
    // The LCU reports "NA" as the division for unranked and for Master+.
    division: tier && entry.division && entry.division !== 'NA' ? entry.division : null,
    leaguePoints: entry.leaguePoints ?? 0,
    wins,
    losses,
    winrate: games > 0 ? Math.round((wins / games) * 100) : null
  }
}

function findQueue(stats: LcuRankedStats, queueType: string): LcuRankedEntry | undefined {
  return stats.queueMap?.[queueType] ?? stats.queues?.find((q) => q.queueType === queueType)
}

/** Fetch an image through the LCU as a `data:` URL; `null` on any failure. */
export async function fetchImage(client: LcuClient, path: string): Promise<string | null> {
  try {
    const { body, contentType } = await client.requestRaw('GET', path)
    if (!contentType.startsWith('image/') || body.length === 0) return null
    return `data:${contentType.split(';')[0]};base64,${body.toString('base64')}`
  } catch {
    return null
  }
}

export interface ProfileResult {
  profile: Profile
  /** False when ranked stats or the icon were not available yet and should be retried soon. */
  complete: boolean
}

export class ProfileFetcher {
  private readonly iconCache = new Map<number, string>()
  private region: string | null = null

  /** Call when the client instance changes. */
  reset(): void {
    this.region = null
  }

  /**
   * The logged-in player. Throws if the summoner is not available (login screen / client
   * still booting). Ranked stats, icon and region are best-effort.
   */
  async fetchCurrent(client: LcuClient): Promise<ProfileResult> {
    const summoner = await client.request<LcuSummoner>('GET', '/lol-summoner/v1/current-summoner')
    if (!summoner?.puuid) throw new Error('Summoner not loaded yet')
    return this.build(client, summoner, '/lol-ranked/v1/current-ranked-stats')
  }

  /** Any player on this platform, by PUUID. Throws if the summoner lookup fails. */
  async fetchByPuuid(client: LcuClient, puuid: string): Promise<ProfileResult> {
    const id = encodeURIComponent(puuid)
    const summoner = await client.request<LcuSummoner>(
      'GET',
      `/lol-summoner/v2/summoners/puuid/${id}`
    )
    if (!summoner?.puuid) throw new Error('Summoner not found')
    return this.build(client, summoner, `/lol-ranked/v1/ranked-stats/${id}`)
  }

  /** Just the ranked queues for any player, by PUUID (for the live-game roster). `null` on failure. */
  async rankedByPuuid(client: LcuClient, puuid: string): Promise<Profile['ranked']> {
    try {
      const stats = await client.request<LcuRankedStats>(
        'GET',
        `/lol-ranked/v1/ranked-stats/${encodeURIComponent(puuid)}`
      )
      return {
        solo: toRankedQueue(findQueue(stats, 'RANKED_SOLO_5x5')),
        flex: toRankedQueue(findQueue(stats, 'RANKED_FLEX_SR'))
      }
    } catch {
      return null
    }
  }

  private async build(
    client: LcuClient,
    summoner: LcuSummoner,
    rankedPath: string
  ): Promise<ProfileResult> {
    const [ranked, icon, region] = await Promise.all([
      client
        .request<LcuRankedStats>('GET', rankedPath)
        .then((stats) => ({
          solo: toRankedQueue(findQueue(stats, 'RANKED_SOLO_5x5')),
          flex: toRankedQueue(findQueue(stats, 'RANKED_FLEX_SR'))
        }))
        .catch(() => null),
      this.fetchIcon(client, summoner.profileIconId),
      this.fetchRegion(client)
    ])

    return {
      profile: {
        puuid: summoner.puuid,
        gameName: summoner.gameName,
        tagLine: summoner.tagLine,
        region,
        summonerLevel: summoner.summonerLevel,
        profileIconId: summoner.profileIconId,
        profileIconDataUrl: icon,
        ranked
      },
      complete: ranked !== null && icon !== null
    }
  }

  private async fetchIcon(client: LcuClient, id: number): Promise<string | null> {
    const cached = this.iconCache.get(id)
    if (cached) return cached
    const dataUrl = await fetchImage(client, `/lol-game-data/assets/v1/profile-icons/${id}.jpg`)
    if (dataUrl) {
      if (this.iconCache.size > 200) this.iconCache.clear()
      this.iconCache.set(id, dataUrl)
    }
    return dataUrl
  }

  private async fetchRegion(client: LcuClient): Promise<string | null> {
    if (this.region) return this.region
    try {
      const locale = await client.request<LcuRegionLocale>('GET', '/riotclient/region-locale')
      this.region = locale?.region?.toUpperCase() || null
    } catch {
      this.region = null
    }
    return this.region
  }
}
