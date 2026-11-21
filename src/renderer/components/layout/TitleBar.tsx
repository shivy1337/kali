import type { ConnectionState } from '../../../shared/types'
import { Icon, type IconName } from '../ui/Icon'
import { StatusPill } from '../ui/StatusPill'
import { Tooltip } from '../ui/Tooltip'

function WindowButton({
  label,
  icon,
  danger,
  onClick
}: {
  label: string
  icon: IconName
  danger?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip label={label} side="bottom" align="end">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={`no-drag flex h-8 w-10 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:text-primary ${
          danger ? 'hover:bg-red' : 'hover:bg-elevated'
        }`}
      >
        <Icon name={icon} size={14} />
      </button>
    </Tooltip>
  )
}

/** Title bar across the top of the main area; also the window drag handle. */
export function TitleBar({
  section,
  title,
  connection,
  maximized
}: {
  section: string
  title: string
  connection: ConnectionState
  maximized: boolean
}) {
  return (
    <header className="drag flex h-14 shrink-0 items-center gap-3 border-b border-border pr-2 pl-5">
      <div className="min-w-0">
        <div className="truncate font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
          {section}
        </div>
        <h1 className="truncate font-display text-[18px] leading-6 font-bold tracking-wider uppercase">
          {title}
        </h1>
      </div>
      <div className="flex-1" />
      <StatusPill state={connection} />
      <div className="ml-1 flex items-center">
        <WindowButton label="Minimize" icon="minimize" onClick={() => window.kali.window.minimize()} />
        <WindowButton
          label={maximized ? 'Restore' : 'Maximize'}
          icon={maximized ? 'restore' : 'maximize'}
          onClick={() => window.kali.window.toggleMaximize()}
        />
        <WindowButton label="Close" icon="close" danger onClick={() => window.kali.window.close()} />
      </div>
    </header>
  )
}
