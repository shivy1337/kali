import { useId } from 'react'
import type { RankedQueue } from '../../../shared/types'
import { isApexTier, rankLabel, tierStyle, type TierStyle } from '../../lib/tiers'
import { useAsset } from '../../lib/useAsset'
import { Skeleton } from './Skeleton'

/** Themed fallback badge used when the client's emblem image is not available. */
function TierBadge({ style, ranked, size }: { style: TierStyle; ranked: boolean; size: number }) {
  const id = useId()
  const top = style.color
  const bottom = style.color2 ?? style.color
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} stopOpacity={ranked ? 0.55 : 0} />
          <stop offset="1" stopColor={bottom} stopOpacity={ranked ? 0.12 : 0} />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <path
        d="M24 3 41 11v15c0 9-8 15.5-17 19C15 41.5 7 35 7 26V11Z"
        fill={`url(#${id}-fill)`}
        stroke={`url(#${id}-edge)`}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeDasharray={ranked ? undefined : '3 3'}
      />
      {ranked && (
        <path
          d="M24 11.5 30 24h-4v11h-4V24h-4Z"
          fill={`url(#${id}-edge)`}
          stroke="var(--color-base)"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

/** Just the emblem image for a tier (real client art, themed badge as fallback). */
export function TierImage({ tier, size }: { tier: string | null; size: number }) {
  const emblem = useAsset('emblem', tier ?? 'UNRANKED')
  if (emblem) {
    return (
      <img
        src={emblem}
        alt=""
        draggable={false}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
      />
    )
  }
  return <TierBadge style={tierStyle(tier)} ranked={tier !== null} size={size} />
}

/**
 * Tier emblem + tier name + division + LP, with a thin tier-coloured underline.
 * Pass `queue={null}` for the loading skeleton.
 */
export function RankEmblem({ queue, size = 64 }: { queue: RankedQueue | null; size?: number }) {
  if (queue === null) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <div style={{ width: size, height: size }} className="shrink-0">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        <div className="mt-2.5 h-0.5 rounded-full bg-border" />
      </div>
    )
  }

  const style = tierStyle(queue.tier)
  const ranked = queue.tier !== null

  return (
    <div>
      <div className="flex items-center gap-3">
        <TierImage tier={queue.tier} size={size} />
        <div className="min-w-0">
          <div
            className={`truncate font-display text-[16px] leading-5 font-bold tracking-wide uppercase ${
              !ranked ? 'text-muted' : isApexTier(queue.tier) ? 'text-gold' : 'text-primary'
            }`}
          >
            {rankLabel(queue.tier, queue.division)}
          </div>
          <div className={`mt-0.5 font-mono text-xs ${ranked ? 'text-gold' : 'text-muted'}`}>
            {ranked ? `${queue.leaguePoints} LP` : '—'}
          </div>
        </div>
      </div>
      <div
        className="mt-2.5 h-0.5 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${style.color}, ${style.color2 ?? style.color} 45%, transparent)`
        }}
      />
    </div>
  )
}
