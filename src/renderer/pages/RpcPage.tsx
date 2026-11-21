import { useEffect, useState, type ReactNode } from 'react'
import {
  DISCORD_INVITE,
  INITIAL_RPC_STATUS,
  type IdleMode,
  type RankQueueChoice,
  type RpcSettings,
  type RpcState,
  type RpcStatus
} from '../../shared/rpc'
import { Icon } from '../components/ui/Icon'
import { Select, type SelectOption } from '../components/ui/Select'
import { Toggle } from '../components/ui/Toggle'

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

const RANK_QUEUES: SelectOption<RankQueueChoice>[] = [
  { value: 'solo', label: 'Solo/Duo' },
  { value: 'flex', label: 'Flex' }
]
const IDLE_MODES: SelectOption<IdleMode>[] = [
  { value: 'text', label: 'Custom text' },
  { value: 'profile', label: 'Profile info' }
]

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

function Row({
  title,
  description,
  disabled,
  control
}: {
  title: string
  description: string
  disabled?: boolean
  control: ReactNode
}) {
  return (
    <div className={`flex items-center gap-4 py-3.5 ${disabled ? 'opacity-40' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{title}</div>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      {control}
    </div>
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
  const off = !settings.enabled

  const sw = (key: keyof RpcSettings, label: string): ReactNode => (
    <Toggle
      checked={settings[key] as boolean}
      onChange={(v) => (off ? undefined : save({ ...settings, [key]: v }))}
      label={label}
    />
  )

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
        <Row
          title="Enable Rich Presence"
          description="Show your League status on your Discord profile."
          control={
            <Toggle
              checked={settings.enabled}
              onChange={(enabled) => save({ ...settings, enabled })}
              label="Enable Rich Presence"
            />
          }
        />
      </Section>

      <Section title="What to show">
        <Row
          title="Skin art"
          description="Use your skin's tile + name as the big image (falls back to the champion icon)."
          disabled={off}
          control={sw('useSkinSplash', 'Skin art')}
        />
        <Row
          title="Champion"
          description="Show the champion icon as the big image (when skin splash is off)."
          disabled={off}
          control={sw('showChampion', 'Champion')}
        />
        <Row
          title="Rank"
          description="Show your rank emblem, LP and (optionally) wins/losses."
          disabled={off}
          control={
            <div className="flex items-center gap-2">
              <Select
                compact
                label="Rank queue"
                value={settings.rankQueue}
                options={RANK_QUEUES}
                onChange={(rankQueue) => !off && save({ ...settings, rankQueue })}
              />
              {sw('showRank', 'Rank')}
            </div>
          }
        />
        <Row
          title="Wins / losses"
          description="Add this season's W/L next to your rank."
          disabled={off || !settings.showRank}
          control={sw('showWinLoss', 'Wins / losses')}
        />
        <Row
          title="In-game stats"
          description="Show live KDA, CS and level while in a game."
          disabled={off}
          control={sw('showStats', 'In-game stats')}
        />
        <Row
          title="Party size"
          description="Show your premade party size in the lobby and queue."
          disabled={off}
          control={sw('showParty', 'Party size')}
        />
        <Row
          title="Elapsed time"
          description="Show how long you've been in queue, champ select or the game."
          disabled={off}
          control={sw('showTimer', 'Elapsed time')}
        />
        <Row
          title="Join the Discord button"
          description={`A button on your activity linking to ${DISCORD_INVITE}.`}
          disabled={off}
          control={sw('showJoinButton', 'Join the Discord button')}
        />
      </Section>

      <Section title="Idle">
        <Row
          title="Idle presence"
          description="Show a status while sitting in the client between games."
          disabled={off}
          control={
            <div className="flex items-center gap-2">
              <Select
                compact
                label="Idle style"
                value={settings.idleMode}
                options={IDLE_MODES}
                onChange={(idleMode) => !off && save({ ...settings, idleMode })}
              />
              {sw('idleEnabled', 'Idle presence')}
            </div>
          }
        />
        {settings.idleEnabled && !off && settings.idleMode === 'text' && (
          <label className="block py-3.5">
            <span className="text-[13px] font-semibold">Idle text</span>
            <input
              type="text"
              value={settings.idleText}
              placeholder="In the client"
              onChange={(event) => save({ ...settings, idleText: event.target.value })}
              className="no-drag mt-2 h-9 w-full rounded-md border border-border bg-base px-3 text-[13px] text-primary outline-none placeholder:text-muted focus:border-accent/60"
            />
          </label>
        )}
      </Section>

      <Section title="Setup">
        <div className="space-y-2 py-3.5 text-xs text-muted">
          <p className="flex items-center gap-1.5 text-primary">
            <Icon name="info" size={13} className="text-muted" />
            No setup needed — just turn on Rich Presence.
          </p>
          <p>
            Kali uses its own shared Discord app, and images come from Community Dragon — nothing is
            uploaded to Discord and no token is needed. Your rank, champion and stats are your own
            live data.
          </p>
        </div>
      </Section>
    </div>
  )
}
