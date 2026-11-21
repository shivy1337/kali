import { useSyncExternalStore } from 'react'
import type { LookupProvider } from '../../shared/types'

/** What happens when a teammate row is clicked in champ select. */
export type PlayerClickAction = 'details' | 'profile'

export interface Prefs {
  lookup: LookupProvider
  playerClick: PlayerClickAction
}

export const LOOKUP_LABELS: Record<LookupProvider, string> = {
  opgg: 'OP.GG',
  ugg: 'U.GG'
}

const STORAGE_KEY = 'kali.prefs'
const DEFAULTS: Prefs = { lookup: 'opgg', playerClick: 'details' }

function load(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Prefs>
    return {
      lookup: saved.lookup === 'ugg' || saved.lookup === 'opgg' ? saved.lookup : DEFAULTS.lookup,
      playerClick:
        saved.playerClick === 'profile' || saved.playerClick === 'details'
          ? saved.playerClick
          : DEFAULTS.playerClick
    }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage unavailable: the choice still applies until the app closes.
  }
  listeners.forEach((listener) => listener())
}

/** User preferences, shared by every component and remembered between launches. */
export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}
