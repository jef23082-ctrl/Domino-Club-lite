const present = value => value !== undefined && value !== null && String(value) !== '';
const same = (a, b) => present(a) && present(b) && String(a) === String(b);
const players = room => Object.values(room?.players || {});

// Profile identity survives a refresh/second tab; a transport token does not.
// Token-only callers remain compatible with rooms and clients created before V57.
export function roomActor(room, { playerId, clientToken } = {}) {
  return players(room).find(player => present(playerId)
    ? same(player.playerId, playerId) : Boolean(clientToken && player.token === clientToken)) || null;
}
export function roomHostId(room) {
  return room?.hostPlayerId ?? players(room).find(player => player.token === room?.hostToken)?.playerId;
}
export function roomCreatorId(room) {
  return room?.creatorPlayerId ?? players(room).find(player => player.token === (room?.creatorToken || room?.hostToken))?.playerId;
}
export function isRoomHost(room, context = {}) {
  const member = roomActor(room, context);
  return Boolean(member && same(member.playerId, roomHostId(room)));
}
export function isRoomCreator(room, context = {}) {
  return present(context.playerId) ? same(context.playerId, roomCreatorId(room))
    : Boolean(context.clientToken && context.clientToken === (room?.creatorToken || room?.hostToken));
}
