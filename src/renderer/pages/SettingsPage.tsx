import { useEffect, useState, type ReactNode } from 'react'
import {
  ACCEPT_DELAYS,
  INITIAL_QUEUE_STATUS,
  LOOKUP_DELAYS,
  PAUSE_SECONDS,
  QUEUE_AGAIN_DELAYS,
  RESTART_DELAYS,
  ROLES,
  type ActTiming,
  type AutomationSettings,
  type QueueStatus,
  type Role
} from '../../shared/automation'
import type { AppSettings } from '../../shared/app'
import { ChampionList } from '../components/ChampionList'
import { Icon } from '../components/ui/Icon'
import { Select, type SelectOption } from '../components/ui/Select'
import { Toggle } from '../components/ui/Toggle'
import { Tooltip } from '../components/ui/Tooltip'

const secLabel = (n: number): string => (n === 0 ? 'Instant' : `${n}s`)
const pauseLabel = (n: number | null): string => (n === null ? '∞' : `${n}s`)

function numOptions(values: readonly number[], label: (n: number) => string): SelectOption<string>[] {
  return values.map((value) => ({ value: String(value), label: label(value) }))
}

const ACCEPT_OPTIONS = numOptions(ACCEPT_DELAYS, secLabel)
const QUEUE_AGAIN_OPTIONS = numOptions(QUEUE_AGAIN_DELAYS, secLabel)
const RESTART_OPTIONS = numOptions(RESTART_DELAYS, secLabel)
const LOOKUP_OPTIONS = numOptions(LOOKUP_DELAYS, secLabel)
const PAUSE_OPTIONS: SelectOption<string>[] = PAUSE_SECONDS.map((value) => ({
  value: value === null ? 'inf' : String(value),
  label: pauseLabel(value)
}))
const TIMING_OPTIONS: SelectOption<ActTiming>[] = [
  { value: 'last', label: 'Last' },
  { value: 'instant', label: 'Instant' }
]
const ROLE_LABELS: Record<Role, string> = {
  top: 'Top',
  jungle: 'Jungle',
  middle: 'Mid',
  bottom: 'ADC',
  utility: 'Support'
}

function Title({ title, info }: { title: string; info: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13px] font-semibold">{title}</span>
      <Tooltip label={info}>
        <Icon name="info" size={13} className="text-muted" />
      </Tooltip>
    </div>
  )
}

/** One automation line: title + info, description, a value picker, and the on/off toggle. */
function Row({
  title,
  info,
  description,
  enabled,
  onToggle,
  value,
  options,
  onValue
}: {
  title: string
  info: string
  description: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  value: string
  options: SelectOption<string>[]
  onValue: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <Title title={title} info={info} />
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <Select compact label={`${title} value`} value={value} options={options} onChange={onValue} />
      <Toggle checked={enabled} onChange={onToggle} label={title} />
    </div>
  )
}

/** Title + description with only an on/off toggle (no value picker). */
function ToggleRow({
  title,
  info,
  description,
  enabled,
  onToggle
}: {
  title: string
  info: string
  description: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <Title title={title} info={info} />
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <Toggle checked={enabled} onChange={onToggle} label={title} />
    </div>
  )
}

/** A line whose body is a champion list (ban / lock). */
function ListBlock({
  title,
  info,
  description,
  enabled,
  onToggle,
  timing,
  onTiming,
  children
}: {
  title: string
  info: string
  description: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  timing: ActTiming
  onTiming: (timing: ActTiming) => void
  children: ReactNode
}) {
  return (
    <div className="py-3.5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <Title title={title} info={info} />
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
        <Select
          compact
          label={`${title} timing`}
          value={timing}
          options={TIMING_OPTIONS}
          onChange={onTiming}
        />
        <Toggle checked={enabled} onChange={onToggle} label={title} />
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  )
}

function RoleTabs({
  picks,
  active,
  onActive
}: {
  picks: Record<Role, number[]>
  active: Role
  onActive: (role: Role) => void
}) {
  return (
    <div className="mb-3.5 flex gap-1 rounded-md border border-border bg-surface p-1">
      {ROLES.map((role) => {
        const on = role === active
        return (
          <button
            key={role}
            type="button"
            onClick={() => onActive(role)}
            className={`no-drag flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors duration-150 ${
              on ? 'bg-accent-soft font-semibold text-primary' : 'text-muted hover:text-primary'
            }`}
          >
            {ROLE_LABELS[role]}
            <span className={`font-mono text-[10px] ${on ? 'text-accent-hover' : 'text-muted'}`}>
              {picks[role].length}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-elevated px-4">
      <h2 className="border-b border-border py-3 font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
        {title}
      </h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

function StatusLine({ status }: { status: QueueStatus }) {
  if (status.paused) {
    return <Status dot="bg-warning" tone="text-warning" text="Queue paused after a dodge" />
  }
  if (status.searching) {
    return <Status dot="bg-cyan animate-pulse" tone="text-cyan" text="In queue" />
  }
  return <Status dot="bg-border-hover" tone="text-muted" text="Automation idle" />
}

function Status({ dot, tone, text }: { dot: string; tone: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className={tone}>{text}</span>
    </div>
  )
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null)
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState<QueueStatus>(INITIAL_QUEUE_STATUS)
  const [role, setRole] = useState<Role>('top')

  useEffect(() => {
    let cancelled = false
    void window.kali.getAutomation().then((state) => {
      if (cancelled) return
      setSettings(state.settings)
      setStatus(state.status)
    })
    void window.kali.getAppSettings().then((value) => {
      if (!cancelled) setAppSettings(value)
    })
    const off = window.kali.onQueueStatus(setStatus)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  function save(next: AutomationSettings): void {
    setSettings(next) // optimistic
    void window.kali.setAutomation(next).then((stored) => setSettings(stored))
  }

  function saveApp(next: AppSettings): void {
    setAppSettings(next)
    void window.kali.setAppSettings(next).then((stored) => setAppSettings(stored))
  }

  if (!settings) return null
  const q = settings.queue
  const cs = settings.champSelect
  const setQueue = (queue: AutomationSettings['queue']): void => save({ ...settings, queue })
  const setCs = (champSelect: AutomationSettings['champSelect']): void =>
    save({ ...settings, champSelect })

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      <StatusLine status={status} />

      <Section title="Queue">
        <Row
          title="Accept matches automatically"
          info="Kali waits the chosen time before accepting, so you can still decline the ready check yourself."
          description="Waits first, so you can still decline it yourself"
          enabled={q.autoAccept.enabled}
          onToggle={(enabled) => setQueue({ ...q, autoAccept: { ...q.autoAccept, enabled } })}
          value={String(q.autoAccept.delaySeconds)}
          options={ACCEPT_OPTIONS}
          onValue={(v) => setQueue({ ...q, autoAccept: { ...q.autoAccept, delaySeconds: Number(v) } })}
        />
        <Row
          title="Queue again after a game"
          info="When a game ends and you return to the lobby, Kali re-enters the same queue after this delay."
          description="Once the game ends, back to the lobby and into the same queue"
          enabled={q.queueAgain.enabled}
          onToggle={(enabled) => setQueue({ ...q, queueAgain: { ...q.queueAgain, enabled } })}
          value={String(q.queueAgain.delaySeconds)}
          options={QUEUE_AGAIN_OPTIONS}
          onValue={(v) => setQueue({ ...q, queueAgain: { ...q.queueAgain, delaySeconds: Number(v) } })}
        />
        <Row
          title="Restart long queues"
          info="Once you're this many seconds past League's estimated queue time, Kali leaves the queue and rejoins."
          description="Once you've waited well past League's estimate, leave the queue and rejoin"
          enabled={q.restartLongQueue.enabled}
          onToggle={(enabled) =>
            setQueue({ ...q, restartLongQueue: { ...q.restartLongQueue, enabled } })
          }
          value={String(q.restartLongQueue.delaySeconds)}
          options={RESTART_OPTIONS}
          onValue={(v) =>
            setQueue({ ...q, restartLongQueue: { ...q.restartLongQueue, delaySeconds: Number(v) } })
          }
        />
        <Row
          title="Pause queue after a dodge"
          info="After someone dodges champ select, Kali holds off auto-requeue for this long (∞ = until you clear it)."
          description="Return to the lobby and wait before queuing again; the automatic requeues wait too"
          enabled={q.pauseAfterDodge.enabled}
          onToggle={(enabled) =>
            setQueue({ ...q, pauseAfterDodge: { ...q.pauseAfterDodge, enabled } })
          }
          value={q.pauseAfterDodge.seconds === null ? 'inf' : String(q.pauseAfterDodge.seconds)}
          options={PAUSE_OPTIONS}
          onValue={(v) =>
            setQueue({
              ...q,
              pauseAfterDodge: { ...q.pauseAfterDodge, seconds: v === 'inf' ? null : Number(v) }
            })
          }
        />
      </Section>

      <Section title="Champ select">
        <Row
          title="Open lookup automatically"
          info="Opens your multi-search site once all five names are in, or after the wait — whichever comes first."
          description="Opens your multi-search site once all five names are in, or after the wait"
          enabled={cs.openLookup.enabled}
          onToggle={(enabled) => setCs({ ...cs, openLookup: { ...cs.openLookup, enabled } })}
          value={String(cs.openLookup.delaySeconds)}
          options={LOOKUP_OPTIONS}
          onValue={(v) => setCs({ ...cs, openLookup: { ...cs.openLookup, delaySeconds: Number(v) } })}
        />

        <ListBlock
          title="Ban automatically"
          info="Bans the champion you're hovering, or else the first one from this list the client lets you ban. With 'Last', it waits until the final seconds so you can override."
          description="Your hover, or else the first available champion from this list"
          enabled={cs.autoBan.enabled}
          onToggle={(enabled) => setCs({ ...cs, autoBan: { ...cs.autoBan, enabled } })}
          timing={cs.autoBan.timing}
          onTiming={(timing) => setCs({ ...cs, autoBan: { ...cs.autoBan, timing } })}
        >
          <ChampionList
            ids={cs.autoBan.championIds}
            onChange={(championIds) => setCs({ ...cs, autoBan: { ...cs.autoBan, championIds } })}
            pickerTitle="Ban automatically"
            addLabel="Add a champion to ban"
          />
        </ListBlock>

        <ListBlock
          title="Lock in automatically"
          info="Locks the champion you're hovering, or else the first one for your assigned role the client lets you pick. With 'Last', it waits until the final seconds so you can override."
          description="Your hover, or else the first available champion for the role you got"
          enabled={cs.autoLock.enabled}
          onToggle={(enabled) => setCs({ ...cs, autoLock: { ...cs.autoLock, enabled } })}
          timing={cs.autoLock.timing}
          onTiming={(timing) => setCs({ ...cs, autoLock: { ...cs.autoLock, timing } })}
        >
          <RoleTabs picks={cs.autoLock.picks} active={role} onActive={setRole} />
          <ChampionList
            ids={cs.autoLock.picks[role]}
            onChange={(list) =>
              setCs({
                ...cs,
                autoLock: { ...cs.autoLock, picks: { ...cs.autoLock.picks, [role]: list } }
              })
            }
            pickerTitle={`${ROLE_LABELS[role]} picks`}
            addLabel={`Add ${ROLE_LABELS[role]} picks, in order of preference`}
          />
        </ListBlock>
      </Section>

      {appSettings && (
        <Section title="App">
          <ToggleRow
            title="Launch on startup"
            info="Start Kali automatically when Windows starts, so it's already running before League (and Rich Presence catches everything). Starts hidden in the tray. Applies to the installed app, not dev mode."
            description="Open Kali with Windows, hidden in the tray, ready before League"
            enabled={appSettings.launchOnStartup}
            onToggle={(launchOnStartup) => saveApp({ ...appSettings, launchOnStartup })}
          />
          <ToggleRow
            title="Show on champ select"
            info="When champ select starts, Kali comes to the front and opens the Lobby page."
            description="Bring Kali to the front and open Lobby when champ select begins"
            enabled={appSettings.showOnChampSelect}
            onToggle={(showOnChampSelect) => saveApp({ ...appSettings, showOnChampSelect })}
          />
          <ToggleRow
            title="Close to tray"
            info="With this on, the X button hides Kali to the system tray and it keeps running; quit it from the tray icon."
            description="Closing the window keeps Kali running in the tray instead of quitting"
            enabled={appSettings.closeToTray}
            onToggle={(closeToTray) => saveApp({ ...appSettings, closeToTray })}
          />
        </Section>
      )}
    </div>
  )
}
