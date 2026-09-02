// Physical games: schema and scoring preserved from the club's principal index.html.
export const list = value => (Array.isArray(value) ? value : Object.values(value || {})).filter(item => item !== null && item !== undefined);
const same = (a, b) => String(a) === String(b);
export function clubData(value = {}) {
  return { players: list(value?.players), currentTable: list(value?.currentTable), history: list(value?.history), matchStartTime: value?.matchStartTime || null };
}
export function recalculatePhysical(players, history, preserveEmpty = false) {
  const result = players.map(player => ({ ...player }));
  const fields = ['vic', 'coch', 'totalGames', 'saved', 'currentStreak'];
  for (const player of result) for (const field of fields) player[field] = preserveEmpty && !history.length ? Number(player[field] || 0) : 0;
  if (preserveEmpty && !history.length) return result;
  const find = id => result.find(player => same(player.id, id));
  for (const match of [...history].reverse()) {
    for (const id of list(match.table)) { const player = find(id); if (player) player.totalGames++; }
    if (match.equality) { const player = find(match.savedId); if (player) player.saved++; }
    else {
      const winner = find(match.winnerId);
      if (winner) winner.vic += list(match.cochonIds).length >= 2 ? 2 : 1;
      for (const id of list(match.cochonIds)) { const player = find(id); if (player) player.coch++; }
    }
  }
  for (const player of result) for (const match of history) {
    if (!list(match.table).some(id => same(id, player.id))) continue;
    if (match.equality || !same(match.winnerId, player.id)) break;
    player.currentStreak++;
  }
  return result;
}
export function physicalRanking(players) {
  return players.map(player => ({ ...player, percent: player.totalGames ? Math.round(player.vic / player.totalGames * 100) : 0,
    score: Number(player.vic || 0) - Number(player.coch || 0) }))
    .sort((a, b) => (b.totalGames ? b.percent : -1) - (a.totalGames ? a.percent : -1) || b.score - a.score);
}
const localDay = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function nightKey(date) { const day = new Date(date); if (day.getHours() < 12) day.setDate(day.getDate() - 1); return localDay(day); }
export function matchNight(match) {
  if (match.createdAt) return nightKey(new Date(match.createdAt));
  const hour = Number(String(match.date || '').split('–')[1]?.trim().split(':')[0] || 12);
  const date = new Date(`${match.dateIso}T${String(hour).padStart(2,'0')}:00:00`);
  return Number.isFinite(date.getTime()) ? nightKey(date) : '';
}
export function profileDetails(player, data) {
  const given = new Map(), received = new Map(); let streak = 0, record = 0;
  for (const match of [...data.history].reverse()) {
    if (list(match.table).some(id => same(id, player.id))) {
      streak = !match.equality && same(match.winnerId, player.id) ? streak + 1 : 0;
      record = Math.max(record, streak);
    }
    for (const detail of list(match.cochonDetails)) {
      if (same(detail.giver, player.id)) given.set(detail.receiver, (given.get(detail.receiver) || 0) + 1);
      if (same(detail.receiver, player.id)) received.set(detail.giver, (received.get(detail.giver) || 0) + 1);
    }
  }
  const favorite = map => { const item = [...map].sort((a,b)=>b[1]-a[1])[0]; return item ? `${data.players.find(p=>same(p.id,item[0]))?.name || 'Joueur supprimé'} (${item[1]})` : 'Aucun'; };
  return { favoriteVictim: favorite(given), favoriteGiver: favorite(received), record: Math.max(record, player.currentStreak || 0) };
}
export function startPhysicalGame(data, ids, at = Date.now()) {
  if (ids.length !== 3 || new Set(ids.map(String)).size !== 3 || ids.some(id => !data.players.some(p => same(p.id,id)))) throw new Error('Choisis exactement trois joueurs différents.');
  return { ...data, currentTable: ids, matchStartTime: at };
}
export function recordPhysicalRound(data, selection, at = Date.now()) {
  const { winnerId = null, savedId = null, cochonIds = [], incoming = [] } = selection;
  const equality = savedId !== null;
  const inTable = id => data.currentTable.some(item=>same(item,id));
  const playerName = id => data.players.find(p=>same(p.id,id))?.name || 'Joueur supprimé';
  if (!data.currentTable.length || !(equality ? inTable(savedId) : winnerId !== null && inTable(winnerId))) throw new Error('Sélectionne le gagnant ou le joueur sauvé.');
  if (equality && (winnerId !== null || cochonIds.length)) throw new Error('Une égalité ne donne aucun cochon.');
  if (cochonIds.length > 2 || new Set(cochonIds.map(String)).size !== cochonIds.length || cochonIds.some(id => !inTable(id) || same(id,winnerId))) throw new Error('Sélection des cochons invalide.');
  if (incoming.length > (equality ? 3 : 2) || new Set(incoming.map(String)).size !== incoming.length || incoming.some(id => !data.players.some(p=>same(p.id,id)))) throw new Error('Remplaçants invalides.');
  if (!equality && incoming.some(id => same(id,winnerId))) throw new Error('Le gagnant reste à la table : choisis deux autres joueurs.');
  const date = new Date(at), elapsed = data.matchStartTime ? Math.floor((at-data.matchStartTime)/60000) : null;
  const match = { date: date.toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) + ' – ' + date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
    dateIso: localDay(date), createdAt: at, duration: elapsed === null ? '' : `⏱️ ${elapsed > 0 ? elapsed : '< 1'} min`,
    table: [...data.currentTable], winnerId: equality ? null : winnerId, savedId: equality ? savedId : null, equality,
    winner: equality ? `Égalité (${playerName(savedId)} Sauvé)` : playerName(winnerId), cochonIds: [...cochonIds],
    cochon: cochonIds.map(playerName).join(' & ') || 'Aucun', cochonDetails: cochonIds.map(receiver=>({giver:winnerId,receiver})) };
  const history = [match, ...data.history];
  const currentTable = equality ? (incoming.length === 3 ? incoming : [savedId]) : [winnerId, ...(incoming.length === 2 ? incoming : [])];
  return { ...data, history, currentTable, matchStartTime: null, players: recalculatePhysical(data.players, history) };
}
