import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { QueueStatus } from '../shared/automation'
import type { RpcStatus } from '../shared/rpc'
import type { UpdateStatus } from '../shared/update'
import {
  IPC,
  type ConnectionState,
  type GamePhase,
  type KaliApi,
  type LiveGame,
  type Lobby,
  type Profile
} from '../shared/types'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: KaliApi = {
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  onConnectionState: (listener) => subscribe<ConnectionState>(IPC.connectionState, listener),
  onProfile: (listener) => subscribe<Profile | null>(IPC.profile, listener),
  onPhase: (listener) => subscribe<GamePhase>(IPC.phase, listener),
  onLobby: (listener) => subscribe<Lobby | null>(IPC.lobby, listener),
  onRecentLobbies: (listener) => subscribe<Lobby[]>(IPC.recentLobbies, listener),
  onLiveGame: (listener) => subscribe<LiveGame | null>(IPC.liveGame, listener),
  refreshProfile: () => ipcRenderer.invoke(IPC.refreshProfile),
  getAsset: (kind, key) => ipcRenderer.invoke(IPC.getAsset, kind, key),
  getChampions: () => ipcRenderer.invoke(IPC.getChampions),
  copyText: (text) => ipcRenderer.invoke(IPC.copyText, text),
  openMultiSearch: (provider, region, riotIds) =>
    ipcRenderer.invoke(IPC.openMultiSearch, provider, region, riotIds),
  openPlayerProfile: (provider, region, riotId) =>
    ipcRenderer.invoke(IPC.openPlayerProfile, provider, region, riotId),
  getAutomation: () => ipcRenderer.invoke(IPC.automationGet),
  setAutomation: (settings) => ipcRenderer.invoke(IPC.automationSet, settings),
  onQueueStatus: (listener) => subscribe<QueueStatus>(IPC.queueStatus, listener),
  getAppSettings: () => ipcRenderer.invoke(IPC.appSettingsGet),
  setAppSettings: (settings) => ipcRenderer.invoke(IPC.appSettingsSet, settings),
  getRpc: () => ipcRenderer.invoke(IPC.rpcGet),
  setRpc: (settings) => ipcRenderer.invoke(IPC.rpcSet, settings),
  onRpcStatus: (listener) => subscribe<RpcStatus>(IPC.rpcStatus, listener),
  getUpdateStatus: () => ipcRenderer.invoke(IPC.updateGet),
  onUpdateStatus: (listener) => subscribe<UpdateStatus>(IPC.updateStatus, listener),
  downloadUpdate: () => ipcRenderer.send(IPC.updateDownload),
  installUpdate: () => ipcRenderer.send(IPC.updateInstall),
  onShowChampSelect: (listener) => subscribe<null>(IPC.showChampSelect, () => listener()),
  onMaximized: (listener) => subscribe<boolean>(IPC.maximized, listener),
  window: {
    minimize: () => ipcRenderer.send(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
    close: () => ipcRenderer.send(IPC.windowClose)
  }
}

contextBridge.exposeInMainWorld('kali', api)
