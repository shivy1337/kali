import type { ChampionSummary } from '../../shared/types'
import type { LcuClient } from './client'
import { fetchImage } from './profile'

interface LcuChampionSummary {
  id: number
  name: string
  roles?: string[]
}

/** Champion names and icons from the client's game data, cached for the app's lifetime. */
export class ChampionData {
  private names: Map<number, string> | null = null
  private byName: Map<string, number> | null = null
  private summary: ChampionSummary[] | null = null
  private skinsByName: Map<string, number> | null = null
  private readonly icons = new Map<number, string>()

  private async ensure(client: LcuClient): Promise<void> {
    if (this.names) return
    const list = await client.request<LcuChampionSummary[]>(
      'GET',
      '/lol-game-data/assets/v1/champion-summary.json'
    )
    this.names = new Map(list.map((c) => [c.id, c.name]))
    // champion-summary.json carries alternate entries per champion (e.g. event-mode ids 60000+).
    // Sort by id ascending and keep the first of each name, so the real (canonical, lowest) id wins
    // — the gameflow/champ-select sessions use those real ids.
    const seen = new Set<string>()
    const unique = [...list]
      .filter((c) => c.id > 0)
      .sort((a, b) => a.id - b.id)
      .filter((c) => !seen.has(c.name) && seen.add(c.name))
    this.byName = new Map(unique.map((c) => [c.name.toLowerCase(), c.id]))
    this.summary = unique
      .map((c) => ({ id: c.id, name: c.name, roles: c.roles ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async name(client: LcuClient, id: number): Promise<string> {
    try {
      await this.ensure(client)
    } catch {
      return `Champion ${id}` // not cached: retried on the next call
    }
    return this.names?.get(id) ?? `Champion ${id}`
  }

  /** Champion id for a name (from the live-game API); `null` if unknown. */
  async idByName(client: LcuClient, name: string): Promise<number | null> {
    try {
      await this.ensure(client)
    } catch {
      return null
    }
    return this.byName?.get(name.toLowerCase()) ?? null
  }

  /** Full champion list (id, name, roles) for the picker UI; empty if it can't be loaded. */
  async list(client: LcuClient | null): Promise<ChampionSummary[]> {
    if (!client) return this.summary ?? []
    try {
      await this.ensure(client)
    } catch {
      return []
    }
    return this.summary ?? []
  }

  /**
   * Full skin id for a skin's display name (e.g. "Pentakill Olaf" -> 2004). Resolves the in-game
   * tile from the name the client reports, which stays correct even when the numeric skin id is
   * 0 — including skins applied by a skin changer that the account doesn't own. `null` if unknown.
   */
  async skinIdByName(client: LcuClient, name: string): Promise<number | null> {
    if (!name) return null
    try {
      if (!this.skinsByName) {
        const data = await client.request<Record<string, { id?: number; name?: string }>>(
          'GET',
          '/lol-game-data/assets/v1/skins.json'
        )
        const map = new Map<string, number>()
        for (const entry of Object.values(data)) {
          if (entry?.name && typeof entry.id === 'number') map.set(entry.name.toLowerCase(), entry.id)
        }
        this.skinsByName = map
      }
    } catch {
      return null // not cached: retried on the next call
    }
    return this.skinsByName.get(name.toLowerCase()) ?? null
  }

  async icon(client: LcuClient | null, id: number): Promise<string | null> {
    const cached = this.icons.get(id)
    if (cached) return cached
    if (!client || !Number.isInteger(id) || id <= 0) return null
    const dataUrl = await fetchImage(client, `/lol-game-data/assets/v1/champion-icons/${id}.png`)
    if (dataUrl) this.icons.set(id, dataUrl)
    return dataUrl
  }
}
