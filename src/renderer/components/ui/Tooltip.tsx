import type { ReactNode } from 'react'

/** Hover / keyboard-focus tooltip. Wrap the trigger element. */
export function Tooltip({
  label,
  side = 'top',
  align = 'center',
  children
}: {
  label: string
  side?: 'top' | 'bottom' | 'right'
  /** Use `end` near the right window edge so the bubble stays inside the window. */
  align?: 'center' | 'end'
  children: ReactNode
}) {
  const position =
    side === 'right'
      ? 'left-full top-1/2 ml-2 -translate-y-1/2'
      : `${side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${
          align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'
        }`
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 rounded border border-border bg-elevated px-2 py-1 text-[11px] leading-none whitespace-nowrap text-primary opacity-0 shadow-lg shadow-base/60 transition-opacity delay-150 duration-150 group-has-[:focus-visible]/tip:opacity-100 group-hover/tip:opacity-100 ${position}`}
      >
        {label}
      </span>
    </span>
  )
}
