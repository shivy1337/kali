import type { ReactNode } from 'react'
import type { Profile } from '../../shared/types'
import { Pill } from './ui/Pill'
import { Skeleton } from './ui/Skeleton'

/**
 * Avatar + Riot ID + pills for one player. `profile={null}` renders the skeleton.
 * `extraPills` are appended after region / level.
 */
export function PlayerIdentity({
  profile,
  size = 64,
  extraPills
}: {
  profile: Profile | null
  size?: number
  extraPills?: ReactNode
}) {
  const box = { width: size, height: size }
  if (!profile) {
    return (
      <div className="flex items-center gap-3.5">
        <div style={box} className="shrink-0">
          <Skeleton className="h-full w-full !rounded-card" />
        </div>
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      {profile.profileIconDataUrl ? (
        <img
          src={profile.profileIconDataUrl}
          alt=""
          draggable={false}
          style={box}
          className="shrink-0 rounded-card border border-accent/60 object-cover"
        />
      ) : (
        <div style={box} className="shrink-0 rounded-card border border-accent/60 bg-surface" />
      )}
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5 select-text">
          <span className="truncate text-[16px] font-bold text-primary">{profile.gameName}</span>
          <span className="font-mono text-xs text-muted">#{profile.tagLine}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.region && <Pill caps>{profile.region}</Pill>}
          <Pill>Level {profile.summonerLevel}</Pill>
          {extraPills}
        </div>
      </div>
    </div>
  )
}
