import type { LcuClient } from './client'

interface ChatParticipant {
  cid?: string
  puuid?: string
  gameName?: string
  gameTag?: string
}

interface ChatConversation {
  id: string
  type: string
}

interface ChatMessage {
  fromPid?: string
  fromId?: string
  fromPuuid?: string
  fromObfuscatedPuuid?: string
}

export interface RevealId {
  puuid: string
  gameName: string
  tagLine: string
}

export interface RevealData {
  /** Hidden cell's `obfuscatedPuuid` -> real identity (exact seat mapping, when the chat leaks it). */
  byObfuscated: Map<string, RevealId>
  /** All champ-select teammates with a real identity, from the chat roster. */
  roster: RevealId[]
}

const REFRESH_MS = 3000

function realPuuid(message: ChatMessage): string | null {
  const candidate =
    message.fromPuuid ||
    (message.fromPid?.includes('@') ? message.fromPid.split('@')[0] : '') ||
    (message.fromId?.includes('@') ? message.fromId.split('@')[0] : '')
  return candidate && candidate.length >= 32 ? candidate : null
}

/**
 * Reveals ranked-hidden teammates the way steele123/reveal does: the champ-select chat roster
 * (`/chat/v5/participants`, cid ~ "champ-select") carries each teammate's real gameName/tag/puuid,
 * even when the champ-select session hides them. We also bridge the session's per-cell
 * `obfuscatedPuuid` to a real identity through the chat messages, so hidden seats map exactly when
 * the client leaks that link; otherwise the roster is assigned to the remaining hidden seats.
 */
export class ChampSelectReveal {
  private byObfuscated = new Map<string, RevealId>()
  private roster: RevealId[] = []
  private lastFetch = 0
  private logged = false

  reset(): void {
    this.byObfuscated = new Map()
    this.roster = []
    this.lastFetch = 0
    this.logged = false
  }

  async resolve(client: LcuClient): Promise<RevealData> {
    if (Date.now() - this.lastFetch < REFRESH_MS) {
      return { byObfuscated: this.byObfuscated, roster: this.roster }
    }
    this.lastFetch = Date.now()

    const roster = await this.fetchRoster(client)
    if (roster.length > 0) this.roster = roster
    await this.bridgeObfuscated(client)

    return { byObfuscated: this.byObfuscated, roster: this.roster }
  }

  private async fetchRoster(client: LcuClient): Promise<RevealId[]> {
    try {
      const participants = await client.request<ChatParticipant[]>('GET', '/chat/v5/participants')
      const inChampSelect = participants.filter(
        (p) => p.cid?.includes('champ-select') && p.puuid && p.gameName
      )
      if (!this.logged) {
        this.logged = true
        console.log(
          `[reveal] champ-select chat roster: ${inChampSelect.length} participants`,
          inChampSelect.map((p) => `${p.gameName}#${p.gameTag ?? ''}=${(p.puuid ?? '').slice(0, 8)}`)
        )
      }
      return inChampSelect.map((p) => ({
        puuid: p.puuid!,
        gameName: p.gameName!,
        tagLine: p.gameTag ?? ''
      }))
    } catch {
      return []
    }
  }

  private async bridgeObfuscated(client: LcuClient): Promise<void> {
    try {
      const conversations = await client.request<ChatConversation[]>(
        'GET',
        '/lol-chat/v1/conversations'
      )
      const room = conversations.find((c) => c.type === 'championSelect')
      if (!room) return
      const messages = await client.request<ChatMessage[]>(
        'GET',
        `/lol-chat/v1/conversations/${encodeURIComponent(room.id)}/messages`
      )
      for (const message of messages) {
        const obfuscated = message.fromObfuscatedPuuid
        const real = realPuuid(message)
        if (!obfuscated || !real || real === obfuscated) continue
        const identity = this.roster.find((r) => r.puuid === real) ?? {
          puuid: real,
          gameName: '',
          tagLine: ''
        }
        this.byObfuscated.set(obfuscated, identity)
      }
    } catch {
      // No exact bridge available; the roster fallback still reveals names.
    }
  }
}
