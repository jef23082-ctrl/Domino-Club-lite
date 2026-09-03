import { physicalRanking, list } from '../game/club-state.js';
import { rankingRows } from './club-presentation.js';

// A physical round and a completed online match are separate scored results.
// Never add online roundsWon to victories, nor persist this combined view.
export function clubRankings(players = [], physicalHistory = [], onlineHistory = [], stats = {}) {
  const profiles = new Map(players.map(p => [String(p.id), p]));
  const physical = physicalRanking(players);
  const online = rankingRows(onlineHistory, stats).map(row => ({
    ...row, ...profiles.get(String(row.playerId)), id: row.playerId,
    totalGames: row.played, vic: row.won, coch: row.pigs,
    currentStreak: row.streak, saved: row.saved, percent: row.percent, score: row.score
  }));
  const combined = new Map();
  for (const [source, rows] of [['physical', physical], ['online', online]]) {
    for (const row of rows) {
      if (row.id === undefined || row.id === null) continue;
      const id = String(row.id);
      const result = combined.get(id) || { ...row, vic: 0, coch: 0, saved: 0, totalGames: 0, physicalGames: 0, onlineGames: 0 };
      for (const key of ['vic', 'coch', 'saved', 'totalGames']) result[key] += Number(row[key] || 0);
      result[`${source}Games`] += Number(row.totalGames || 0);
      combined.set(id, result);
    }
  }
  // Do not sum two streaks. Merge dated outcomes across both modes instead.
  const events = [
    ...physicalHistory.map(m => ({ players: list(m.table), winner: m.equality ? null : m.winnerId, at: physicalTime(m) })),
    ...onlineHistory.map(m => ({ players: (m.players || []).map(p => p.playerId), winner: m.resultType === 'victory' ? m.winnerId : null, at: Number(m.endedAt || 0) }))
  ].sort((a, b) => b.at - a.at);
  for (const row of combined.values()) {
    const own = events.filter(e => e.players.some(id => String(id) === String(row.id)));
    const known = own.length === row.totalGames && own.every(e => Number.isFinite(e.at) && e.at > 0);
    row.currentStreak = known ? 0 : null;
    if (known) for (const e of own) {
      if (e.winner === null || String(e.winner) !== String(row.id)) break;
      row.currentStreak++;
    }
  }
  return { general: physicalRanking([...combined.values()]), online, physical };
}

function physicalTime(match) {
  if (Number(match.createdAt) > 0) return Number(match.createdAt);
  const time = String(match.date || '').match(/[–—]\s*(\d{1,2}):(\d{2})/);
  if (!match.dateIso || !time) return 0;
  return new Date(`${match.dateIso}T${time[1].padStart(2, '0')}:${time[2]}:00`).getTime();
}
