/** Pill switch: green dot on the right when on, grey on the left when off. */
export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name. */
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`no-drag relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 ${
        checked ? 'border-success/50 bg-success/15' : 'border-border-hover bg-surface'
      }`}
    >
      <span
        className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all duration-150 ${
          checked ? 'left-[22px] bg-success' : 'left-1 bg-muted'
        }`}
      />
    </button>
  )
}
