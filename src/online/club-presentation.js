import { rankingFromHistory, victories } from '../game/online-stats.js';
import { playerKey } from '../game/engine.js';

export function currentStreak(history, playerId) {
  let count = 0;
  for (const match of [...history].sort((a, b) => Number(b.endedAt || 0) - Number(a.endedAt || 0))) {
    if (!(match.players || []).some(player => String(player.playerId) === String(playerId))) continue;
    if (match.resultType !== 'victory' || String(match.winnerId) !== String(playerId)) break;
    count++;
  }
  return count;
}

export function rankingRows(history, storedStats = {}) {
  const rows = history.length ? rankingFromHistory(history) : Object.entries(storedStats)
    .filter(([key, value]) => key !== '_processed' && value && typeof value === 'object')
    .map(([, value]) => value);
  return rows.map(row => {
    const played = Number(row.gamesPlayed || 0), won = victories(row), pigs = Number(row.cochons || 0);
    return { ...row, played, won, pigs, score: won - pigs, rate: played ? won / played : -1,
      percent: played ? Math.round(won / played * 100) : 0, streak: currentStreak(history, row.playerId), saved: Number(row.saved || 0) };
  }).sort((a, b) => b.rate - a.rate || b.score - a.score || b.won - a.won || a.pigs - b.pigs || String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
}

export function historyDescription(match) {
  const name = id => (match.players || []).find(player => String(player.playerId) === String(id))?.name || `Joueur ${id ?? '?'}`;
  return {
    title: match.resultType === 'victory' ? `${name(match.winnerId)} gagne la partie` : 'Partie annulée',
    detail: match.resultType === 'victory'
      ? `Cochon${(match.cochonIds || []).length > 1 ? 's' : ''} : ${(match.cochonIds || []).map(name).join(' et ') || 'aucun'}`
      : `${name(match.savedId)} est sauvé`,
    scores: (match.players || []).map(player => `${player.name} ${Number(match.scores?.[playerKey(player.playerId)] || 0)}`).join(' · ')
  };
}

export function formatMatchDate(value) {
  const date = new Date(Number(value));
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date inconnue';
}

export function formatMatchDuration(match) {
  const start=Number(match.startedAt),end=Number(match.endedAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<start)return 'Durée indisponible';
  const seconds=Math.floor((end-start)/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);
  return hours?`${hours} h ${String(minutes).padStart(2,'0')} min`:`${minutes} min ${String(seconds%60).padStart(2,'0')} s`;
}

export function roomDeletionTarget(room) {
  return { code: room.code, status: room.status, matchId: room.matchId || '', createdAt: Number(room.createdAt || 0) };
}
