import { useEffect, useState, type ReactNode } from 'react'
import {
  BUNDLED_APP_ID,
  INITIAL_RPC_STATUS,
  type RpcSettings,
  type RpcState,
  type RpcStatus
} from '../../shared/rpc'
import { Icon } from '../components/ui/Icon'
import { Toggle } from '../components/ui/Toggle'
import { Tooltip } from '../components/ui/Tooltip'

const SUGGESTED_APP_NAME = 'discord.gg/kaliapp'

const STATUS: Record<RpcState, { label: string; dot: string; tone: string }> = {
  off: { label: 'Off', dot: 'bg-border-hover', tone: 'text-muted' },
  'no-app-id': { label: 'No App ID set', dot: 'bg-warning', tone: 'text-warning' },
  'waiting-for-discord': {
    label: 'Waiting for Discord…',
    dot: 'bg-warning animate-pulse',
    tone: 'text-warning'
  },
  connected: { label: 'Connected', dot: 'bg-cyan', tone: 'text-cyan' }
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

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
  disabled
}: {
  title: string
  description: string
  enabled: boolean
  onToggle: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center gap-4 py-3.5 ${disabled ? 'opacity-40' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{title}</div>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <Toggle checked={enabled} onChange={disabled ? () => {} : onToggle} label={title} />
    </div>
  )
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  mono
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  mono?: boolean
}) {
  return (
    <label className="block py-3.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`no-drag mt-2 h-9 w-full rounded-md border border-border bg-base px-3 text-[13px] text-primary outline-none placeholder:text-muted focus:border-accent/60 ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  )
}

export function RpcPage() {
  const [settings, setSettings] = useState<RpcSettings | null>(null)
  const [status, setStatus] = useState<RpcStatus>(INITIAL_RPC_STATUS)

  useEffect(() => {
    let cancelled = false
    void window.kali.getRpc().then((state) => {
      if (cancelled) return
      setSettings(state.settings)
      setStatus(state.status)
    })
    const off = window.kali.onRpcStatus(setStatus)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  function save(next: RpcSettings): void {
    setSettings(next)
    void window.kali.setRpc(next).then((stored) => setSettings(stored))
  }

  if (!settings) return null
  const s = STATUS[status.state]
  const hasBundled = BUNDLED_APP_ID !== ''
  const needsAppId = settings.enabled && !settings.appId && !hasBundled

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <span className={s.tone}>{s.label}</span>
        {status.state === 'connected' && status.detail && (
          <span className="truncate text-muted">· {status.detail}</span>
        )}
      </div>

      <Section title="Discord Rich Presence">
        <ToggleRow
          title="Enable Rich Presence"
          description="Show your League status on your Discord profile."
          enabled={settings.enabled}
          onToggle={(enabled) => save({ ...settings, enabled })}
        />
        <Field
          label={hasBundled ? 'Custom Application ID (optional)' : 'Discord Application ID'}
          value={settings.appId}
          placeholder={
            hasBundled ? 'Leave empty to use the built-in Kali app' : 'Paste your Discord application ID'
          }
          onChange={(appId) => save({ ...settings, appId: appId.trim() })}
          mono
        />
        {needsAppId && (
          <div className="pb-3.5 text-[11px] text-warning">
            Rich Presence needs an Application ID — follow the setup steps below.
          </div>
        )}
      </Section>

      <Section title="What to show">
        <ToggleRow
          title="Champion"
          description="Show the champion you're playing or hovering as the large image."
          enabled={settings.showChampion}
          onToggle={(showChampion) => save({ ...settings, showChampion })}
          disabled={!settings.enabled}
        />
        <ToggleRow
          title="Rank"
          description="Show your Solo/Duo rank and LP."
          enabled={settings.showRank}
          onToggle={(showRank) => save({ ...settings, showRank })}
          disabled={!settings.enabled}
        />
        <ToggleRow
          title="Elapsed time"
          description="Show how long you've been in queue, champ select or the game."
          enabled={settings.showTimer}
          onToggle={(showTimer) => save({ ...settings, showTimer })}
          disabled={!settings.enabled}
        />
        <ToggleRow
          title="Idle presence"
          description="Show a status while sitting in the client between games."
          enabled={settings.idleEnabled}
          onToggle={(idleEnabled) => save({ ...settings, idleEnabled })}
          disabled={!settings.enabled}
        />
        {settings.idleEnabled && settings.enabled && (
          <Field
            label="Idle text"
            value={settings.idleText}
            placeholder="In the client"
            onChange={(idleText) => save({ ...settings, idleText })}
          />
        )}
      </Section>

      <Section title="Setup">
        {hasBundled ? (
          <div className="space-y-2 py-3.5 text-xs text-muted">
            <p className="flex items-center gap-1.5 text-primary">
              <Icon name="info" size={13} className="text-muted" />
              No setup needed — just turn on Rich Presence.
            </p>
            <p>
              Kali uses its own shared Discord app ({' '}
              <span className="font-mono text-primary">{SUGGESTED_APP_NAME}</span>), so your activity
              shows that name. Advanced: paste your own Application ID above to use a different app.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 py-3.5 text-xs text-muted">
            <p className="flex items-center gap-1.5 text-primary">
              <Icon name="info" size={13} className="text-muted" />
              One-time setup, so your activity shows as your own app.
            </p>
            <ol className="ml-1 list-inside list-decimal space-y-1.5">
            <li>
              Open the Discord Developer Portal:{' '}
              <span className="font-mono text-accent-hover">discord.com/developers/applications</span>
            </li>
            <li>
              Click <span className="text-primary">New Application</span> and name it{' '}
              <span className="font-mono text-primary">{SUGGESTED_APP_NAME}</span>{' '}
              <Tooltip label="The app name is what viewers see on your activity. Discord may reject names containing 'discord.gg' — if so, use something like 'kaliapp'.">
                <Icon name="info" size={12} className="inline text-muted" />
              </Tooltip>
            </li>
            <li>
              On the <span className="text-primary">General Information</span> page, copy the{' '}
              <span className="text-primary">Application ID</span> and paste it above.
            </li>
            <li>Make sure Discord is running, then enable Rich Presence.</li>
          </ol>
            <p>
              Images come from Community Dragon — nothing is uploaded to Discord, and no bot token
              is needed.
            </p>
          </div>
        )}
      </Section>
    </div>
  )
}
