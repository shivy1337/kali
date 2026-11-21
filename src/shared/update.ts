/** Auto-update status, shared between main, preload and renderer. */

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  /** The new version, when one is available / downloading / ready. */
  version?: string
  /** Download progress 0–100 while downloading. */
  percent?: number
  error?: string
}

export const INITIAL_UPDATE_STATUS: UpdateStatus = { state: 'idle' }
