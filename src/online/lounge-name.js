import { knownCharacterIdForProfile } from './profile-map.js';
import { displayName } from './display-name.js';
import { PLAYER_TERRITORIES, LOUNGE_CITIES } from '../config/lounge-cities.js';

export function createLoungeName(profile, random = Math.random) {
  const territory=PLAYER_TERRITORIES[knownCharacterIdForProfile(profile)]||'';
  const cities=LOUNGE_CITIES[territory]||['Salon privé'];
  const sample=Number(random());const index=Math.min(cities.length-1,Math.max(0,Math.floor((Number.isFinite(sample)?sample:0)*cities.length)));
  return {version:1,creatorId:profile?.id??profile?.playerId??null,creatorName:displayName(profile?.name||'Le club'),territory,city:cities[index]};
}
export function loungeIdentity(room, fallbackProfile = null) {
  if(room?.lounge?.city&&room.lounge.creatorName)return room.lounge;
  const players=Object.values(room?.players||{});
  // Old rooms retain their technical identity; a deterministic display fallback requires no migration.
  const creator=players.find(p=>p.token===room?.creatorToken)||(!room?.creatorToken?players.find(p=>p.isHost):null)||fallbackProfile;
  let hash=2166136261;for(const ch of `${room?.code||room?.roomCode||''}:${room?.createdAt||0}`)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
  return createLoungeName(creator,()=>hash/4294967296);
}
export function loungeTitle(room, fallbackProfile = null) {
  const info=loungeIdentity(room,fallbackProfile);return `${info.creatorName} — ${info.city}`;
}
