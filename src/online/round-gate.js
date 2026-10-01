import { CELEBRATION_DURATION } from './presentation.js?v=20261001T025219457';

export function roundGateKey(room) {
  const game = room?.game;
  return game?.roundResult ? `${room.matchId || room.code}:${game.roundNumber}:${game.roundResult.at}` : '';
}

export function createRoundGate(room, _serverNow, monotonicNow) {
  // The presentation starts when this browser actually receives the result.
  // No machine clock or database timestamp participates in the ten seconds.
  return { key: roundGateKey(room), startedAt: monotonicNow, initialRemaining: CELEBRATION_DURATION };
}

export function roundGateRemaining(gate, monotonicNow) {
  return Math.max(0, gate.initialRemaining - Math.max(0, monotonicNow - gate.startedAt));
}
