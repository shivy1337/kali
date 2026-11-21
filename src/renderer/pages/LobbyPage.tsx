import type { ConnectionState, LiveGame, Lobby, Profile } from '../../shared/types'
import { AccountCard } from '../components/AccountCard'
import { ChampSelectPanel } from '../components/ChampSelectPanel'
import { LiveGameView } from '../components/LiveGameView'
import { LookupPrefs } from '../components/LookupPrefs'
import { RecentLobbiesCard } from '../components/RecentLobbiesCard'
import { Card, EmptyState } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'

export function LobbyPage({
  connection,
  profile,
  lobby,
  recentLobbies,
  liveGame
}: {
  connection: ConnectionState
  profile: Profile | null
  lobby: Lobby | null
  recentLobbies: Lobby[]
  liveGame: LiveGame | null
}) {
  // During a live game, give the roster the whole window so all ten players fit without maximizing.
  if (liveGame) {
    return (
      <div className="grid grid-cols-1 gap-4">
        <LiveGameView
          game={liveGame}
          localPuuid={profile?.puuid ?? null}
          region={profile?.region ?? null}
          className="col-span-full"
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <LookupPrefs className="col-span-full" />

      {/* Champ select is the focus when active, so it goes first. */}
      {lobby && <ChampSelectPanel lobby={lobby} className="col-span-full" />}

      <AccountCard
        className="col-span-full"
        title="My account"
        profile={profile}
        connection={connection}
      />

      {!lobby && (
        <Card title="Current lobby">
          <EmptyState icon={<Icon name="swords" size={22} />}>Waiting for champ select…</EmptyState>
        </Card>
      )}
      <RecentLobbiesCard lobbies={recentLobbies} className={lobby ? 'col-span-full' : ''} />
    </div>
  )
}
