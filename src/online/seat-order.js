import { roomPlayers } from '../game/room-state.js';

// Match the unchanged engine order to clockwise physical seats, for every viewer.
export const CLOCKWISE_SEATS = Object.freeze(['top', 'right', 'left']);
export function seatedPlayers(room) {
  const players = roomPlayers(room);
  const order = room?.game?.playerOrder;
  if (!Array.isArray(order) || order.length !== players.length) return players;
  const ordered = order.map(id => players.find(p => String(p.playerId) === String(id)));
  return ordered.every(Boolean) && new Set(ordered).size === players.length ? ordered : players;
}
