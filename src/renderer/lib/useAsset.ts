import { useEffect, useState } from 'react'
import type { AssetKind } from '../../shared/types'

// Loaded once per app session; only successful loads stay cached so misses are retried.
const resolved = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

// The champion picker can mount 150+ icons at once; firing that many LCU requests at the same
// time overwhelms the client and most fail. Fetch through a small queue so they fill in steadily.
const MAX_CONCURRENT = 8
let active = 0
const waiters: (() => void)[] = []

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return Promise.resolve()
  }
  return new Promise((release) => waiters.push(release))
}

function release(): void {
  const next = waiters.shift()
  if (next) next()
  else active--
}

function load(kind: AssetKind, key: string): Promise<string | null> {
  const id = `${kind}:${key}`
  let request = pending.get(id)
  if (!request) {
    request = (async () => {
      await acquire()
      try {
        const dataUrl = await window.kali.getAsset(kind, key).catch(() => null)
        if (dataUrl) resolved.set(id, dataUrl)
        return dataUrl
      } finally {
        release()
        pending.delete(id) // allow a retry on the next request if it came back null
      }
    })()
    pending.set(id, request)
  }
  return request
}

/**
 * On-demand image from main as a `data:` URL (`null` while loading or if unavailable).
 * Pass `key = null` to load nothing.
 */
export function useAsset(kind: AssetKind, key: string | number | null): string | null {
  const id = key === null ? null : `${kind}:${key}`
  const [, rerender] = useState(0)

  useEffect(() => {
    if (id === null || key === null || resolved.has(id)) return
    let cancelled = false
    void load(kind, String(key)).then(() => {
      if (!cancelled) rerender((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [id, kind, key])

  return id === null ? null : (resolved.get(id) ?? null)
}
