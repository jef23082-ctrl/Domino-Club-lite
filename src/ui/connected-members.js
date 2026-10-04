// Shared presentation only: retain one recent presence per player, preferring
// their actual room session over an idle lobby session.
export function connectedMembers(presences, now = Date.now()) {
  const members = new Map();
  for (const item of Object.values(presences || {})) {
    if (!item || now - Number(item.lastSeen || 0) >= 120000) continue;
    const key = String(item.playerId), previous = members.get(key);
    const priority = value => value?.roomCode ? 2 : 1;
    if (!previous || priority(item) > priority(previous) ||
        priority(item) === priority(previous) && Number(item.lastSeen) > Number(previous.lastSeen)) members.set(key, item);
  }
  return [...members.values()];
}
export const connectedMembersLabel = count => `${count} joueur${count === 1 ? '' : 's'} connecté${count === 1 ? '' : 's'}`;
