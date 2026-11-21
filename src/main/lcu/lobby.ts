import type {
  Lobby,
  LobbyOutcome,
  LobbyPlayer,
  PlayerInsights,
  Profile
} from '../../shared/types'
import type { ChampionData } from './champions'
import type { LcuClient } from './client'
import type { InsightsFetcher } from './insights'
import type { ProfileFetcher } from './profile'
import { ChampSelectReveal, type RevealData, type RevealId } from './reveal'

interface PlayerLookup {
  profile: Profile | null
  insights: PlayerInsights | null
}

const NO_PLAYER: PlayerLookup = { profile: null, insights: null }

/** The parts of `/lol-champ-select/v1/session` we read. Everything is optional on purpose. */
interface LcuChampSelectPlayer {
  cellId?: number
  championId?: number
  championPickIntent?: number
  assignedPosition?: string
  puuid?: string
  gameName?: string
  tagLine?: string
  /** 1 = blue (ORDER), 2 = red (CHAOS). */
  team?: number
  /** Stable per-cell id present even under ranked anonymity; maps to the chat room's real identity. */
  obfuscatedPuuid?: string
  nameVisibilityType?: string
}

/** Your team's side from the local player's cell. */
function sideOf(session: LcuChampSelectSession): 'blue' | 'red' | null {
  const local = session.myTeam?.find((p) => p.cellId === session.localPlayerCellId)
  return local?.team === 1 ? 'blue' : local?.team === 2 ? 'red' : null
}

/**
 * Which team gets the last pick, relative to you. `null` when picks are simultaneous (blind/ARAM),
 * where "last pick" has no meaning. In standard draft this is the red side.
 */
function lastPickSide(session: LcuChampSelectSession): 'your' | 'enemy' | null {
  const groups = session.actions ?? []
  const pickGroups = groups.filter((g) => g?.some((a) => a.type === 'pick'))
  if (pickGroups.length <= 1) return null // simultaneous picks: no last pick

  let lastCell: number | null = null
  for (const group of groups) {
    for (const action of group ?? []) {
      if (action.type === 'pick' && typeof action.actorCellId === 'number') {
        lastCell = action.actorCellId
      }
    }
  }
  if (lastCell === null) return null
  const mine = new Set(session.myTeam?.map((p) => p.cellId))
  return mine.has(lastCell) ? 'your' : 'enemy'
}

/** Decide which real identity (if any) belongs to each champ-select cell. */
function assignReveals(
  myTeam: LcuChampSelectPlayer[],
  data: RevealData
): Map<number, RevealId> {
  const assigned = new Map<number, RevealId>()
  const used = new Set<string>()

  // Exact: cells with a real puuid, or a hidden cell whose obfuscated id the chat bridged.
  for (const player of myTeam) {
    const cellId = player.cellId ?? -1
    let id: RevealId | undefined
    if (player.puuid && player.puuid !== EMPTY_PUUID) {
      id = data.roster.find((r) => r.puuid === player.puuid) ?? {
        puuid: player.puuid,
        gameName: player.gameName ?? '',
        tagLine: player.tagLine ?? ''
      }
    } else if (player.obfuscatedPuuid) {
      id = data.byObfuscated.get(player.obfuscatedPuuid)
    }
    if (id) {
      assigned.set(cellId, id)
      used.add(id.puuid)
    }
  }

  // Fallback: hand the still-unmatched roster names to the remaining hidden cells, in order.
  const leftover = data.roster.filter((r) => !used.has(r.puuid))
  let next = 0
  for (const player of myTeam) {
    const cellId = player.cellId ?? -1
    if (assigned.has(cellId) || !player.obfuscatedPuuid || next >= leftover.length) continue
    assigned.set(cellId, leftover[next++])
  }
  return assigned
}

interface LcuChampSelectAction {
  actorCellId?: number
  championId?: number
  type?: string
  completed?: boolean
}

export interface LcuChampSelectSession {
  myTeam?: LcuChampSelectPlayer[]
  actions?: LcuChampSelectAction[][]
  localPlayerCellId?: number
}

interface LcuGameflowSession {
  gameData?: { queue?: { description?: string; name?: string } }
}

const EMPTY_PUUID = '00000000-0000-0000-0000-000000000000'

function lockedCells(session: LcuChampSelectSession): Set<number> {
  const locked = new Set<number>()
  for (const group of session.actions ?? []) {
    for (const action of group ?? []) {
      if (action?.type === 'pick' && action.completed && typeof action.actorCellId === 'number') {
        locked.add(action.actorCellId)
      }
    }
  }
  return locked
}

/**
 * Turns champ select session events into `Lobby` snapshots.
 * Teammate profiles are looked up once per champ select and cached by PUUID.
 */
export class LobbyTracker {
  current: Lobby | null = null

  private profileCache = new Map<string, Promise<PlayerLookup>>()
  private queueName: Promise<string | null> | null = null
  private readonly reveal = new ChampSelectReveal()
  private startedAt = 0
  private sequence = 0

  constructor(
    private readonly profiles: ProfileFetcher,
    private readonly champions: ChampionData,
    private readonly insights: InsightsFetcher,
    private readonly onChange: (lobby: Lobby | null) => void,
    private readonly onFinished: (lobby: Lobby) => void
  ) {}

  /** Feed every session create/update here. */
  async update(client: LcuClient, session: LcuChampSelectSession): Promise<void> {
    if (!session || !Array.isArray(session.myTeam)) return
    const sequence = ++this.sequence
    if (this.startedAt === 0) {
      this.startedAt = Date.now()
      this.queueName = client
        .request<LcuGameflowSession>('GET', '/lol-gameflow/v1/session')
        .then((s) => s?.gameData?.queue?.description || s?.gameData?.queue?.name || null)
        .catch(() => null)
    }
    const startedAt = this.startedAt
    const locked = lockedCells(session)
    // Real identities for hidden (ranked) teammates, from the champ-select chat room.
    const reveals = assignReveals(session.myTeam, await this.reveal.resolve(client))

    const [queueName, players] = await Promise.all([
      this.queueName,
      Promise.all(
        session.myTeam.map(async (player, index): Promise<LobbyPlayer> => {
          const cellId = player.cellId ?? index
          const revealed = reveals.get(cellId)
          const picked = player.championId ?? 0
          const championId = picked > 0 ? picked : (player.championPickIntent ?? 0)
          const [lookup, championName] = await Promise.all([
            this.profileFor(client, player, revealed),
            championId > 0 ? this.champions.name(client, championId) : null
          ])
          // Fall back to the chat-provided name when the summoner lookup didn't carry one.
          const profile =
            lookup.profile && revealed && !lookup.profile.gameName
              ? { ...lookup.profile, gameName: revealed.gameName, tagLine: revealed.tagLine }
              : lookup.profile
          return {
            cellId,
            isLocalPlayer: cellId === session.localPlayerCellId,
            position: player.assignedPosition ? player.assignedPosition.toUpperCase() : null,
            champion:
              championId > 0 && championName
                ? { id: championId, name: championName, locked: picked > 0 && locked.has(cellId) }
                : null,
            profile,
            insights: lookup.insights
          }
        })
      )
    ])

    // A newer event (or the end of champ select) arrived while we were looking things up.
    if (sequence !== this.sequence || this.startedAt !== startedAt) return
    this.current = {
      id: `cs-${startedAt}`,
      startedAt,
      queueName,
      players,
      side: sideOf(session),
      lastPick: lastPickSide(session)
    }
    this.onChange(this.current)
  }

  /** Champ select is over (the gameflow phase moved on): archive it with its outcome. */
  finish(outcome: LobbyOutcome): void {
    const finished = this.current
    this.clear()
    if (finished && finished.players.length > 0) this.onFinished({ ...finished, outcome })
  }

  /** Drop the live lobby without archiving (client went away). */
  clear(): void {
    this.sequence++
    this.startedAt = 0
    this.queueName = null
    this.profileCache = new Map()
    this.reveal.reset()
    if (this.current) {
      this.current = null
      this.onChange(null)
    }
  }

  private profileFor(
    client: LcuClient,
    player: LcuChampSelectPlayer,
    revealed: RevealId | undefined
  ): Promise<PlayerLookup> {
    // Prefer the client's real puuid; otherwise the reveal-resolved one for a hidden cell.
    const puuid =
      player.puuid && player.puuid !== EMPTY_PUUID ? player.puuid : revealed?.puuid
    if (!puuid || puuid === EMPTY_PUUID) {
      return Promise.resolve(NO_PLAYER)
    }
    let pending = this.profileCache.get(puuid)
    if (!pending) {
      pending = Promise.all([
        this.profiles.fetchByPuuid(client, puuid),
        this.insights.fetch(client, puuid)
      ])
        .then(([result, insights]): PlayerLookup => ({ profile: result.profile, insights }))
        .catch(() => {
          this.profileCache.delete(puuid) // let the next session update retry
          return NO_PLAYER
        })
      this.profileCache.set(puuid, pending)
    }
    return pending
  }
}
