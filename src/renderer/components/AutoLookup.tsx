import { useEffect, useRef } from 'react'
import type { Lobby } from '../../shared/types'
import { usePrefs } from '../lib/prefs'

/**
 * "Open lookup automatically": once a champ select has all names revealed (or the configured
 * wait elapses), open the multi-search for the revealed players — once per champ select.
 * Lives here (not in main) so it reuses the renderer's lookup provider preference.
 */
export function AutoLookup({ lobby }: { lobby: Lobby | null }) {
  const prefs = usePrefs()
  const openedFor = useRef<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!lobby) {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
      return
    }

    const id = lobby.id
    if (openedFor.current === id) return
    let cancelled = false

    const open = (): void => {
      if (cancelled || openedFor.current === id) return
      const revealed = lobby.players.filter((p) => p.profile !== null)
      const region = revealed.find((p) => p.profile?.region)?.profile?.region
      const ids = revealed.map((p) => `${p.profile!.gameName}#${p.profile!.tagLine}`)
      if (!region || ids.length === 0) return // nothing to look up (e.g. all names hidden)
      openedFor.current = id
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      void window.kali.openMultiSearch(prefs.lookup, region, ids)
    }

    void window.kali.getAutomation().then(({ settings }) => {
      if (cancelled) return
      const { enabled, delaySeconds } = settings.champSelect.openLookup
      if (!enabled) return
      const total = lobby.players.length
      const revealed = lobby.players.filter((p) => p.profile !== null).length
      if (total > 0 && revealed === total) open()
      else if (timer.current === null) {
        timer.current = window.setTimeout(open, delaySeconds * 1000)
      }
    })

    return () => {
      cancelled = true
    }
  }, [lobby, prefs.lookup])

  return null
}
