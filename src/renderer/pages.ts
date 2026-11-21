import type { IconName } from './components/ui/Icon'

export type PageId = 'lobby' | 'history' | 'skins' | 'rpc' | 'settings'

export interface PageDef {
  id: PageId
  label: string
  icon: IconName
  /** Small uppercase label shown above the page title in the title bar. */
  section: string
  /** False => the main area shows "Coming soon". */
  ready: boolean
}

export const PAGES: PageDef[] = [
  { id: 'lobby', label: 'Lobby', icon: 'lobby', section: 'Ranked Solo / Duo', ready: true },
  { id: 'history', label: 'History', icon: 'history', section: 'Champ selects', ready: true },
  { id: 'skins', label: 'Skins', icon: 'skins', section: 'Coming soon', ready: false },
  { id: 'rpc', label: 'League RPC', icon: 'rpc', section: 'Discord Rich Presence', ready: true },
  { id: 'settings', label: 'Settings', icon: 'settings', section: 'Automation', ready: true }
]
