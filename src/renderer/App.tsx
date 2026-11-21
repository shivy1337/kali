import { useEffect, useState } from 'react'
import { AutoLookup } from './components/AutoLookup'
import { Sidebar } from './components/layout/Sidebar'
import { TitleBar } from './components/layout/TitleBar'
import { phaseLabel } from './lib/phase'
import { PAGES, type PageId } from './pages'
import { ComingSoon } from './pages/ComingSoon'
import { HistoryPage } from './pages/HistoryPage'
import { LobbyPage } from './pages/LobbyPage'
import { RpcPage } from './pages/RpcPage'
import { SettingsPage } from './pages/SettingsPage'
import { useKali } from './useKali'

export function App() {
  const { version, connection, profile, phase, lobby, recentLobbies, liveGame, maximized } =
    useKali()
  const [pageId, setPageId] = useState<PageId>('lobby')
  const page = PAGES.find((p) => p.id === pageId)!

  // Main brings the window forward on champ select; jump to the Lobby page to match.
  useEffect(() => window.kali.onShowChampSelect(() => setPageId('lobby')), [])
  // The Lobby page's section label follows what the client is doing right now.
  const section = page.id === 'lobby' ? phaseLabel(connection, phase) : page.section

  return (
    <div className="flex h-full bg-base">
      <AutoLookup lobby={lobby} />
      <Sidebar page={pageId} onNavigate={setPageId} version={version} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar
          section={section}
          title={page.label}
          connection={connection}
          maximized={maximized}
        />
        <main className="flex-1 overflow-y-auto p-5">
          {page.id === 'lobby' ? (
            <LobbyPage
              connection={connection}
              profile={profile}
              lobby={lobby}
              recentLobbies={recentLobbies}
              liveGame={liveGame}
            />
          ) : page.id === 'history' ? (
            <HistoryPage lobbies={recentLobbies} />
          ) : page.id === 'settings' ? (
            <SettingsPage />
          ) : page.id === 'rpc' ? (
            <RpcPage />
          ) : (
            <ComingSoon label={page.label} icon={page.icon} />
          )}
        </main>
      </div>
    </div>
  )
}
