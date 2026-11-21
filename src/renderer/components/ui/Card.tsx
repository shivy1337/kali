import type { ReactNode } from 'react'
import { IconButton } from './Button'

/**
 * Standard Kali card: header (title + pills + ⋮ menu), body, optional footer for actions.
 */
export function Card({
  title,
  pills,
  footer,
  className = '',
  children
}: {
  title: string
  /** `Pill`s shown next to the title. */
  pills?: ReactNode
  /** Action row, e.g. an outline `Button` plus icon buttons. */
  footer?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`flex flex-col rounded-card border border-border bg-elevated transition-colors duration-150 hover:border-border-hover ${className}`}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 pr-1.5 pl-4">
        <h2 className="truncate font-display text-[13px] font-bold tracking-wide">{title}</h2>
        {pills}
        <div className="flex-1" />
        {/* Placeholder: the menu has no actions yet. */}
        <IconButton icon="more" label="More (coming soon)" tooltipAlign="end" aria-disabled="true" />
      </header>
      <div className="flex-1 px-4 pb-4">{children}</div>
      {footer && (
        <footer className="flex items-center gap-2 border-t border-border px-4 py-3">{footer}</footer>
      )}
    </section>
  )
}

/** Centered icon + message for cards that have nothing to show yet. */
export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[104px] flex-col items-center justify-center gap-2.5 rounded-md border border-dashed border-border text-center text-xs text-muted">
      <span className="text-border-hover">{icon}</span>
      {children}
    </div>
  )
}
