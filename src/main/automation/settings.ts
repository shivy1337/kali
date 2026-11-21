import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  DEFAULT_AUTOMATION,
  sanitizeAutomation,
  type AutomationSettings
} from '../../shared/automation'

/** Automation settings persisted as JSON in the app's user-data folder. */
export class AutomationStore {
  settings: AutomationSettings = DEFAULT_AUTOMATION

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      this.settings = sanitizeAutomation(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch {
      this.settings = DEFAULT_AUTOMATION // first run or unreadable file
    }
  }

  async save(value: unknown): Promise<AutomationSettings> {
    this.settings = sanitizeAutomation(value)
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(this.settings), 'utf8')
    } catch (error) {
      console.error('[auto] could not save automation settings', error)
    }
    return this.settings
  }
}
