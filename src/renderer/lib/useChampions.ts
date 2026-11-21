import { useEffect, useState } from 'react'
import type { ChampionSummary } from '../../shared/types'

let cache: ChampionSummary[] | null = null
let pending: Promise<ChampionSummary[]> | null = null

function load(): Promise<ChampionSummary[]> {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = window.kali
      .getChampions()
      .catch(() => [])
      .then((list) => {
        pending = null
        if (list.length > 0) cache = list
        return list
      })
  }
  return pending
}

export interface Champions {
  list: ChampionSummary[]
  byId: Map<number, ChampionSummary>
  name(id: number): string
}

/** The champion catalog, loaded once from main and shared across the app. */
export function useChampions(): Champions {
  const [list, setList] = useState<ChampionSummary[]>(cache ?? [])

  useEffect(() => {
    if (cache) return
    let cancelled = false
    void load().then((loaded) => {
      if (!cancelled) setList(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const byId = new Map(list.map((c) => [c.id, c]))
  return {
    list,
    byId,
    name: (id) => byId.get(id)?.name ?? `#${id}`
  }
}
