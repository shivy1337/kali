import { app } from 'electron'
import { appendFile, mkdir, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Minimal append-only logger. Writes to `logs/kali.log` under the user data folder — kept in its
 * own subfolder so the "Logs" button opens a clean folder, not the whole Electron data dir. The
 * file is rotated once it passes a small size cap so it never grows without bound.
 */
const MAX_BYTES = 256 * 1024
let chain: Promise<void> = Promise.resolve()
let dirReady = false

export function logDir(): string {
  return join(app.getPath('userData'), 'logs')
}

/** Ensure the logs folder exists (used before opening it from the UI). */
export async function ensureLogDir(): Promise<string> {
  const dir = logDir()
  await mkdir(dir, { recursive: true })
  dirReady = true
  return dir
}

export function log(...parts: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${parts.map((p) => String(p)).join(' ')}\n`
  console.log(line.trimEnd())
  const file = join(logDir(), 'kali.log')
  chain = chain
    .then(async () => {
      if (!dirReady) await ensureLogDir()
      try {
        const info = await stat(file)
        if (info.size > MAX_BYTES) await rename(file, join(logDir(), 'kali.old.log'))
      } catch {
        // No file yet — nothing to rotate.
      }
      await appendFile(file, line)
    })
    .catch(() => {})
}
