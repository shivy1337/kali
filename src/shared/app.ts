/** App-level (non-automation) settings. Shared between main, preload and renderer. */

export interface AppSettings {
  /** Closing the window hides Kali to the system tray instead of quitting. */
  closeToTray: boolean
  /** When champ select starts, bring Kali to the front and open the Lobby page. */
  showOnChampSelect: boolean
  /** Launch Kali automatically when Windows starts (so it's running before League). */
  launchOnStartup: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  closeToTray: false,
  showOnChampSelect: true,
  launchOnStartup: false
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function sanitizeAppSettings(value: unknown): AppSettings {
  const v = (value ?? {}) as Partial<AppSettings>
  return {
    closeToTray: bool(v.closeToTray, DEFAULT_APP_SETTINGS.closeToTray),
    showOnChampSelect: bool(v.showOnChampSelect, DEFAULT_APP_SETTINGS.showOnChampSelect),
    launchOnStartup: bool(v.launchOnStartup, DEFAULT_APP_SETTINGS.launchOnStartup)
  }
}
