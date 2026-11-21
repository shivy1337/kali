import { useEffect, type ReactNode } from 'react'

/** Centered dialog over a dimmed backdrop. Closes on Escape or a click outside. */
export function Modal({
  label,
  onClose,
  children
}: {
  /** Accessible name of the dialog. */
  label: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="no-drag fixed inset-0 z-40 flex items-center justify-center bg-base/75 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="w-full max-w-[460px] rounded-card border border-border-hover bg-surface p-5 shadow-2xl shadow-base"
      >
        {children}
      </div>
    </div>
  )
}
