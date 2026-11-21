/** "MASTER" -> "Master", "DIAMOND" + "II" -> "Diamond II" */
export function tierName(tier: string, division: string | null): string {
  const name = tier.charAt(0) + tier.slice(1).toLowerCase()
  return division ? `${name} ${division}` : name
}

/** 44053 -> "44k", 1250000 -> "1.3M", 950 -> "950" */
export function formatPoints(points: number): string {
  if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(1)}M`
  if (points >= 1_000) return `${Math.round(points / 1_000)}k`
  return String(points)
}

/** "just now", "5 minutes ago", "14 hours ago", "3 days ago" */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'} ago`
  if (minutes < 60) return plural(minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return plural(hours, 'hour')
  return plural(Math.floor(hours / 24), 'day')
}
