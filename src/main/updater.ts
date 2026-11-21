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
