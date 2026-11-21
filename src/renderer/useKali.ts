import { useEffect, useState } from 'react'
import type { KaliSnapshot } from '../shared/types'

const INITIAL: KaliSnapshot = {
  version: '',
  connection: 'disconnected',
  profile: null,
  phase: 'None',
  lobby: null,
  recentLobbies: [],
  liveGame: null,
  maximized: false
}

/** Live view of the main-process state: initial snapshot + pushed updates. */
export function useKali(): KaliSnapshot {
  const [snapshot, setSnapshot] = useState<KaliSnapshot>(INITIAL)

  useEffect(() => {
    let cancelled = false
    const patch =
      <K extends keyof KaliSnapshot>(key: K) =>
      (value: KaliSnapshot[K]) =>
        setSnapshot((prev) => ({ ...prev, [key]: value }))

    const unsubscribe = [
      window.kali.onConnectionState(patch('connection')),
      window.kali.onProfile(patch('profile')),
      window.kali.onPhase(patch('phase')),
      window.kali.onLobby(patch('lobby')),
      window.kali.onRecentLobbies(patch('recentLobbies')),
      window.kali.onLiveGame(patch('liveGame')),
      window.kali.onMaximized(patch('maximized'))
    ]
    void window.kali.getSnapshot().then((initial) => {
      if (!cancelled) setSnapshot(initial)
    })
    return () => {
      cancelled = true
      unsubscribe.forEach((off) => off())
    }
  }, [])

  return snapshot
}
