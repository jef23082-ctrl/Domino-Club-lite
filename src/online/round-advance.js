import { roomPlayers } from '../game/room-state.js?v=20261001T025219457';
import { roundGateKey } from './round-gate.js?v=20261001T025219457';

// A late acknowledgement for round N must not erase the intent for round N+1.
export function sameRoundRequest(first, second) {
  return Boolean(first && second
    && String(first.matchId) === String(second.matchId)
    && Number(first.roundNumber) === Number(second.roundNumber)
    && Number(first.resultAt) === Number(second.resultAt));
}

export function createRoundAdvanceRequest(room, playerId) {
  if (room?.status !== 'playing' || room.game?.roundStatus !== 'ended' || !room.game.roundResult) throw new Error('La manche n’est pas terminée.');
  if (!roomPlayers(room).some(player => String(player.playerId) === String(playerId))) throw new Error('Seul un joueur de la salle peut lancer la manche suivante.');
  return {
    matchId: String(room.matchId || room.code),
    roundNumber: Number(room.game.roundNumber),
    resultAt: Number(room.game.roundResult.at),
    requestedBy: String(playerId)
  };
}

export function matchesRoundAdvanceRequest(room, request) {
  if (!room || !request || room.status !== 'playing' || room.game?.roundStatus !== 'ended') return false;
  return String(request.matchId) === String(room.matchId || room.code)
    && Number(request.roundNumber) === Number(room.game.roundNumber)
    && Number(request.resultAt) === Number(room.game.roundResult?.at)
    && roomPlayers(room).some(player => String(player.playerId) === String(request.requestedBy))
    && Boolean(roundGateKey(room));
}
