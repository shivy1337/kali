import { useState } from 'react'
import type { Lobby, LobbyPlayer } from '../../shared/types'
import { tierName } from '../lib/format'
import { LOOKUP_LABELS, usePrefs } from '../lib/prefs'
import { tierStyle } from '../lib/tiers'
import { ChampionIcon } from './ChampionIcon'
import { CopyTextButton } from './CopyButton'
import { PlayerDetailModal } from './PlayerDetailModal'
import { Button } from './ui/Button'
import { Pill } from './ui/Pill'
import { TierImage } from './ui/RankEmblem'

const ROW =
  'flex h-12 w-full items-center gap-3 rounded-card border border-border bg-surface px-2.5 text-left transition-colors duration-150'

function PickBadge({ index }: { index: number }) {
  return (
    <span className="absolute -bottom-1 -left-1 rounded border border-border bg-base px-1 font-mono text-[8px] leading-3 text-muted">
      P{index}
    </span>
  )
}

function PlayerRow({ player, onOpen }: { player: LobbyPlayer; onOpen: () => void }) {
  const { profile, champion, insights } = player
  const pick = player.cellId + 1

  if (!profile) {
    return (
      <li className={ROW}>
        <span className="relative shrink-0">
          <ChampionIcon champion={champion} size={32} plain />
          <PickBadge index={pick} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-muted">Hidden player</div>
          <div className="truncate text-[11px] text-muted">
            {champion ? `${champion.name}${champion.locked ? '' : ' (hovering)'}` : 'No pick yet'}
          </div>
        </div>
      </li>
    )
  }

  const solo = profile.ranked?.solo ?? null
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`${ROW} hover:border-accent/60 hover:bg-elevated`}
      >
        <span className="relative shrink-0">
          {profile.profileIconDataUrl ? (
            <img
              src={profile.profileIconDataUrl}
              alt=""
              draggable={false}
              className="h-8 w-8 rounded-md border border-border object-cover"
            />
          ) : (
            <span className="block h-8 w-8 rounded-md border border-border bg-elevated" />
          )}
          <PickBadge index={pick} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-4">
            <span className="font-semibold text-primary">{profile.gameName}</span>
            <span className="text-muted">#{profile.tagLine}</span>
            {player.isLocalPlayer && <span className="ml-1.5 text-[10px] text-accent-hover">you</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted">
            {solo ? (
              <>
                <TierImage tier={solo.tier} size={14} />
                <span
                  className="font-semibold"
                  style={{ color: solo.tier ? tierStyle(solo.tier).color : undefined }}
                >
                  {solo.tier ? tierName(solo.tier, solo.division) : 'Unranked'}
                </span>
                {solo.tier && <span>· {solo.leaguePoints} LP</span>}
                {insights?.recentSolo && <span>· {insights.recentSolo.winrate}%</span>}
              </>
            ) : (
              'Rank unavailable'
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          {(insights?.mostPlayed ?? []).map((c) => (
            <ChampionIcon
              key={c.championId}
              champion={{ id: c.championId, name: c.name, locked: true }}
              size={20}
              plain
            />
          ))}
        </div>
      </button>
    </li>
  )
}

/** Compact live champ select: one row per teammate, details on click. */
export function ChampSelectPanel({ lobby, className = '' }: { lobby: Lobby; className?: string }) {
  const [openCell, setOpenCell] = useState<number | null>(null)
  const prefs = usePrefs()
  const revealed = lobby.players.filter((p) => p.profile !== null)
  const ids = revealed.map((p) => `${p.profile!.gameName}#${p.profile!.tagLine}`)
  const region = revealed.find((p) => p.profile?.region)?.profile?.region ?? null
  const hidden = lobby.players.length - revealed.length
  // Look the open player up on every render so the dialog follows live updates.
  const open = lobby.players.find((p) => p.cellId === openCell && p.profile !== null)

  return (
    <section
      className={`rounded-card border border-border bg-elevated p-4 transition-colors duration-150 ${className}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-bold">Champ Select</h2>
            {lobby.queueName && <Pill>{lobby.queueName}</Pill>}
            {lobby.side && (
              <Pill variant={lobby.side === 'blue' ? 'accent' : 'danger'} caps>
                {lobby.side} side
              </Pill>
            )}
            {lobby.lastPick && (
              <Pill variant={lobby.lastPick === 'your' ? 'gold' : 'neutral'}>
                Last pick: {lobby.lastPick === 'your' ? 'your team' : 'enemy'}
              </Pill>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {hidden === 0
              ? 'Teammate identities are ready.'
              : `${hidden} of ${lobby.players.length} teammates are hidden by the client.`}
          </p>
        </div>
        <Pill variant="accent" round>
          {revealed.length}/{lobby.players.length} found
        </Pill>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {lobby.players.map((player) => (
          <PlayerRow
            key={player.cellId}
            player={player}
            onOpen={() => {
              const profile = player.profile
              if (prefs.playerClick === 'profile' && profile?.region) {
                void window.kali.openPlayerProfile(
                  prefs.lookup,
                  profile.region,
                  `${profile.gameName}#${profile.tagLine}`
                )
              } else {
                setOpenCell(player.cellId)
              }
            }}
          />
        ))}
      </ul>

      <div className="mt-4 flex gap-2">
        <CopyTextButton text={ids.join('\n')}>Copy names</CopyTextButton>
        <Button
          plain
          icon="external"
          iconAfter
          className="!h-9 flex-1 !text-[13px]"
          disabled={ids.length === 0 || !region}
          onClick={() => region && void window.kali.openMultiSearch(prefs.lookup, region, ids)}
        >
          Open team multi-search on {LOOKUP_LABELS[prefs.lookup]}
        </Button>
      </div>

      {open && open.profile && (
        <PlayerDetailModal player={open} profile={open.profile} onClose={() => setOpenCell(null)} />
      )}
    </section>
  )
}
