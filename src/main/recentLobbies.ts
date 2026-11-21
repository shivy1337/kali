import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Lobby } from '../shared/types'

const MAX_LOBBIES = 10

/** Finished champ selects, newest first, persisted as JSON in the app's user-data folder. */
export class RecentLobbies {
  list: Lobby[] = []

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as unknown
      if (Array.isArray(parsed)) {
        this.list = (parsed as Lobby[])
          .filter((l) => l && typeof l.id === 'string' && Array.isArray(l.players))
          .slice(0, MAX_LOBBIES)
      }
    } catch {
      this.list = [] // first run or unreadable file
    }
  }

  async add(lobby: Lobby): Promise<void> {
    // Profile icons are not shown in the recent list; drop them to keep the file small.
    const slim: Lobby = {
      ...lobby,
      players: lobby.players.map((player) => ({
        ...player,
        profile: player.profile ? { ...player.profile, profileIconDataUrl: null } : null
      }))
    }
    this.list = [slim, ...this.list.filter((l) => l.id !== slim.id)].slice(0, MAX_LOBBIES)
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(this.list), 'utf8')
    } catch (error) {
      console.error('[recent] could not save recent lobbies', error)
    }
  }
}
