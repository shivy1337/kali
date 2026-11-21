import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { join } from 'node:path'
import iconPath from '../../resources/icon.png?asset'
import { INITIAL_QUEUE_STATUS, type QueueStatus } from '../shared/automation'
import { DISCORD_INVITE, INITIAL_RPC_STATUS, type RpcStatus } from '../shared/rpc'
import { INITIAL_UPDATE_STATUS, type UpdateStatus } from '../shared/update'
import { IPC, type AssetKind, type KaliSnapshot } from '../shared/types'
import { Updater } from './updater'
import { AppSettingsStore } from './appSettings'
import { AutomationStore } from './automation/settings'
import { LcuConnection } from './lcu/connection'
import { multiSearchUrl, profileUrl } from './lookup'
import { RecentLobbies } from './recentLobbies'
import { PresenceManager, type PresenceState } from './rpc/presence'
import { RpcSettingsStore } from './rpcSettings'

app.setName('Kali')
app.setAppUserModelId('kali')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let resolveWindowReady!: () => void
const windowReady = new Promise<void>((resolve) => {
  resolveWindowReady = resolve
})

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

const recentLobbies = new RecentLobbies(join(app.getPath('userData'), 'recent-lobbies.json'))
const automation = new AutomationStore(join(app.getPath('userData'), 'automation.json'))
const appSettings = new AppSettingsStore(join(app.getPath('userData'), 'app-settings.json'))
const rpcSettings = new RpcSettingsStore(join(app.getPath('userData'), 'rpc-settings.json'))
let queueStatus: QueueStatus = INITIAL_QUEUE_STATUS
let rpcStatus: RpcStatus = INITIAL_RPC_STATUS
let updateStatus: UpdateStatus = INITIAL_UPDATE_STATUS

const updater = new Updater((status) => {
  updateStatus = status
  send(IPC.updateStatus, status)
})

const presence = new PresenceManager(
  (status) => {
    rpcStatus = status
    send(IPC.rpcStatus, status)
  },
  () => lcu.currentClient
)

function presenceState(): PresenceState {
  return {
    connected: lcu.state === 'connected',
    phase: lcu.phase,
    profile: lcu.profile,
    lobby: lcu.lobby,
    liveGame: lcu.liveGame
  }
}
const pushPresence = (): void => presence.apply(presenceState())

const lcu = new LcuConnection({
  onState: (state) => {
    send(IPC.connectionState, state)
    pushPresence()
  },
  onProfile: (profile) => {
    send(IPC.profile, profile)
    pushPresence()
  },
  onPhase: (phase) => {
    send(IPC.phase, phase)
    pushPresence()
    if (phase === 'ChampSelect' && appSettings.settings.showOnChampSelect) {
      showWindow()
      send(IPC.showChampSelect, null)
    }
  },
  onLobby: (lobby) => {
    send(IPC.lobby, lobby)
    pushPresence()
  },
  onLobbyFinished: (lobby) => {
    void recentLobbies.add(lobby).then(() => send(IPC.recentLobbies, recentLobbies.list))
  },
  onQueueStatus: (status) => {
    queueStatus = status
    send(IPC.queueStatus, status)
  },
  onLiveGame: (game) => {
    send(IPC.liveGame, game)
    pushPresence()
  }
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 600,
    minWidth: 820,
    minHeight: 520,
    frame: false,
    fullscreenable: false,
    show: false,
    title: 'Kali',
    icon: iconPath,
    backgroundColor: '#070B16',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // The window is revealed by startup() once the update check (and any popup) is done, so the
  // "new version" prompt can appear before the app itself opens.
  mainWindow.once('ready-to-show', () => resolveWindowReady())
  mainWindow.on('maximize', () => send(IPC.maximized, true))
  mainWindow.on('unmaximize', () => send(IPC.maximized, false))
  // Close-to-tray: hide instead of closing, unless the user is really quitting.
  mainWindow.on('close', (event) => {
    if (!isQuitting && appSettings.settings.closeToTray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // The UI is a single local page: no popups, no navigation.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // (A reload of the current page is allowed so Vite's dev full-reload keeps working.)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Register/unregister Kali as a Windows login item (packaged builds only). */
function applyLoginItem(openAtLogin: boolean): void {
  if (!app.isPackaged) return // dev would register the electron-vite binary; skip
  app.setLoginItemSettings({ openAtLogin, args: ['--hidden'] })
}

function showWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/**
 * Starts the League watcher and, before the main window appears, checks for a new version. If one
 * is available it asks in a native popup (Download / Skip) — then reveals the app.
 */
async function startup(): Promise<void> {
  lcu.start()

  // Launched at login with --hidden: stay in the tray without popping up; check quietly instead.
  if (process.argv.includes('--hidden')) {
    updater.check()
    return
  }

  const update = await updater.checkOnStartup()
  if (update.available) {
    const choice = dialog.showMessageBoxSync({
      type: 'info',
      noLink: true,
      title: 'Kali',
      message: 'A new version is ready to download',
      detail: `Kali ${update.version} is available. Download it now?`,
      buttons: ['Download', 'Skip'],
      defaultId: 0,
      cancelId: 1
    })
    if (choice === 0) updater.download()
    else updater.dismiss()
  }

  await windowReady
  mainWindow?.show()
  mainWindow?.focus()
}

function createTray(): void {
  const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(image)
  tray.setToolTip('Kali')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Kali', click: showWindow },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showWindow)
}

function registerIpc(): void {
  ipcMain.handle(IPC.appSettingsGet, () => appSettings.settings)
  ipcMain.handle(IPC.appSettingsSet, async (_event, value: unknown) => {
    const saved = await appSettings.save(value)
    applyLoginItem(saved.launchOnStartup)
    return saved
  })
  ipcMain.handle(
    IPC.getSnapshot,
    (): KaliSnapshot => ({
      version: app.getVersion(),
      connection: lcu.state,
      profile: lcu.profile,
      phase: lcu.phase,
      lobby: lcu.lobby,
      recentLobbies: recentLobbies.list,
      liveGame: lcu.liveGame,
      maximized: mainWindow?.isMaximized() ?? false
    })
  )
  ipcMain.handle(IPC.refreshProfile, () => lcu.refresh())
  ipcMain.handle(IPC.automationGet, () => ({ settings: automation.settings, status: queueStatus }))
  ipcMain.handle(IPC.automationSet, async (_event, value: unknown) => {
    const settings = await automation.save(value)
    lcu.setAutomation(settings)
    return settings
  })
  ipcMain.handle(IPC.getAsset, (_event, kind: unknown, key: unknown) => {
    if (kind !== 'emblem' && kind !== 'champion' && kind !== 'item') return null
    if (typeof key !== 'string' || !/^[A-Za-z0-9]{1,24}$/.test(key)) return null
    return lcu.getAsset(kind satisfies AssetKind, key)
  })
  ipcMain.handle(IPC.getChampions, () => lcu.getChampions())
  ipcMain.handle(IPC.updateGet, () => updateStatus)
  ipcMain.on(IPC.updateDownload, () => updater.download())
  ipcMain.on(IPC.updateInstall, () => updater.install())
  ipcMain.handle(IPC.rpcGet, () => ({ settings: rpcSettings.settings, status: rpcStatus }))
  ipcMain.handle(IPC.rpcSet, async (_event, value: unknown) => {
    const settings = await rpcSettings.save(value)
    presence.setSettings(settings)
    presence.apply(presenceState())
    return settings
  })
  ipcMain.handle(IPC.copyText, (_event, text: unknown) => {
    if (typeof text === 'string' && text.length <= 256) clipboard.writeText(text)
  })
  ipcMain.handle(IPC.openMultiSearch, async (_event, provider: unknown, region: unknown, ids: unknown) => {
    const url = multiSearchUrl(provider, region, ids)
    if (url) await shell.openExternal(url)
  })
  ipcMain.handle(IPC.openPlayerProfile, async (_event, provider: unknown, region: unknown, id: unknown) => {
    const url = profileUrl(provider, region, id)
    if (url) await shell.openExternal(url)
  })
  ipcMain.on(IPC.openLink, (_event, target: unknown) => {
    if (target === 'discord') void shell.openExternal(DISCORD_INVITE)
    else if (target === 'website') void shell.openExternal('https://github.com/shivy1337/kali')
    else if (target === 'logs') void shell.openPath(app.getPath('userData'))
  })
  ipcMain.on(IPC.windowMinimize, (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.on(IPC.windowToggleMaximize, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.windowClose, (event) => BrowserWindow.fromWebContents(event.sender)?.close())
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)
  app.on('before-quit', () => {
    isQuitting = true
  })

  void app.whenReady().then(async () => {
    await Promise.all([
      recentLobbies.load(),
      automation.load(),
      appSettings.load(),
      rpcSettings.load()
    ])
    lcu.setAutomation(automation.settings)
    presence.setSettings(rpcSettings.settings)
    applyLoginItem(appSettings.settings.launchOnStartup)
    registerIpc()
    createTray()
    createWindow()
    void startup()
  })

  app.on('window-all-closed', () => {
    lcu.stop()
    presence.stop()
    app.quit()
  })
}
