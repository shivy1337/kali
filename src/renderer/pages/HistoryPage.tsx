import { useState } from 'react'
import type { Lobby } from '../../shared/types'
import { CopyButton } from '../components/CopyButton'
import { Button, IconButton } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Pill } from '../components/ui/Pill'
import { LOOKUP_LABELS, usePrefs } from '../lib/prefs'

const WHEN = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})

function riotId(player: Lobby['players'][number]): string | null {
  return player.profile ? `${player.profile.gameName}#${player.profile.tagLine}` : null
}

function HistoryEntry({ lobby }: { lobby: Lobby }) {
  const [open, setOpen] = useState(true)
  const prefs = usePrefs()
  const revealed = lobby.players.filter((p) => p.profile !== null)
  const ids = revealed.map((p) => riotId(p)!)
  const region = revealed.find((p) => p.profile?.region)?.profile?.region ?? null

  return (
    <li className="rounded-card border border-border bg-elevated p-4 transition-colors duration-150 hover:border-border-hover">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold">{WHEN.format(lobby.startedAt)}</div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {revealed.length}/{lobby.players.length} players revealed
            {lobby.queueName ? ` · ${lobby.queueName}` : ''}
          </div>
        </div>
        {lobby.outcome === 'dodged' && (
          <Pill variant="gold" round>
            Dodged
          </Pill>
        )}
        {lobby.outcome === 'played' && (
          <Pill variant="success" round>
            Played
          </Pill>
        )}
        <Button
          variant="secondary"
          plain
          disabled={ids.length === 0 || !region}
          onClick={() => region && void window.kali.openMultiSearch(prefs.lookup, region, ids)}
        >
          Open {LOOKUP_LABELS[prefs.lookup]}
        </Button>
        <IconButton
          icon="list"
          label={open ? 'Hide players' : 'Show players'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        />
        <CopyButton text={ids.join('\n')} label="Copy all Riot IDs" tooltipAlign="end" />
      </div>

      {open && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {revealed.map((player) => (
            <li
              key={player.cellId}
              className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface pr-1 pl-3"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs select-text">
                <span className="font-semibold text-primary">{player.profile!.gameName}</span>
                <span className="text-muted">#{player.profile!.tagLine}</span>
              </span>
              <CopyButton text={riotId(player)!} label="Copy Riot ID" small tooltipAlign="end" />
            </li>
          ))}
          {revealed.length === 0 && (
            <li className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted">
              No players were revealed in this champ select.
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

export function HistoryPage({ lobbies }: { lobbies: Lobby[] }) {
  if (lobbies.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-card border border-border bg-elevated text-muted">
          <Icon name="history" size={22} />
        </span>
        <div className="font-display text-[15px] font-bold tracking-wide">Nothing yet</div>
        <p className="text-xs text-muted">Champ selects you go through will be listed here.</p>
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {lobbies.map((lobby) => (
        <HistoryEntry key={lobby.id} lobby={lobby} />
      ))}
    </ul>
  )
}
