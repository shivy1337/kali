import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DEFAULT_APP_SETTINGS, sanitizeAppSettings, type AppSettings } from '../shared/app'

/** App settings persisted as JSON in the app's user-data folder. */
export class AppSettingsStore {
  settings: AppSettings = DEFAULT_APP_SETTINGS

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      this.settings = sanitizeAppSettings(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch {
      this.settings = DEFAULT_APP_SETTINGS
    }
  }

  async save(value: unknown): Promise<AppSettings> {
    this.settings = sanitizeAppSettings(value)
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(this.settings), 'utf8')
    } catch (error) {
      console.error('[app] could not save app settings', error)
    }
    return this.settings
  }
}
