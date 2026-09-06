import { statsFromHistory } from '../game/online-stats.js';
import { playerKey } from '../game/engine.js';

export function validFirebaseKey(value) {
  return typeof value === 'string' && value.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(value) && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(value);
}

export function visibleHistory(root) {
  return Object.entries(root?.history || {})
    .filter(([key, row]) => row && typeof row === 'object' && !root?.deletedMatches?.[key])
    .map(([key, row]) => ({ ...row, matchId: key }))
    .sort((a, b) => Number(b.endedAt || 0) - Number(a.endedAt || 0));
}

export function rebuiltStats(root, at = Date.now()) {
  const stats = statsFromHistory(visibleHistory(root), at);
  // Legacy clients understand _processed. V3 also filters deletion markers.
  for (const [id, deleted] of Object.entries(root.deletedMatches || {})) {
    stats._processed[id] = { at: Number(deleted.at || at), deleted: true };
  }
  return stats;
}

// Same incremental scoring as V2, including stored-only legacy statistics.
export function addRecordToStats(stats, record, at = Date.now()) {
  stats ||= {};
  stats._processed ||= {};
  if (stats._processed[record.matchId]) return stats;
  for (const player of record.players) {
    const current = stats[playerKey(player.playerId)] || {};
    const victories = Number(current.victories ?? current.gamesWon ?? 0);
    stats[playerKey(player.playerId)] = {
      playerId: player.playerId, name: player.name, avatar: player.avatar || '❓',
      gamesPlayed: Number(current.gamesPlayed || 0) + 1, victories, gamesWon: victories,
      gamesCancelled: Number(current.gamesCancelled || 0),
      roundsWon: Number(current.roundsWon || 0) + Number(record.scores?.[playerKey(player.playerId)] || 0),
      cochons: Number(current.cochons || 0), saved: Number(current.saved || 0), updatedAt: at
    };
  }
  if (record.resultType === 'victory') {
    const winner = stats[playerKey(record.winnerId)];
    if (winner) {
      winner.victories += (record.cochonIds || []).length >= 2 ? 2 : 1;
      winner.gamesWon = winner.victories;
    }
    for (const id of record.cochonIds || []) if (stats[playerKey(id)]) stats[playerKey(id)].cochons++;
  } else {
    for (const player of record.players) stats[playerKey(player.playerId)].gamesCancelled++;
    if (stats[playerKey(record.savedId)]) stats[playerKey(record.savedId)].saved++;
  }
  stats._processed[record.matchId] = { at };
  return stats;
}
