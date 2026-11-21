import https from 'node:https'

export interface LiveClientPlayer {
  riotId?: string
  riotIdGameName?: string
  riotIdTagLine?: string
  summonerName?: string
  championName?: string
  skinID?: number
  skinName?: string
  team?: string
  level?: number
  isBot?: boolean
  scores?: { kills?: number; deaths?: number; assists?: number; creepScore?: number }
  items?: { itemID?: number; slot?: number }[]
}

export interface LiveClientData {
  gameData?: { gameTime?: number; gameMode?: string }
  allPlayers?: LiveClientPlayer[]
}

/**
 * The in-game Live Client Data API (https://127.0.0.1:2999), served only while a game is running.
 * No auth; self-signed certificate like the LCU. Returns `null` when no game is active.
 */
export function fetchLiveClientData(): Promise<LiveClientData | null> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: '127.0.0.1',
        port: 2999,
        path: '/liveclientdata/allgamedata',
        method: 'GET',
        rejectUnauthorized: false,
        timeout: 3000
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('error', () => resolve(null))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as LiveClientData)
          } catch {
            resolve(null)
          }
        })
      }
    )
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(null))
    req.end()
  })
}
