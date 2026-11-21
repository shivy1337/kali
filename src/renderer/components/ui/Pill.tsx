import type { ReactNode } from 'react'

export type PillVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'gold'

const VARIANTS: Record<PillVariant, string> = {
  neutral: 'border-border-hover text-muted',
  accent: 'border-accent/40 bg-accent-soft text-accent-hover',
  success: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  danger: 'border-red/50 bg-red/10 text-red',
  gold: 'border-gold/40 bg-gold/10 text-gold'
}

/** Small rounded tag, e.g. region "EUNE", "Level 73", "Banned · 6d 13h". */
export function Pill({
  variant = 'neutral',
  caps = false,
  round = false,
  children
}: {
  variant?: PillVariant
  /** Upper-case with tracking — for short codes like regions. */
  caps?: boolean
  /** Fully rounded status-badge shape. */
  round?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center border leading-none whitespace-nowrap ${
        round
          ? 'h-6 rounded-full px-2.5 text-[11px] font-semibold'
          : 'h-5 rounded px-1.5 font-mono text-[10px]'
      } ${
        VARIANTS[variant]
      } ${caps ? 'tracking-wider uppercase' : ''}`}
    >
      {children}
    </span>
  )
}
