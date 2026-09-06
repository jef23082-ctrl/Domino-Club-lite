import { playerKey } from './engine.js';

export function victories(stat) {
  return Number(stat?.victories ?? stat?.gamesWon ?? 0);
}

export function statsFromHistory(historyRows, at = Date.now()) {
  const stats = { _processed: {} };
  [...historyRows]
    .sort((left, right) => Number(left.endedAt || 0) - Number(right.endedAt || 0))
    .forEach(match => {
      (match.players || []).forEach(player => {
        const key = playerKey(player.playerId);
        stats[key] = stats[key] || {
          playerId: player.playerId,
          name: player.name,
          avatar: player.avatar || '❓',
          gamesPlayed: 0,
          victories: 0,
          gamesWon: 0,
          gamesCancelled: 0,
          roundsWon: 0,
          cochons: 0,
          saved: 0
        };
        stats[key].name = player.name || stats[key].name;
        stats[key].avatar = player.avatar || stats[key].avatar;
        stats[key].gamesPlayed += 1;
        stats[key].roundsWon += Number(match.scores?.[key] || 0);
        stats[key].updatedAt = at;
      });
      if (match.resultType === 'victory') {
        const winner = stats[playerKey(match.winnerId)];
        if (winner) {
          winner.victories += (match.cochonIds || []).length >= 2 ? 2 : 1;
          winner.gamesWon = winner.victories;
        }
        (match.cochonIds || []).forEach(id => {
          const row = stats[playerKey(id)];
          if (row) row.cochons += 1;
        });
      } else {
        (match.players || []).forEach(player => {
          const row = stats[playerKey(player.playerId)];
          if (row) row.gamesCancelled += 1;
        });
        const saved = stats[playerKey(match.savedId)];
        if (saved) saved.saved += 1;
      }
      if (match.matchId) stats._processed[match.matchId] = { at: Number(match.endedAt || at) };
    });
  return stats;
}

export function rankingFromHistory(historyRows) {
  const rows = Object.entries(statsFromHistory(historyRows))
    .filter(([key]) => key !== '_processed')
    .map(([, value]) => value);
  return rows.sort((left, right) => {
    const leftRate = left.gamesPlayed ? victories(left) / left.gamesPlayed : -1;
    const rightRate = right.gamesPlayed ? victories(right) / right.gamesPlayed : -1;
    return (
      rightRate - leftRate ||
      (victories(right) - right.cochons) - (victories(left) - left.cochons) ||
      victories(right) - victories(left) ||
      left.cochons - right.cochons ||
      String(left.name || '').localeCompare(String(right.name || ''), 'fr')
    );
  });
}

export function historyRecordFromRoom(room, at = Date.now()) {
  const result = room.game?.matchResult;
  if (!room.matchId || !result) throw new Error('La partie ne possède pas de résultat enregistrable.');
  const players = Object.values(room.players || {}).sort(
    (left, right) => Number(left.joinedAt || 0) - Number(right.joinedAt || 0)
  );
  return {
    matchId: room.matchId,
    roomCode: room.code,
    startedAt: room.matchStartedAt || room.createdAt || at,
    endedAt: room.endedAt || at,
    players: players.map(player => ({
      playerId: player.playerId,
      name: player.name,
      avatar: player.avatar || '❓'
    })),
    resultType: result.type,
    winnerId: result.winnerId ?? null,
    savedId: result.savedId ?? null,
    cochonIds: result.cochonIds || [],
    scores: result.scores || {},
    rounds: room.roundLog || []
  };
}
