import { Icon, type IconName } from '../components/ui/Icon'

export function ComingSoon({ label, icon }: { label: string; icon: IconName }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-card border border-border bg-elevated text-muted">
        <Icon name={icon} size={22} />
      </span>
      <div className="font-display text-[15px] font-bold tracking-wide">Coming soon</div>
      <p className="text-xs text-muted">{label} isn’t available yet.</p>
    </div>
  )
}
