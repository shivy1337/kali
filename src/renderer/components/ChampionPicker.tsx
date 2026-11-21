import { useMemo, useState } from 'react'
import { ChampionIcon } from './ChampionIcon'
import { Modal } from './ui/Modal'
import { useChampions } from '../lib/useChampions'

/** Searchable champion grid in a modal; clicking a champion calls `onPick` and closes. */
export function ChampionPicker({
  title,
  exclude,
  onPick,
  onClose
}: {
  title: string
  /** Already-chosen ids to grey out. */
  exclude: number[]
  onPick: (id: number) => void
  onClose: () => void
}) {
  const champions = useChampions()
  const [query, setQuery] = useState('')
  const excluded = new Set(exclude)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? champions.list.filter((c) => c.name.toLowerCase().includes(q)) : champions.list
  }, [champions.list, query])

  return (
    <Modal label={title} onClose={onClose}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-display text-[14px] font-bold tracking-wide">{title}</h2>
      </div>
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search champion…"
        className="no-drag mt-3 h-9 w-full rounded-md border border-border bg-base px-3 text-[13px] text-primary outline-none placeholder:text-muted focus:border-accent/60"
      />
      <ul className="mt-3 grid max-h-[320px] grid-cols-5 gap-2 overflow-y-auto pr-1">
        {results.map((champion) => {
          const taken = excluded.has(champion.id)
          return (
            <li key={champion.id}>
              <button
                type="button"
                disabled={taken}
                onClick={() => onPick(champion.id)}
                title={champion.name}
                className={`no-drag flex w-full flex-col items-center gap-1 rounded-md border border-transparent p-1.5 transition-colors duration-150 ${
                  taken ? 'opacity-30' : 'hover:border-accent/60 hover:bg-elevated'
                }`}
              >
                <ChampionIcon
                  champion={{ id: champion.id, name: champion.name, locked: true }}
                  size={40}
                  plain
                />
                <span className="w-full truncate text-center text-[10px] text-muted">
                  {champion.name}
                </span>
              </button>
            </li>
          )
        })}
        {results.length === 0 && (
          <li className="col-span-5 py-6 text-center text-xs text-muted">No champions match.</li>
        )}
      </ul>
    </Modal>
  )
}
