import type { LobbyPlayer, Profile } from '../../shared/types'
import { formatPoints, tierName } from '../lib/format'
import { LOOKUP_LABELS, usePrefs } from '../lib/prefs'
import { tierStyle } from '../lib/tiers'
import { ChampionIcon } from './ChampionIcon'
import { CopyTextButton } from './CopyButton'
import { Button, IconButton } from './ui/Button'
import { Modal } from './ui/Modal'
import { TierImage } from './ui/RankEmblem'

const PANEL = 'rounded-card border border-border bg-elevated p-3.5'
const PANEL_LABEL = 'mb-2.5 font-mono text-[10px] tracking-[0.16em] text-muted uppercase'

function SoloPanel({ player, profile }: { player: LobbyPlayer; profile: Profile }) {
  const solo = profile.ranked?.solo ?? null
  const recent = player.insights?.recentSolo ?? null
  return (
    <div className={PANEL}>
      <div className={PANEL_LABEL}>Solo/Duo</div>
      {solo ? (
        <>
          <div className="flex items-center gap-2.5">
            <TierImage tier={solo.tier} size={36} />
            <div className="min-w-0">
              <div
                className="truncate text-[15px] leading-5 font-bold"
                style={{ color: solo.tier ? tierStyle(solo.tier).color : undefined }}
              >
                {solo.tier ? tierName(solo.tier, solo.division) : 'Unranked'}
              </div>
              {solo.tier && <div className="text-xs text-muted">{solo.leaguePoints} LP</div>}
            </div>
          </div>
          <div className="mt-3 text-xs text-muted">{solo.wins} wins this season</div>
        </>
      ) : (
        <div className="text-xs text-muted">Ranked stats unavailable.</div>
      )}
      {recent && (
        <>
          <div className="mt-1.5 text-xs text-muted">
            Last {recent.games}: <span className="font-semibold text-success">{recent.wins}W</span>{' '}
            <span className="font-semibold text-red">{recent.losses}L</span> · {recent.winrate}%
          </div>
          <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-red/40">
            <div className="bg-success" style={{ width: `${recent.winrate}%` }} />
          </div>
        </>
      )}
    </div>
  )
}

function MostPlayedPanel({ player }: { player: LobbyPlayer }) {
  const champions = player.insights?.mostPlayed ?? []
  return (
    <div className={PANEL}>
      <div className={PANEL_LABEL}>Most played</div>
      {champions.length === 0 ? (
        <div className="text-xs text-muted">No mastery data.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {champions.map((champion) => (
            <li key={champion.championId} className="flex items-center gap-2.5">
              <ChampionIcon
                champion={{ id: champion.championId, name: champion.name, locked: true }}
                size={26}
                plain
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {champion.name}
              </span>
              <span className="font-mono text-[11px] text-muted">
                M{champion.level} · {formatPoints(champion.points)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Details for one revealed teammate; opened by clicking their row in champ select. */
export function PlayerDetailModal({
  player,
  profile,
  onClose
}: {
  player: LobbyPlayer
  profile: Profile
  onClose: () => void
}) {
  const prefs = usePrefs()
  const riotId = `${profile.gameName}#${profile.tagLine}`
  const pick = player.champion
    ? ` · ${player.champion.name}${player.champion.locked ? '' : ' (hovering)'}`
    : ''

  return (
    <Modal label={riotId} onClose={onClose}>
      <div className="flex items-start gap-3.5">
        {profile.profileIconDataUrl ? (
          <img
            src={profile.profileIconDataUrl}
            alt=""
            draggable={false}
            className="h-14 w-14 shrink-0 rounded-card border border-border object-cover"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-card border border-border bg-elevated" />
        )}
        <div className="min-w-0 flex-1 pt-1">
          <div className="truncate text-[17px] leading-6 select-text">
            <span className="font-bold text-primary">{profile.gameName}</span>
            <span className="text-muted">#{profile.tagLine}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">
            Pick {player.cellId + 1}
            {pick}
          </div>
        </div>
        <IconButton icon="close" label="Close" tooltipAlign="end" onClick={onClose} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SoloPanel player={player} profile={profile} />
        <MostPlayedPanel player={player} />
      </div>

      <div className="mt-4 flex gap-2">
        <CopyTextButton text={riotId}>Copy Riot ID</CopyTextButton>
        <Button
          plain
          icon="external"
          iconAfter
          className="!h-9 flex-1 !text-[13px]"
          disabled={!profile.region}
          onClick={() =>
            profile.region &&
            void window.kali.openPlayerProfile(prefs.lookup, profile.region, riotId)
          }
        >
          Open {LOOKUP_LABELS[prefs.lookup]} profile
        </Button>
      </div>
    </Modal>
  )
}
