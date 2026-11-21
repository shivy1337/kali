import type { LookupProvider } from '../shared/types'

/** LCU region code -> Riot platform id (used by U.GG). Unknown regions fall back to lower-case. */
const PLATFORM: Record<string, string> = {
  EUNE: 'eun1',
  EUW: 'euw1',
  NA: 'na1',
  KR: 'kr',
  BR: 'br1',
  LAN: 'la1',
  LAS: 'la2',
  OCE: 'oc1',
  TR: 'tr1',
  RU: 'ru',
  JP: 'jp1',
  PH: 'ph2',
  SG: 'sg2',
  TH: 'th2',
  TW: 'tw2',
  VN: 'vn2',
  ME: 'me1'
}

const REGION = /^[A-Za-z0-9]{2,6}$/

interface RiotId {
  name: string
  tag: string
}

function parseRiotId(value: unknown): RiotId | null {
  if (typeof value !== 'string' || value.length > 40) return null
  const [name, tag, ...rest] = value.split('#')
  if (!name || !tag || rest.length > 0) return null
  return { name, tag }
}

const dashed = (id: RiotId): string => `${encodeURIComponent(id.name)}-${encodeURIComponent(id.tag)}`

/**
 * Lookup-site URLs are only ever built here, from validated parts, so the renderer cannot make
 * the app open arbitrary links. Both functions return `null` for invalid input.
 */
export function multiSearchUrl(provider: unknown, region: unknown, riotIds: unknown): string | null {
  if (typeof region !== 'string' || !REGION.test(region)) return null
  if (!Array.isArray(riotIds) || riotIds.length === 0 || riotIds.length > 10) return null
  const ids = riotIds.map(parseRiotId)
  if (ids.some((id) => id === null)) return null
  const players = ids as RiotId[]
  const r = region.toLowerCase()

  switch (provider as LookupProvider) {
    case 'opgg': {
      const list = encodeURIComponent(players.map((p) => `${p.name}#${p.tag}`).join(','))
      return `https://www.op.gg/multisearch/${r}?summoners=${list}`
    }
    case 'ugg': {
      const platform = PLATFORM[region.toUpperCase()] ?? r
      return `https://u.gg/multisearch?summoners=${players.map(dashed).join(',')}&region=${platform}`
    }
    default:
      return null
  }
}

export function profileUrl(provider: unknown, region: unknown, riotId: unknown): string | null {
  if (typeof region !== 'string' || !REGION.test(region)) return null
  const id = parseRiotId(riotId)
  if (!id) return null
  const r = region.toLowerCase()

  switch (provider as LookupProvider) {
    case 'opgg':
      return `https://www.op.gg/summoners/${r}/${dashed(id)}`
    case 'ugg':
      return `https://u.gg/lol/profile/${PLATFORM[region.toUpperCase()] ?? r}/${dashed(id)}/overview`
    default:
      return null
  }
}
