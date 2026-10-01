import { GameRuleError, roomPlayers, startNextRoundInRoom } from './room-state.js?v=20261001T025219457';

// One durable command per result, stored WITH the room, not in a second relay.
// Its identity never depends on a tab token, host, DOM node or countdown.
export function roundTransitionId(request) {
  return JSON.stringify([String(request.matchId), Number(request.roundNumber), Number(request.resultAt)]);
}

export function roundTransitionConfirmed(room, request) {
  return Boolean(room && request
    && String(room.matchId || room.code) === String(request.matchId)
    && Number(room.game?.roundNumber) > Number(request.roundNumber));
}

export function roundTransitionMatches(room, request) {
  return Boolean(room && request && room.status === 'playing' && room.game?.roundStatus === 'ended'
    && String(room.matchId || room.code) === String(request.matchId)
    && Number(room.game.roundNumber) === Number(request.roundNumber)
    && Number(room.game.roundResult?.at) === Number(request.resultAt)
    && roomPlayers(room).some(p => String(p.playerId) === String(request.requestedBy)));
}

function requirePlayer(room, playerId) {
  if (!roomPlayers(room).some(p => String(p.playerId) === String(playerId))) {
    throw new GameRuleError('Seul un joueur de la salle peut lancer la manche suivante.', 'player-not-seated');
  }
}

function requireResult(room, request) {
  if (String(room?.matchId || room?.code) !== String(request?.matchId)) {
    throw new GameRuleError('La partie a changé.', 'stale-match');
  }
  if (!roundTransitionMatches(room, request)) {
    throw new GameRuleError('Le résultat de la manche a changé. La table va se resynchroniser.', 'stale-result');
  }
}

export function queueRoundTransition(room, { request, playerId, at = Date.now() }) {
  requirePlayer(room, playerId);
  if (roundTransitionConfirmed(room, request)) return room;
  requireResult(room, request);
  const id = roundTransitionId(request);
  if (room.roundTransition?.command?.id === id) return room;
  room.roundTransition = {
    protocol: 2,
    command: { ...request, id, status: 'requested', requestedAt: at },
    ...(room.roundTransition?.receipt ? { receipt: room.roundTransition.receipt } : {})
  };
  // This writes metadata only. No new hand or score before the atomic commit.
  return room;
}

export function commitRoundTransition(room, { request, playerId, at = Date.now(), randomIndex }) {
  requirePlayer(room, playerId);
  if (roundTransitionConfirmed(room, request)) return room;
  requireResult(room, request);
  const id = roundTransitionId(request);
  const command = room.roundTransition?.command;
  if (command?.id !== id || command.status !== 'requested') {
    throw new GameRuleError('La demande doit être enregistrée avant la distribution.', 'round-command-missing');
  }
  startNextRoundInRoom(room, {
    playerId, at, randomIndex, expectedMatchId: request.matchId,
    expectedRoundNumber: request.roundNumber, expectedResultAt: request.resultAt
  });
  // Distribution and receipt are a SINGLE Firebase compare-and-swap. A lost
  // HTTP response, simultaneous click or late retry cannot distribute twice.
  room.roundTransition = {
    protocol: 2,
    command: { ...command, status: 'applied' },
    receipt: { id, matchId: request.matchId, fromRound: request.roundNumber,
      resultAt: request.resultAt, toRound: room.game.roundNumber, appliedBy: String(playerId), appliedAt: at }
  };
  return room;
}
