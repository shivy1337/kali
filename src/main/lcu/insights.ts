import type { PlayerInsights, RecentForm } from '../../shared/types'
import type { ChampionData } from './champions'
import type { LcuClient } from './client'

interface LcuMastery {
  championId: number
  championLevel: number
  championPoints: number
}

interface LcuMatchList {
  games?: {
    games?: {
      queueId?: number
      participants?: { stats?: { win?: boolean } }[]
    }[]
  }
}

const RANKED_SOLO_QUEUE = 420
const MOST_PLAYED_COUNT = 3
/** How far back to look for recent ranked games. */
const MATCH_WINDOW = 20

/** Extra per-player context shown in champ select: most played champions and recent form. */
export class InsightsFetcher {
  constructor(private readonly champions: ChampionData) {}

  /** Never throws; parts that cannot be loaded come back empty / null. */
  async fetch(client: LcuClient, puuid: string): Promise<PlayerInsights> {
    const [mostPlayed, recentSolo] = await Promise.all([
      this.mostPlayed(client, puuid).catch(() => []),
      this.recentSolo(client, puuid).catch(() => null)
    ])
    return { mostPlayed, recentSolo }
  }

  private async mostPlayed(client: LcuClient, puuid: string): Promise<PlayerInsights['mostPlayed']> {
    const list = await client.request<LcuMastery[]>(
      'GET',
      `/lol-champion-mastery/v1/${encodeURIComponent(puuid)}/champion-mastery`
    )
    if (!Array.isArray(list)) return []
    const top = [...list]
      .sort((a, b) => (b.championPoints ?? 0) - (a.championPoints ?? 0))
      .slice(0, MOST_PLAYED_COUNT)
    return Promise.all(
      top.map(async (entry) => ({
        championId: entry.championId,
        name: await this.champions.name(client, entry.championId),
        level: entry.championLevel ?? 0,
        points: entry.championPoints ?? 0
      }))
    )
  }

  /** Ranked Solo/Duo results among the player's last 20 games. */
  private async recentSolo(client: LcuClient, puuid: string): Promise<RecentForm | null> {
    const history = await client.request<LcuMatchList>(
      'GET',
      `/lol-match-history/v1/products/lol/${encodeURIComponent(puuid)}/matches?begIndex=0&endIndex=${MATCH_WINDOW - 1}`
    )
    const games = (history?.games?.games ?? []).filter((g) => g.queueId === RANKED_SOLO_QUEUE)
    if (games.length === 0) return null
    const wins = games.filter((g) => g.participants?.[0]?.stats?.win === true).length
    return {
      games: games.length,
      wins,
      losses: games.length - wins,
      winrate: Math.round((wins / games.length) * 100)
    }
  }
}
