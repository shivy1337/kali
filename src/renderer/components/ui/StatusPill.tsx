import type { ConnectionState } from '../../../shared/types'

const STATUS: Record<ConnectionState, { text: string; dot: string; tone: string }> = {
  disconnected: { text: 'Waiting for League', dot: 'bg-red', tone: 'border-red/40 text-red' },
  connecting: {
    text: 'Connecting',
    dot: 'bg-warning animate-pulse',
    tone: 'border-warning/40 text-warning'
  },
  connected: { text: 'Connected', dot: 'bg-cyan', tone: 'border-cyan/40 text-cyan' }
}

export function StatusPill({ state }: { state: ConnectionState }) {
  const status = STATUS[state]
  return (
    <span
      role="status"
      className={`inline-flex h-6 items-center gap-2 rounded-full border bg-surface px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-150 ${status.tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
      {status.text}
    </span>
  )
}
