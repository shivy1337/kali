import { randomUUID } from 'node:crypto'
import net from 'node:net'

/** A Discord Rich Presence activity (the subset we set). Image fields accept plain https URLs. */
export interface DiscordActivity {
  details?: string
  state?: string
  timestamps?: { start?: number }
  assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string }
  party?: { size?: [number, number] }
}

const OP_HANDSHAKE = 0
const OP_FRAME = 1
const RECONNECT_MS = 10_000

function ipcPaths(): string[] {
  if (process.platform === 'win32') {
    return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`)
  }
  const base =
    process.env['XDG_RUNTIME_DIR'] || process.env['TMPDIR'] || process.env['TMP'] || '/tmp'
  return Array.from({ length: 10 }, (_, i) => `${base}/discord-ipc-${i}`)
}

/**
 * Minimal Discord IPC client for setting Rich Presence. Connects to the local Discord named pipe,
 * performs the handshake with the configured application id, and pushes SET_ACTIVITY frames.
 * Reconnects on its own while enabled (e.g. Discord starting after Kali).
 */
export class DiscordClient {
  private socket: net.Socket | null = null
  private ready = false
  private buffer = Buffer.alloc(0)
  private appId = ''
  private activity: DiscordActivity | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private running = false

  constructor(private readonly onReady: (connected: boolean) => void) {}

  get connected(): boolean {
    return this.ready
  }

  start(appId: string): void {
    if (this.running && this.appId === appId) return
    this.stop()
    this.appId = appId
    this.running = true
    this.tryConnect(0)
  }

  stop(): void {
    this.running = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.teardown()
  }

  setActivity(activity: DiscordActivity | null): void {
    this.activity = activity
    if (this.ready) this.flush()
  }

  private tryConnect(pathIndex: number): void {
    if (!this.running) return
    const paths = ipcPaths()
    if (pathIndex >= paths.length) {
      this.scheduleReconnect()
      return
    }
    const socket = net.createConnection(paths[pathIndex])
    this.socket = socket
    socket.on('connect', () => this.send(OP_HANDSHAKE, { v: 1, client_id: this.appId }))
    socket.on('data', (chunk: Buffer | string) => this.onData(Buffer.from(chunk)))
    socket.on('error', () => {
      socket.destroy()
      if (this.socket === socket) {
        this.socket = null
        // Try the next pipe index; Discord may be on ipc-1, ipc-2, …
        this.tryConnect(pathIndex + 1)
      }
    })
    socket.on('close', () => {
      if (this.socket === socket) this.handleDisconnect()
    })
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.buffer.length >= 8) {
      const length = this.buffer.readUInt32LE(4)
      if (this.buffer.length < 8 + length) break
      const op = this.buffer.readUInt32LE(0)
      const payload = this.buffer.subarray(8, 8 + length).toString('utf8')
      this.buffer = this.buffer.subarray(8 + length)
      this.onFrame(op, payload)
    }
  }

  private onFrame(op: number, payload: string): void {
    if (op !== OP_FRAME) return
    try {
      const message = JSON.parse(payload) as { evt?: string; cmd?: string }
      if (message.evt === 'READY' && !this.ready) {
        this.ready = true
        this.onReady(true)
        this.flush()
      }
    } catch {
      // ignore malformed frames
    }
  }

  private flush(): void {
    this.send(OP_FRAME, {
      cmd: 'SET_ACTIVITY',
      nonce: randomUUID(),
      args: { pid: process.pid, activity: this.activity ?? undefined }
    })
  }

  private send(op: number, data: unknown): void {
    if (!this.socket || this.socket.destroyed) return
    const json = Buffer.from(JSON.stringify(data), 'utf8')
    const header = Buffer.alloc(8)
    header.writeUInt32LE(op, 0)
    header.writeUInt32LE(json.length, 4)
    try {
      this.socket.write(Buffer.concat([header, json]))
    } catch {
      this.handleDisconnect()
    }
  }

  private handleDisconnect(): void {
    this.teardown()
    this.scheduleReconnect()
  }

  private teardown(): void {
    if (this.ready) this.onReady(false)
    this.ready = false
    this.buffer = Buffer.alloc(0)
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.destroy()
      this.socket = null
    }
  }

  private scheduleReconnect(): void {
    if (!this.running || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.running) this.tryConnect(0)
    }, RECONNECT_MS)
  }
}
