import { useState } from 'react'
import { MAX_LIST } from '../../shared/automation'
import { useChampions } from '../lib/useChampions'
import { ChampionIcon } from './ChampionIcon'
import { ChampionPicker } from './ChampionPicker'
import { Icon } from './ui/Icon'

/**
 * Ordered champion list editor: numbered tiles with a remove-on-hover, plus a "+" tile that
 * opens the picker. Order is preference order.
 */
export function ChampionList({
  ids,
  onChange,
  pickerTitle,
  addLabel
}: {
  ids: number[]
  onChange: (ids: number[]) => void
  pickerTitle: string
  addLabel: string
}) {
  const champions = useChampions()
  const [picking, setPicking] = useState(false)
  const full = ids.length >= MAX_LIST

  return (
    <div className="flex flex-wrap items-start gap-2.5">
      {ids.map((id, index) => (
        <div key={id} className="group/chip relative w-14">
          <div className="relative">
            <span className="absolute -top-1 -left-1 z-10 rounded bg-base px-1 font-mono text-[9px] text-muted">
              {index + 1}
            </span>
            <ChampionIcon
              champion={{ id, name: champions.name(id), locked: true }}
              size={56}
              plain
            />
            <button
              type="button"
              aria-label={`Remove ${champions.name(id)}`}
              onClick={() => onChange(ids.filter((value) => value !== id))}
              className="no-drag absolute inset-0 flex items-center justify-center rounded-md bg-base/70 opacity-0 transition-opacity duration-150 group-hover/chip:opacity-100"
            >
              <Icon name="close" size={14} className="text-red" />
            </button>
          </div>
          <div className="mt-1 truncate text-center text-[10px] text-muted">
            {champions.name(id)}
          </div>
        </div>
      ))}

      {!full && (
        <button
          type="button"
          aria-label={addLabel}
          title={addLabel}
          onClick={() => setPicking(true)}
          className="no-drag flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border-hover text-muted transition-colors duration-150 hover:border-accent/60 hover:text-primary"
        >
          <Icon name="close" size={16} className="rotate-45" />
        </button>
      )}

      {picking && (
        <ChampionPicker
          title={pickerTitle}
          exclude={ids}
          onPick={(id) => {
            if (!ids.includes(id)) onChange([...ids, id])
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
