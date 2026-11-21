import type { ConnectionState, GamePhase } from '../../shared/types'

const LABELS: Record<string, string> = {
  None: 'Idle',
  Lobby: 'In lobby',
  Matchmaking: 'In queue',
  CheckedIntoTournament: 'In tournament',
  ReadyCheck: 'Match found',
  ChampSelect: 'Champ select',
  GameStart: 'Game starting',
  FailedToLaunch: 'Failed to launch',
  InProgress: 'In game',
  Reconnect: 'Reconnect available',
  WaitingForStats: 'Waiting for stats',
  PreEndOfGame: 'Game over',
  EndOfGame: 'Post-game',
  TerminatedInError: 'Game ended in error'
}

/** Short label for what the client is doing, for the title bar. */
export function phaseLabel(connection: ConnectionState, phase: GamePhase): string {
  if (connection !== 'connected') return 'Offline'
  return LABELS[phase] ?? phase
}

const POSITIONS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support'
}

export function positionLabel(position: string | null): string | null {
  if (!position) return null
  return POSITIONS[position] ?? position
}
