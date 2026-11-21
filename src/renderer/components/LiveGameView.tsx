import type { LiveGame, LivePlayer } from '../../shared/types'
import { tierName } from '../lib/format'
import { positionLabel } from '../lib/phase'
import { usePrefs } from '../lib/prefs'
import { tierStyle } from '../lib/tiers'
import { useAsset } from '../lib/useAsset'
import { ItemRow } from './ItemRow'
import { Pill } from './ui/Pill'
import { TierImage } from './ui/RankEmblem'

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Display teams in role order: TOP, JG, MID, ADC, SUPP (players with no role keep their order).
const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
const roleRank = (position: string | null): number => {
  const i = position ? ROLE_ORDER.indexOf(position) : -1
  return i < 0 ? ROLE_ORDER.length : i
}
function byRole(players: LivePlayer[]): LivePlayer[] {
  return players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => roleRank(a.player.position) - roleRank(b.player.position) || a.index - b.index)
    .map((entry) => entry.player)
}

function RankCell({ ranked }: { ranked: LivePlayer['ranked'] }) {
  if (!ranked || !ranked.tier) {
    return <span className="text-[11px] text-muted">Unranked</span>
  }
  const color = tierStyle(ranked.tier).color
  return (
    <div className="flex items-center gap-1.5">
      <TierImage tier={ranked.tier} size={20} />
      <div className="leading-tight">
        <div className="text-[12px] font-semibold" style={{ color }}>
          {tierName(ranked.tier, ranked.division)}
        </div>
        <div className="font-mono text-[10px] text-muted">
          {ranked.leaguePoints} LP
          {ranked.winrate !== null ? ` · ${ranked.winrate}%` : ''}
        </div>
      </div>
    </div>
  )
}

function ChampCell({ player }: { player: LivePlayer }) {
  const icon = useAsset('champion', player.championId || null)
  return (
    <div className="relative shrink-0">
      {icon ? (
        <img src={icon} alt="" draggable={false} className="h-9 w-9 rounded-md object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface font-mono text-[9px] text-muted">
          {player.championName.slice(0, 2)}
        </div>
      )}
      {player.level > 0 && (
        <span className="absolute -right-1 -bottom-1 rounded bg-base px-1 font-mono text-[9px] text-muted">
          {player.level}
        </span>
      )}
    </div>
  )
}

function PlayerRow({
  player,
  isLocal,
  onOpen
}: {
  player: LivePlayer
  isLocal: boolean
  onOpen: () => void
}) {
  const pos = positionLabel(player.position)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`no-drag flex w-full items-center gap-3 rounded-md border px-2.5 py-1.5 text-left transition-colors duration-150 ${
        isLocal
          ? 'border-accent/60 bg-accent-soft hover:bg-accent-soft/80'
          : 'border-transparent hover:border-border-hover hover:bg-surface'
      }`}
    >
      <ChampCell player={player} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-[13px] leading-4">
          <span className="truncate font-semibold text-primary">
            {player.gameName || (player.isBot ? 'Bot' : 'Unknown')}
          </span>
          {player.tagLine && <span className="font-mono text-[10px] text-muted">#{player.tagLine}</span>}
          {pos && <span className="text-[10px] text-muted">· {pos}</span>}
        </div>
        <div className="mt-1">
          <RankCell ranked={player.ranked} />
        </div>
      </div>
      <div className="w-16 text-center">
        <div className="font-mono text-[12px]">
          {player.kills}/<span className="text-red">{player.deaths}</span>/{player.assists}
        </div>
        <div className="font-mono text-[10px] text-muted">{player.creepScore} CS</div>
      </div>
      <ItemRow items={player.items} />
    </button>
  )
}

function Team({
  title,
  players,
  localPuuid,
  tone,
  onOpen
}: {
  title: string
  players: LivePlayer[]
  localPuuid: string | null
  tone: string
  onOpen: (player: LivePlayer) => void
}) {
  return (
    <div>
      <div className={`mb-1 font-mono text-[10px] tracking-[0.16em] uppercase ${tone}`}>{title}</div>
      <div className="flex flex-col gap-0.5">
        {players.map((player) => (
          <PlayerRow
            key={`${player.side}-${player.championId}`}
            player={player}
            isLocal={!!localPuuid && player.puuid === localPuuid}
            onOpen={() => onOpen(player)}
          />
        ))}
      </div>
    </div>
  )
}

/** Live roster for a game in progress: both teams, ranks and live KDA / CS / items. */
export function LiveGameView({
  game,
  localPuuid,
  region,
  className = ''
}: {
  game: LiveGame
  localPuuid: string | null
  region: string | null
  className?: string
}) {
  const prefs = usePrefs()
  const your = byRole(game.players.filter((p) => p.side === 'your'))
  const enemy = byRole(game.players.filter((p) => p.side === 'enemy'))
  // Clicking a player jumps straight to their op.gg (or the chosen lookup provider).
  const openProfile = (p: LivePlayer): void => {
    if (!region || !p.gameName) return
    const riotId = p.tagLine ? `${p.gameName}#${p.tagLine}` : p.gameName
    window.kali.openPlayerProfile(prefs.lookup, region, riotId)
  }

  return (
    <section
      className={`rounded-card border border-border bg-elevated p-4 transition-colors duration-150 ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[14px] font-bold">Live game</h2>
        {game.queueName && <Pill>{game.queueName}</Pill>}
        <Pill variant="success" round>
          {clock(game.gameTime)}
        </Pill>
      </div>
      <div className="flex flex-col gap-3">
        <Team
          title="Your team"
          players={your}
          localPuuid={localPuuid}
          tone="text-cyan"
          onOpen={openProfile}
        />
        <Team
          title="Enemy team"
          players={enemy}
          localPuuid={localPuuid}
          tone="text-red"
          onOpen={openProfile}
        />
      </div>
    </section>
  )
}
