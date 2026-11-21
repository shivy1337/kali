import type { Lobby } from '../../shared/types'
import { timeAgo } from '../lib/format'

const OUTCOME = {
  dodged: { label: 'Dodged', className: 'bg-gold/15 text-gold' },
  played: { label: 'Played', className: 'bg-success/15 text-success' }
} as const

function LobbyRow({ lobby }: { lobby: Lobby }) {
  const outcome = lobby.outcome ? OUTCOME[lobby.outcome] : null
  const names = lobby.players
    .filter((player) => player.profile !== null)
    .map((player) => player.profile!.gameName)

  return (
    <li className="rounded-md border border-border bg-surface px-3 py-2 transition-colors duration-150 hover:border-border-hover">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">{timeAgo(lobby.startedAt)}</span>
        {outcome && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] leading-none font-semibold ${outcome.className}`}
          >
            {outcome.label}
          </span>
        )}
      </div>
      {names.length > 0 && (
        <div className="mt-1 truncate text-[13px] font-semibold select-text">
          {names.join(', ')}
        </div>
      )}
    </li>
  )
}

/** Compact list of finished champ selects: when, how it ended, and who was revealed. */
export function RecentLobbiesCard({ lobbies, className = '' }: { lobbies: Lobby[]; className?: string }) {
  return (
    <section
      className={`rounded-card border border-border bg-elevated p-4 transition-colors duration-150 hover:border-border-hover ${className}`}
    >
      <h2 className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
        Recent lobbies
      </h2>
      {lobbies.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Nothing yet</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {lobbies.map((lobby) => (
            <LobbyRow key={lobby.id} lobby={lobby} />
          ))}
        </ul>
      )}
    </section>
  )
}
