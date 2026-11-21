import type { LivePlayer } from '../../shared/types'
import { tierName } from '../lib/format'
import { positionLabel } from '../lib/phase'
import { LOOKUP_LABELS, usePrefs } from '../lib/prefs'
import { tierStyle } from '../lib/tiers'
import { ChampionIcon } from './ChampionIcon'
import { ItemRow } from './ItemRow'
import { Button, IconButton } from './ui/Button'
import { Modal } from './ui/Modal'
import { TierImage } from './ui/RankEmblem'

const PANEL = 'rounded-card border border-border bg-elevated p-3.5'
const LABEL = 'mb-2 font-mono text-[10px] tracking-[0.16em] text-muted uppercase'

/** Details for one player in the live game, opened by clicking their row. */
export function LivePlayerModal({
  player,
  region,
  onClose
}: {
  player: LivePlayer
  /** Platform code for the lookup link (all players share the local player's). */
  region: string | null
  onClose: () => void
}) {
  const prefs = usePrefs()
  const ranked = player.ranked
  const pos = positionLabel(player.position)
  const name = player.gameName || (player.isBot ? 'Bot' : 'Unknown')
  const riotId = player.tagLine ? `${name}#${player.tagLine}` : name

  return (
    <Modal label={riotId} onClose={onClose}>
      <div className="flex items-start gap-3.5">
        <ChampionIcon
          champion={{ id: player.championId, name: player.championName, locked: true }}
          size={52}
          plain
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="truncate text-[16px] leading-5 select-text">
            <span className="font-bold text-primary">{name}</span>
            {player.tagLine && <span className="text-muted">#{player.tagLine}</span>}
          </div>
          <div className="mt-1 truncate text-xs text-muted">
            {player.championName}
            {player.level > 0 ? ` · Lvl ${player.level}` : ''}
            {pos ? ` · ${pos}` : ''}
            {` · ${player.side === 'your' ? 'Your team' : 'Enemy team'}`}
          </div>
        </div>
        <IconButton icon="close" label="Close" tooltipAlign="end" onClick={onClose} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className={PANEL}>
          <div className={LABEL}>Solo/Duo</div>
          {ranked && ranked.tier ? (
            <>
              <div className="flex items-center gap-2.5">
                <TierImage tier={ranked.tier} size={34} />
                <div className="min-w-0">
                  <div
                    className="truncate text-[15px] leading-5 font-bold"
                    style={{ color: tierStyle(ranked.tier).color }}
                  >
                    {tierName(ranked.tier, ranked.division)}
                  </div>
                  <div className="text-xs text-muted">{ranked.leaguePoints} LP</div>
                </div>
              </div>
              {ranked.winrate !== null && (
                <div className="mt-3 text-xs text-muted">
                  {ranked.winrate}% · {ranked.wins}W {ranked.losses}L
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-muted">Unranked / unavailable.</div>
          )}
        </div>
        <div className={PANEL}>
          <div className={LABEL}>This game</div>
          <div className="font-mono text-[15px]">
            {player.kills}/<span className="text-red">{player.deaths}</span>/{player.assists}
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted">{player.creepScore} CS</div>
          <div className="mt-2.5">
            <ItemRow items={player.items} size={22} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Button
          plain
          icon="external"
          iconAfter
          className="!h-9 w-full !text-[13px]"
          disabled={!region || !player.gameName}
          onClick={() => region && window.kali.openPlayerProfile(prefs.lookup, region, riotId)}
        >
          Open {LOOKUP_LABELS[prefs.lookup]} profile
        </Button>
      </div>
    </Modal>
  )
}
