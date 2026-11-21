import WebSocket from 'ws'
import type { LcuCredentials } from './credentials'

export interface LcuEvent {
  uri: string
  /** "Create" | "Update" | "Delete" */
  eventType: string
  data: unknown
}

// WAMP 1.0 message types used by the LCU.
const WAMP_SUBSCRIBE = 5
const WAMP_EVENT = 8

/** `/lol-gameflow/v1/gameflow-phase` -> `OnJsonApiEvent_lol-gameflow_v1_gameflow-phase` */
function topicFor(uri: string): string {
  return 'OnJsonApiEvent' + uri.replace(/\//g, '_')
}

/**
 * Live event feed from the client. Subscribes to the given endpoint URIs and reports every
 * change. Never throws; `onClose` fires once when the socket ends for any reason.
 */
export class LcuSocket {
  private readonly ws: WebSocket
  private closed = false

  constructor(
    credentials: LcuCredentials,
    uris: string[],
    handlers: { onOpen(): void; onEvent(event: LcuEvent): void; onClose(): void }
  ) {
    this.ws = new WebSocket(`wss://127.0.0.1:${credentials.port}/`, 'wamp', {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`riot:${credentials.password}`).toString('base64')
      },
      // Self-signed Riot certificate on loopback, same as the REST client.
      rejectUnauthorized: false,
      handshakeTimeout: 5000
    })

    const end = (): void => {
      if (this.closed) return
      this.closed = true
      handlers.onClose()
    }

    this.ws.on('open', () => {
      for (const uri of uris) this.ws.send(JSON.stringify([WAMP_SUBSCRIBE, topicFor(uri)]))
      handlers.onOpen()
    })
    this.ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as unknown
        if (!Array.isArray(message) || message[0] !== WAMP_EVENT) return
        const payload = message[2] as Partial<LcuEvent> | undefined
        if (!payload || typeof payload.uri !== 'string') return
        // Topic subscriptions are prefix-based; only pass on the exact URIs we asked for.
        if (!uris.includes(payload.uri)) return
        handlers.onEvent({
          uri: payload.uri,
          eventType: String(payload.eventType ?? ''),
          data: payload.data
        })
      } catch {
        // Ignore malformed frames.
      }
    })
    this.ws.on('error', end)
    this.ws.on('close', end)
  }

  get isOpen(): boolean {
    return !this.closed
  }

  close(): void {
    this.closed = true // intentional: don't report it
    this.ws.removeAllListeners()
    this.ws.on('error', () => {})
    try {
      this.ws.terminate()
    } catch {
      // already gone
    }
  }
}
