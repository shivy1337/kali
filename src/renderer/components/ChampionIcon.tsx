import type { LobbyChampion } from '../../shared/types'
import { useAsset } from '../lib/useAsset'

/** Square champion portrait; shows initials if the image is unavailable, a dashed box if no pick. */
export function ChampionIcon({
  champion,
  size = 40,
  plain = false
}: {
  champion: LobbyChampion | null
  size?: number
  /** Neutral border, no locked/hovering styling (for lists that aren't about a pick). */
  plain?: boolean
}) {
  const icon = useAsset('champion', champion ? champion.id : null)
  const box = { width: size, height: size }

  if (!champion) {
    return <div style={box} className="shrink-0 rounded-md border border-dashed border-border" />
  }
  if (!icon) {
    return (
      <div
        style={box}
        className="flex shrink-0 items-center justify-center rounded-md border border-border bg-surface font-mono text-[10px] text-muted uppercase"
      >
        {champion.name.slice(0, 2)}
      </div>
    )
  }
  return (
    <img
      src={icon}
      alt={champion.name}
      title={champion.name}
      draggable={false}
      style={box}
      className={`shrink-0 rounded-md border object-cover transition-opacity duration-150 ${
        plain ? 'border-border' : champion.locked ? 'border-gold/70' : 'border-border opacity-60'
      }`}
    />
  )
}
