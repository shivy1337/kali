import type { LookupProvider } from '../../shared/types'
import { LOOKUP_LABELS, setPrefs, usePrefs, type PlayerClickAction } from '../lib/prefs'
import { Select, type SelectOption } from './ui/Select'

const LOOKUP_OPTIONS: SelectOption<LookupProvider>[] = [
  { value: 'opgg', label: LOOKUP_LABELS.opgg },
  { value: 'ugg', label: LOOKUP_LABELS.ugg }
]

const CLICK_OPTIONS: SelectOption<PlayerClickAction>[] = [
  { value: 'details', label: 'Show details' },
  { value: 'profile', label: 'Open profile' }
]

/** The two lobby preferences: which stats site to use, and what clicking a player does. */
export function LookupPrefs({ className = '' }: { className?: string }) {
  const prefs = usePrefs()
  return (
    <section
      className={`grid grid-cols-2 gap-3 rounded-card border border-border bg-elevated p-4 ${className}`}
    >
      <Select
        label="Multi-search"
        value={prefs.lookup}
        options={LOOKUP_OPTIONS}
        onChange={(lookup) => setPrefs({ lookup })}
      />
      <Select
        label="Clicking a player"
        value={prefs.playerClick}
        options={CLICK_OPTIONS}
        onChange={(playerClick) => setPrefs({ playerClick })}
      />
    </section>
  )
}
