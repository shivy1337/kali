/** Rank tier presentation: colours come from the theme tokens in theme.css. */

export interface TierStyle {
  /** Main tier colour (CSS value). */
  color: string
  /** Second colour for two-tone tiers (Challenger). */
  color2?: string
}

const TIERS: Record<string, TierStyle> = {
  IRON: { color: 'var(--color-tier-iron)' },
  BRONZE: { color: 'var(--color-tier-bronze)' },
  SILVER: { color: 'var(--color-tier-silver)' },
  GOLD: { color: 'var(--color-tier-gold)' },
  PLATINUM: { color: 'var(--color-tier-platinum)' },
  EMERALD: { color: 'var(--color-tier-emerald)' },
  DIAMOND: { color: 'var(--color-tier-diamond)' },
  MASTER: { color: 'var(--color-tier-master)' },
  GRANDMASTER: { color: 'var(--color-tier-grandmaster)' },
  CHALLENGER: { color: 'var(--color-tier-challenger)', color2: 'var(--color-tier-challenger-2)' }
}

const UNRANKED_STYLE: TierStyle = { color: 'var(--color-border-hover)' }

const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])

export function tierStyle(tier: string | null): TierStyle {
  return (tier && TIERS[tier]) || UNRANKED_STYLE
}

export function isApexTier(tier: string | null): boolean {
  return tier !== null && APEX.has(tier)
}

/** "MASTER" / "DIAMOND II" / "UNRANKED" */
export function rankLabel(tier: string | null, division: string | null): string {
  if (!tier) return 'Unranked'
  return division ? `${tier} ${division}` : tier
}
