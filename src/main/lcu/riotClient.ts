import { readFile } from 'node:fs/promises'
import https from 'node:https'
import { join } from 'node:path'

const RC_LOCKFILE = join(
  process.env['LOCALAPPDATA'] ?? '',
  'Riot Games',
  'Riot Client',
  'Config',
  'lockfile'
)

/**
 * The Riot Client's local API (a separate service from the League client). Its chat layer still
 * carries the real identity of champ-select players that the League client anonymises in ranked —
 * that's how teammate reveal works. Credentials come from the Riot Client's own lockfile.
 */
export class RiotClient {
  private port = 0
  private auth = ''
  private lastRead = 0
  private readonly agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true })

  private async ensureCredentials(): Promise<boolean> {
    if (this.port && Date.now() - this.lastRead < 15_000) return true
    try {
      const parts = (await readFile(RC_LOCKFILE, 'utf8')).trim().split(':')
      const port = Number(parts[2])
      if (!Number.isInteger(port) || port <= 0 || !parts[3]) return false
      this.port = port
      this.auth = 'Basic ' + Buffer.from(`riot:${parts[3]}`).toString('base64')
      this.lastRead = Date.now()
      return true
    } catch {
      return false
    }
  }

  /** GET a Riot Client endpoint; `null` if the client is absent or the request fails. */
  async request<T>(path: string): Promise<T | null> {
    if (!(await this.ensureCredentials())) return null
    return new Promise((resolve) => {
      const req = https.request(
        {
          host: '127.0.0.1',
          port: this.port,
          path,
          method: 'GET',
          agent: this.agent,
          timeout: 4000,
          headers: { Authorization: this.auth, Accept: 'application/json' }
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('error', () => resolve(null))
          res.on('end', () => {
            const status = res.statusCode ?? 0
            if (status < 200 || status >= 300) return resolve(null)
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T)
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
}
