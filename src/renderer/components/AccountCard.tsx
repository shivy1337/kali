import { useEffect, useState } from 'react'
import type { ConnectionState, Profile, RankedQueue } from '../../shared/types'
import { PlayerIdentity } from './PlayerIdentity'
import { Button, IconButton } from './ui/Button'
import { Card } from './ui/Card'
import { RankEmblem } from './ui/RankEmblem'
import { Skeleton } from './ui/Skeleton'
import { StatRow } from './ui/StatRow'

/** One ranked queue: label, emblem, and its stat rows. `queue={null}` renders the skeleton. */
function QueueBlock({ label, queue }: { label: string; queue: RankedQueue | null }) {
  const games = queue ? queue.wins + queue.losses : 0
  return (
    <div className="min-w-0">
      <div className="mb-2 font-mono text-[10px] tracking-[0.16em] text-muted">{label}</div>
      <RankEmblem queue={queue} />
      <div className="mt-2">
        {queue === null ? (
          <div className="space-y-2 pt-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : (
          <>
            <StatRow label="LP">
              {queue.tier ? <span className="text-gold">{queue.leaguePoints}</span> : '—'}
            </StatRow>
            <StatRow label="Winrate">
              {queue.winrate === null ? (
                '—'
              ) : (
                <>
                  {queue.winrate}%{' '}
                  <span className="text-muted">
                    · {queue.wins}W {queue.losses}L
                  </span>
                </>
              )}
            </StatRow>
            <StatRow label="Games">{games}</StatRow>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Account card for the logged-in player, driven entirely by a `Profile`.
 * `profile={null}` while `connecting` shows the skeleton.
 */
export function AccountCard({
  title,
  profile,
  connection,
  className
}: {
  title: string
  profile: Profile | null
  connection: ConnectionState
  className?: string
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  async function refresh() {
    setRefreshing(true)
    // Keep the spinner up briefly so a fast refresh is still visible.
    await Promise.all([window.kali.refreshProfile(), new Promise((r) => setTimeout(r, 500))])
    setRefreshing(false)
  }

  async function copyRiotId() {
    if (!profile) return
    await window.kali.copyText(`${profile.gameName}#${profile.tagLine}`)
    setCopied(true)
  }

  const footer = (
    <>
      <Button
        variant="outline"
        icon="refresh"
        iconSpin={refreshing}
        disabled={connection !== 'connected' || refreshing}
        onClick={refresh}
      >
        Refresh
      </Button>
      <IconButton
        icon={copied ? 'check' : 'copy'}
        label={copied ? 'Copied' : 'Copy Riot ID'}
        disabled={!profile}
        onClick={copyRiotId}
        className={copied ? '!text-success' : ''}
      />
    </>
  )

  if (connection === 'disconnected') {
    return (
      <Card title={title} footer={footer} className={className}>
        <div className="flex min-h-[132px] items-center justify-center rounded-md border border-dashed border-border text-xs text-muted">
          Open League of Legends to see your account.
        </div>
      </Card>
    )
  }

  return (
    <Card title={title} footer={footer} className={className}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex items-center">
          <PlayerIdentity profile={profile} />
        </div>
        <div className="md:border-l md:border-border md:pl-5">
          <QueueBlock label="SOLO/DUO" queue={profile?.ranked?.solo ?? null} />
        </div>
        <div className="md:border-l md:border-border md:pl-5">
          <QueueBlock label="FLEX" queue={profile?.ranked?.flex ?? null} />
        </div>
      </div>
    </Card>
  )
}
