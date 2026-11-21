import { useAsset } from '../lib/useAsset'

function ItemSlot({ id, size }: { id: number | null; size: number }) {
  const icon = useAsset('item', id)
  const box = { width: size, height: size }
  if (id && icon) {
    return (
      <img src={icon} alt="" draggable={false} style={box} className="rounded-sm object-cover" />
    )
  }
  return <span style={box} className="rounded-sm border border-border bg-surface/60" />
}

/** A player's items: six slots plus the trinket. */
export function ItemRow({ items, size = 20 }: { items: number[]; size?: number }) {
  const trinket = items[6] ?? null
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 6 }, (_, slot) => (
        <ItemSlot key={slot} id={items[slot] ?? null} size={size} />
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" />
      <ItemSlot id={trinket} size={size} />
    </div>
  )
}
