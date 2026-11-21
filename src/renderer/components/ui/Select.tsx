import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

/** Labelled dropdown: small uppercase label, a button showing the choice, and a popup list. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false
}: {
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** Hide the label (kept for screen readers) and size to content — for inline value pickers. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className={`relative ${compact ? 'inline-block' : 'min-w-0'}`}>
      <div
        id={labelId}
        className={`font-mono text-[10px] tracking-[0.16em] text-muted uppercase ${
          compact ? 'sr-only' : 'mb-1.5'
        }`}
      >
        {label}
      </div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen((value) => !value)}
        className={`no-drag flex items-center gap-2 rounded-md border bg-surface text-left font-semibold transition-colors duration-150 hover:border-border-hover ${
          compact ? 'h-8 min-w-[72px] px-2.5 text-xs' : 'h-9 w-full px-3 text-[13px]'
        } ${open ? 'border-accent/60' : 'border-border'}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ''}</span>
        <Icon name="chevrons" size={14} className="shrink-0 text-muted" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={labelId}
          className={`absolute top-full z-30 mt-1.5 rounded-md border border-border-hover bg-surface p-1 shadow-xl shadow-base ${
            compact ? 'right-0 min-w-full' : 'right-0 left-0'
          }`}
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex h-8 w-full items-center gap-2 rounded px-2.5 text-left text-[13px] transition-colors duration-150 ${
                    active
                      ? 'bg-accent-soft font-semibold text-accent-hover'
                      : 'text-primary hover:bg-elevated'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {active && <Icon name="check" size={14} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
