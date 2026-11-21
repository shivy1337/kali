import type { LiveGame, LivePlayer, RankedQueue } from '../../shared/types'
import type { ChampionData } from '../lcu/champions'
import type { LcuClient } from '../lcu/client'
import { fetchLiveClientData, type LiveClientPlayer } from '../lcu/liveClient'
import type { ProfileFetcher } from '../lcu/profile'

interface GfPlayer {
  puuid?: string
  championId?: number
  selectedPosition?: string
}

interface GfSession {
  gameData?: {
    queue?: { name?: string; description?: string }
    teamOne?: GfPlayer[]
    teamTwo?: GfPlayer[]
  }
}

const POLL_MS = 6000

function splitRiotId(live: LiveClientPlayer | undefined): { gameName: string; tagLine: string } {
  const riotId = live?.riotId ?? ''
  if (riotId.includes('#')) {
    const [gameName, tagLine] = riotId.split('#')
    return { gameName, tagLine }
  }
  return {
    gameName: live?.riotIdGameName ?? live?.summonerName ?? '',
    tagLine: live?.riotIdTagLine ?? ''
  }
}

/**
 * Builds the live-game roster while a game is in progress: identities + teams + champions come
 * from the gameflow session (which carries puuids), and live KDA / CS / items come from the
 * in-game Live Client Data API. Ranks are looked up per puuid and cached for the game.
 */
export class LiveGameTracker {
  current: LiveGame | null = null

  private timer: NodeJS.Timeout | null = null
  private running = false
  private busy = false
  private readonly rankCache = new Map<string, RankedQueue | null>()

  constructor(
    private readonly getClient: () => LcuClient | null,
    private readonly getLocalPuuid: () => string | null,
    private readonly profiles: ProfileFetcher,
    private readonly champions: ChampionData,
    private readonly onChange: (game: LiveGame | null) => void
  ) {}

  onPhase(previous: string, next: string): void {
    if (next === 'InProgress') this.start()
    else if (previous === 'InProgress') this.clear()
  }

  clear(): void {
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.rankCache.clear()
    if (this.current) {
      this.current = null
      this.onChange(null)
    }
  }

  private start(): void {
    if (this.running) return
    this.running = true
    void this.tick()
    this.timer = setInterval(() => void this.tick(), POLL_MS)
  }

  private async tick(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      const client = this.getClient()
      if (!client) return
      const [session, live] = await Promise.all([
        client.request<GfSession>('GET', '/lol-gameflow/v1/session').catch(() => null),
        fetchLiveClientData()
      ])
      const gameData = session?.gameData
      if (!gameData?.teamOne || !gameData.teamTwo) return

      // Join the live players to gameflow cells by champion id (unique within a draft game).
      const liveByChamp = new Map<number, LiveClientPlayer>()
      for (const lp of live?.allPlayers ?? []) {
        if (!lp.championName) continue
        const id = await this.champions.idByName(client, lp.championName)
        if (id) liveByChamp.set(id, lp)
      }

      const localPuuid = this.getLocalPuuid()
      const localInTwo = gameData.teamTwo.some((p) => p.puuid && p.puuid === localPuuid)
      const yourTeam = localInTwo ? gameData.teamTwo : gameData.teamOne
      const enemyTeam = localInTwo ? gameData.teamOne : gameData.teamTwo

      const build = (side: 'your' | 'enemy') => async (gf: GfPlayer): Promise<LivePlayer> => {
        const championId = gf.championId ?? 0
        const lp = liveByChamp.get(championId)
        const { gameName, tagLine } = splitRiotId(lp)
        return {
          puuid: gf.puuid ?? null,
          riotId: lp?.riotId ?? (gameName ? `${gameName}#${tagLine}` : ''),
          gameName,
          tagLine,
          championId,
          championName: lp?.championName ?? (await this.champions.name(client, championId)),
          skinId: lp?.skinID ?? 0,
          skinName: lp?.skinName ?? '',
          side,
          position: gf.selectedPosition ? gf.selectedPosition.toUpperCase() : null,
          level: lp?.level ?? 0,
          kills: lp?.scores?.kills ?? 0,
          deaths: lp?.scores?.deaths ?? 0,
          assists: lp?.scores?.assists ?? 0,
          creepScore: lp?.scores?.creepScore ?? 0,
          items: (lp?.items ?? [])
            .slice()
            .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
            .map((i) => i.itemID ?? 0)
            .filter((id) => id > 0),
          ranked: await this.rankFor(client, gf.puuid),
          isBot: lp?.isBot ?? false
        }
      }

      const players = [
        ...(await Promise.all(yourTeam.map(build('your')))),
        ...(await Promise.all(enemyTeam.map(build('enemy'))))
      ]
      if (!this.running) return
      this.current = {
        queueName: gameData.queue?.description ?? gameData.queue?.name ?? null,
        gameTime: Math.floor(live?.gameData?.gameTime ?? 0),
        players
      }
      this.onChange(this.current)
    } catch (error) {
      console.error('[live] failed to build live game', (error as Error).message)
    } finally {
      this.busy = false
    }
  }

  private async rankFor(client: LcuClient, puuid?: string): Promise<RankedQueue | null> {
    if (!puuid) return null
    const cached = this.rankCache.get(puuid)
    if (cached !== undefined) return cached
    const ranked = await this.profiles.rankedByPuuid(client, puuid)
    const solo = ranked?.solo ?? null
    this.rankCache.set(puuid, solo)
    return solo
  }
}
