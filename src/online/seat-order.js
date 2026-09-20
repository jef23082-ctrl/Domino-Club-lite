import { roomPlayers } from '../game/room-state.js?v=20260920T151452528';

// Match the unchanged engine order to clockwise physical seats, for every viewer.
// The club leader may be visually promoted to the top seat without changing the engine order.
export const CLOCKWISE_SEATS = Object.freeze(['top', 'right', 'left']);
export function seatedPlayers(room, leaderPlayerId = '') {
  const players = roomPlayers(room);
  const order = room?.game?.playerOrder;
  const candidates = !Array.isArray(order) || order.length !== players.length
    ? players
    : order.map(id => players.find(p => String(p.playerId) === String(id)));
  const ordered = candidates.every(Boolean) && new Set(candidates).size === players.length ? candidates : players;
  const leaderIndex = ordered.findIndex(player => leaderPlayerId && String(player.playerId) === String(leaderPlayerId));
  if (leaderIndex <= 0) return ordered;
  return [ordered[leaderIndex], ...ordered.slice(0, leaderIndex), ...ordered.slice(leaderIndex + 1)];
}
