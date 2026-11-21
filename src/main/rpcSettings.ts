import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DEFAULT_RPC_SETTINGS, sanitizeRpcSettings, type RpcSettings } from '../shared/rpc'

/** Discord RPC settings persisted as JSON in the app's user-data folder. */
export class RpcSettingsStore {
  settings: RpcSettings = DEFAULT_RPC_SETTINGS

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      this.settings = sanitizeRpcSettings(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch {
      this.settings = DEFAULT_RPC_SETTINGS
    }
  }

  async save(value: unknown): Promise<RpcSettings> {
    this.settings = sanitizeRpcSettings(value)
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(this.settings), 'utf8')
    } catch (error) {
      console.error('[rpc] could not save settings', error)
    }
    return this.settings
  }
}
