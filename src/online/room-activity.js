import { roomPlayers } from '../game/room-state.js';
export const PRESENCE_MAX_AGE = 120000;
export function connectedRoomPlayers(room, presences, now = Date.now()) {
  return roomPlayers(room).filter(player => Object.entries(presences || {}).some(([token,presence]) =>
    presence && token === player.token && String(presence.playerId) === String(player.playerId)
    && presence.roomCode === room.code && presence.role === 'player'
    && Number(presence.lastSeen) > 0 && now - Number(presence.lastSeen) < PRESENCE_MAX_AGE
    && Number(presence.lastSeen) <= now + 60000));
}
export function activeRooms(rooms, presences, now = Date.now()) {
  return Object.entries(rooms || {}).map(([code,room]) => ({...room,code}))
    .filter(room => room.status === 'playing' && connectedRoomPlayers(room,presences,now).length > 0)
    .sort((a,b) => Number(b.updatedAt)-Number(a.updatedAt));
}
