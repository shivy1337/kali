import https from 'node:https'
import type { LcuCredentials } from './credentials'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** The LCU answered, but with a non-2xx status (e.g. 404 while on the login screen). */
export class LcuHttpError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string
  ) {
    super(`LCU ${method} ${path} -> ${status}`)
    this.name = 'LcuHttpError'
  }
}

export interface RawResponse {
  contentType: string
  body: Buffer
}

const TIMEOUT_MS = 5000

export class LcuClient {
  private readonly agent: https.Agent
  private readonly authHeader: string

  constructor(readonly credentials: LcuCredentials) {
    // The LCU serves a self-signed Riot certificate on loopback only.
    this.agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true })
    this.authHeader =
      'Basic ' + Buffer.from(`riot:${credentials.password}`).toString('base64')
  }

  /** JSON request. Rejects with LcuHttpError on non-2xx, or a network error if the client is unreachable. */
  async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const response = await this.requestRaw(method, path, body)
    if (response.body.length === 0) return undefined as T
    return JSON.parse(response.body.toString('utf8')) as T
  }

  /** Same as `request` but returns the raw bytes (used for images). */
  requestRaw(method: HttpMethod, path: string, body?: unknown): Promise<RawResponse> {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: '127.0.0.1',
          port: this.credentials.port,
          path,
          method,
          agent: this.agent,
          timeout: TIMEOUT_MS,
          headers: {
            Authorization: this.authHeader,
            Accept: '*/*',
            ...(payload
              ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
              : {})
          }
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('error', reject)
          res.on('end', () => {
            const status = res.statusCode ?? 0
            if (status < 200 || status >= 300) {
              return reject(new LcuHttpError(status, method, path))
            }
            resolve({
              contentType: String(res.headers['content-type'] ?? 'application/octet-stream'),
              body: Buffer.concat(chunks)
            })
          })
        }
      )
      req.on('timeout', () => req.destroy(new Error(`LCU ${method} ${path} timed out`)))
      req.on('error', reject)
      req.end(payload)
    })
  }

  dispose(): void {
    this.agent.destroy()
  }
}
