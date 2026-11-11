import { CELEBRATION_DURATION } from './presentation.js?v=20261005T162819119';
import { roundWinReadyAt } from '../game/engine.js?v=58-r7';

export function roundGateKey(room) {
  const game = room?.game;
  return game?.roundResult ? `${room.matchId || room.code}:${game.roundNumber}:${game.roundResult.at}` : '';
}

export function createRoundGate(room, serverNow, monotonicNow) {
  const readyAt = roundWinReadyAt(room);
  const initialRemaining = room?.status === 'finished'
    ? CELEBRATION_DURATION
    : Math.max(0, readyAt - serverNow);
  return { key: roundGateKey(room), startedAt: monotonicNow, initialRemaining };
}

export function roundGateRemaining(gate, monotonicNow) {
  return Math.max(0, gate.initialRemaining - Math.max(0, monotonicNow - gate.startedAt));
}
