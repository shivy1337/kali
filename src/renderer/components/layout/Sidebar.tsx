import logoUrl from '../../../../resources/icon.png'
import { PAGES, type PageId } from '../../pages'
import { BrandIcon, type BrandName } from '../ui/BrandIcon'
import { Icon, type IconName } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'

const ITEM =
  'no-drag flex h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] transition-colors duration-150'

// Placeholders: no log folder / URLs are configured yet, so these do nothing for now.
const LINKS: { label: string; icon: IconName; brand?: BrandName }[] = [
  { label: 'Logs', icon: 'logs' },
  { label: 'Discord', icon: 'chat', brand: 'discord' },
  { label: 'Website', icon: 'globe' }
]

export function Sidebar({
  page,
  onNavigate,
  version
}: {
  page: PageId
  onNavigate: (page: PageId) => void
  version: string
}) {
  return (
    <aside className="drag flex w-[200px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <img src={logoUrl} alt="" className="h-8 w-8 rounded-md border border-gold/60 object-cover"
          draggable={false}
        />
        <span className="font-display text-[16px] font-bold tracking-wider uppercase">Kali</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 pt-2" aria-label="Main">
        {PAGES.map((item) => {
          const active = item.id === page
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
              className={`${ITEM} relative ${
                active
                  ? 'bg-accent-soft font-semibold text-primary'
                  : 'text-muted hover:bg-elevated hover:text-primary'
              }`}
            >
              {active && (
                <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-accent" />
              )}
              <Icon name={item.icon} className={active ? 'text-accent-hover' : ''} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {LINKS.map((link) => (
          <Tooltip key={link.label} label="Not set up yet" side="right">
            <button
              type="button"
              aria-disabled="true"
              className={`${ITEM} !h-8 text-xs text-muted hover:bg-elevated hover:text-primary`}
            >
              {link.brand ? (
                <BrandIcon name={link.brand} size={14} />
              ) : (
                <Icon name={link.icon} size={14} />
              )}
              {link.label}
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3 font-mono text-[11px] text-muted">
        {version ? `v${version}` : ' '}
      </div>
    </aside>
  )
}
