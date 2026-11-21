import { app } from 'electron'
import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Minimal append-only logger. Writes to `kali.log` in the user data folder (the one the "Logs"
 * button opens), so issues that only happen on a real client can be captured and shared.
 */
let chain: Promise<void> = Promise.resolve()

export function log(...parts: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${parts.map((p) => String(p)).join(' ')}\n`
  console.log(line.trimEnd())
  const file = join(app.getPath('userData'), 'kali.log')
  chain = chain.then(() => appendFile(file, line)).catch(() => {})
}
