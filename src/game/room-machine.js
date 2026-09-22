export const ROOM_PHASE = Object.freeze({
  WAITING: 'waiting',
  LAUNCHING: 'launching',
  TURN: 'turn',
  PAUSED: 'paused',
  ROUND_END: 'round-end',
  NEXT_ROUND: 'next-round',
  MATCH_END: 'match-end',
  CANCELLED: 'cancelled'
});

const TRANSITIONS = Object.freeze({
  [ROOM_PHASE.WAITING]: Object.freeze([ROOM_PHASE.LAUNCHING, ROOM_PHASE.CANCELLED]),
  [ROOM_PHASE.LAUNCHING]: Object.freeze([ROOM_PHASE.TURN]),
  [ROOM_PHASE.TURN]: Object.freeze([ROOM_PHASE.PAUSED, ROOM_PHASE.ROUND_END, ROOM_PHASE.MATCH_END, ROOM_PHASE.CANCELLED]),
  [ROOM_PHASE.PAUSED]: Object.freeze([ROOM_PHASE.TURN, ROOM_PHASE.ROUND_END, ROOM_PHASE.MATCH_END, ROOM_PHASE.CANCELLED]),
  [ROOM_PHASE.ROUND_END]: Object.freeze([ROOM_PHASE.NEXT_ROUND, ROOM_PHASE.MATCH_END, ROOM_PHASE.CANCELLED]),
  [ROOM_PHASE.NEXT_ROUND]: Object.freeze([ROOM_PHASE.TURN]),
  [ROOM_PHASE.MATCH_END]: Object.freeze([ROOM_PHASE.LAUNCHING, ROOM_PHASE.CANCELLED]),
  [ROOM_PHASE.CANCELLED]: Object.freeze([])
});

export function inferredRoomPhase(room) {
  if (!room || room.status === 'cancelled') return ROOM_PHASE.CANCELLED;
  if (room.status === 'waiting') return ROOM_PHASE.WAITING;
  if (room.status === 'finished') return ROOM_PHASE.MATCH_END;
  if (room.game?.roundStatus === 'ended') return ROOM_PHASE.ROUND_END;
  if (room.game?.turnClock?.paused) return ROOM_PHASE.PAUSED;
  return room.status === 'playing' ? ROOM_PHASE.TURN : ROOM_PHASE.WAITING;
}

export function roomPhase(room) {
  const inferred = inferredRoomPhase(room);
  const recorded = room?.phase;
  // Transitional states exist for the duration of an atomic mutation. Stable
  // stored phases must always agree with the actual game data.
  return [ROOM_PHASE.LAUNCHING, ROOM_PHASE.NEXT_ROUND].includes(recorded) ? recorded : inferred;
}

export function canTransitionRoom(room, next) {
  const current = roomPhase(room);
  return current === next || Boolean(TRANSITIONS[current]?.includes(next));
}

export function transitionRoom(room, next, at = Date.now()) {
  const current = roomPhase(room);
  if (!canTransitionRoom(room, next)) {
    const error = new Error(`Transition de salle interdite : ${current} → ${next}.`);
    error.code = 'invalid-room-transition';
    throw error;
  }
  room.phase = next;
  room.phaseChangedAt = at;
  return room;
}

export function synchronizeRoomPhase(room, at = Date.now()) {
  if (!room) return room;
  const next = inferredRoomPhase(room);
  if (room.phase !== next) {
    room.phase = next;
    room.phaseChangedAt = at;
  }
  return room;
}

export function phaseAllowsInteraction(room) {
  return roomPhase(room) === ROOM_PHASE.TURN;
}
