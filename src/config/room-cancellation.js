// This is the stable club profile id, independent of names and admin access.
export const KHALIL_PROFILE_ID = 3;

export function isRoomCancellationModerator(playerId) {
  return playerId !== null && playerId !== undefined && String(playerId) === String(KHALIL_PROFILE_ID);
}

export function isCancellableRoom(room) {
  return Boolean(room && !room.deleted && ['waiting', 'playing'].includes(room.status));
}
