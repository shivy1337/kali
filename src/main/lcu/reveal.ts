import type { RiotClient } from './riotClient'

interface RcParticipant {
  cid?: string
  puuid?: string
  game_name?: string
  game_tag?: string
}

export interface RevealId {
  puuid: string
  gameName: string
  tagLine: string
}

const REFRESH_MS = 3000

/**
 * Reveals ranked-hidden champ-select teammates. The League client anonymises solo-queue teammates
 * (empty puuid, only an obfuscated id), but the **Riot Client**'s chat participants
 * (`/chat/v5/participants`, cid ~ "champ-select") still carry everyone's real gameName/tag/puuid.
 * We use that roster as the source of truth and map it onto the champ-select cells.
 */
export class ChampSelectReveal {
  private roster: RevealId[] = []
  private lastFetch = 0
  private logged = false

  constructor(private readonly riot: RiotClient) {}

  reset(): void {
    this.roster = []
    this.lastFetch = 0
    this.logged = false
  }

  /** The current champ-select team's real identities (incl. the local player). */
  async resolve(): Promise<RevealId[]> {
    if (Date.now() - this.lastFetch < REFRESH_MS) return this.roster
    this.lastFetch = Date.now()
    try {
      const data = await this.riot.request<{ participants?: RcParticipant[] }>(
        '/chat/v5/participants'
      )
      const inChampSelect = (data?.participants ?? []).filter(
        (p) => p.cid?.includes('champ-select') && p.puuid && p.game_name
      )
      if (inChampSelect.length > 0) {
        this.roster = inChampSelect.map((p) => ({
          puuid: p.puuid!,
          gameName: p.game_name!,
          tagLine: p.game_tag ?? ''
        }))
      }
      if (!this.logged && this.roster.length > 0) {
        this.logged = true
        console.log(
          `[reveal] riot-client roster: ${this.roster.length}`,
          this.roster.map((r) => `${r.gameName}#${r.tagLine}`)
        )
      }
    } catch {
      // Riot Client gone / request failed: keep whatever we had.
    }
    return this.roster
  }
}
