/** Pulsing placeholder block; size it with className. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-border/70 ${className}`} />
}
