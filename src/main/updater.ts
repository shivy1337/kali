import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { INITIAL_UPDATE_STATUS, type UpdateStatus } from '../shared/update'

const { autoUpdater } = electronUpdater

/**
 * Checks GitHub Releases for a newer version. Does not download automatically — the renderer shows
 * a banner and the user chooses Download, then Restart to install. Only runs in the packaged app.
 */
export class Updater {
  private status: UpdateStatus = INITIAL_UPDATE_STATUS

  constructor(private readonly onStatus: (status: UpdateStatus) => void) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }))
    autoUpdater.on('update-available', (info) =>
      this.set({ state: 'available', version: info.version })
    )
    autoUpdater.on('update-not-available', () => this.set({ state: 'idle' }))
    autoUpdater.on('download-progress', (progress) =>
      this.set({
        state: 'downloading',
        version: this.status.version,
        percent: Math.round(progress.percent)
      })
    )
    autoUpdater.on('update-downloaded', (info) =>
      this.set({ state: 'ready', version: info.version })
    )
    autoUpdater.on('error', (error) =>
      this.set({ state: 'error', error: error?.message ?? 'Update failed' })
    )
  }

  get current(): UpdateStatus {
    return this.status
  }

  check(): void {
    if (!app.isPackaged) return // the dev build has no update feed
    void autoUpdater.checkForUpdates().catch((error) => {
      this.set({ state: 'error', error: (error as Error)?.message ?? 'Update check failed' })
    })
  }

  /**
   * Checks before the main window opens so we can ask in a popup. Resolves as soon as GitHub
   * answers (or after a short timeout, so a slow/offline check never holds up the app).
   */
  checkOnStartup(timeoutMs = 6000): Promise<{ available: boolean; version?: string }> {
    if (!app.isPackaged) return Promise.resolve({ available: false })
    return new Promise((resolve) => {
      let done = false
      const finish = (result: { available: boolean; version?: string }): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        autoUpdater.off('update-available', onAvailable)
        autoUpdater.off('update-not-available', onNone)
        autoUpdater.off('error', onError)
        resolve(result)
      }
      const onAvailable = (info: { version: string }): void =>
        finish({ available: true, version: info.version })
      const onNone = (): void => finish({ available: false })
      const onError = (): void => finish({ available: false })
      const timer = setTimeout(() => finish({ available: false }), timeoutMs)
      autoUpdater.once('update-available', onAvailable)
      autoUpdater.once('update-not-available', onNone)
      autoUpdater.once('error', onError)
      void autoUpdater.checkForUpdates().catch(() => finish({ available: false }))
    })
  }

  /** User chose Skip in the startup popup — go quiet for this session. */
  dismiss(): void {
    this.set({ state: 'idle' })
  }

  download(): void {
    void autoUpdater.downloadUpdate().catch((error) => {
      this.set({ state: 'error', error: (error as Error)?.message ?? 'Download failed' })
    })
  }

  install(): void {
    autoUpdater.quitAndInstall()
  }

  private set(status: UpdateStatus): void {
    this.status = status
    this.onStatus(status)
  }
}
