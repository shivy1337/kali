import type { ReactNode } from 'react'

/** Label (muted) on the left, value (mono) on the right. */
export function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] text-xs">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-primary">{children}</span>
    </div>
  )
}
