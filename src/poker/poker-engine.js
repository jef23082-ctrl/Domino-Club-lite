// Three-seat, no-limit Texas Hold'em sit-and-go. All mutations are pure so a
// Realtime Database transaction can replay them safely after contention.
export const POKER_STARTING_STACK = 20000;
export const POKER_BLIND_INTERVAL_MS = 5 * 60 * 1000;
export const POKER_PRESTIGE = Object.freeze([20, -5, -15]);
export const SUITS = Object.freeze(['S', 'H', 'D', 'C']);
export const RANKS = Object.freeze(['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']);

const copy = value => structuredClone(value);
// Realtime Database omits empty arrays/objects. Rehydrate the wire format at
// every transaction boundary, including rooms created by earlier versions.
export function normalizePokerRoom(value) {
  if (!value) return null;
  const room = copy(value);
  const list = item => Array.isArray(item) ? item : item && typeof item === 'object' ? Object.values(item) : [];
  room.players = list(room.players);
  room.eliminationOrder = list(room.eliminationOrder);
  if (room.game) {
    room.game.board = list(room.game.board);
    room.game.deck = list(room.game.deck);
    for (const field of ['bets', 'committed', 'folded', 'allIn', 'acted', 'holeCards', 'startingStacks']) room.game[field] ||= {};
    for (const id of Object.keys(room.game.holeCards)) room.game.holeCards[id] = list(room.game.holeCards[id]);
  }
  return room;
}
const key = value => String(value);
const byId = (room, id) => room.players.find(player => key(player.id) === key(id));
const positiveInteger = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0;
const liveSeats = room => room.players.map((player, index) => player.stack > 0 ? index : -1).filter(index => index >= 0);
const nextSeat = (room, from, predicate = player => player.stack > 0) => {
  for (let step = 1; step <= room.players.length; step++) {
    const index = (from + step) % room.players.length;
    if (predicate(room.players[index])) return index;
  }
  return -1;
};

export function freshDeck() { return SUITS.flatMap(suit => RANKS.map(rank => `${rank}${suit}`)); }
export function shuffleDeck(deck = freshDeck(), random = upper => {
  const limit = Math.floor(0x100000000 / upper) * upper;
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % upper;
}) {
  const result = [...deck];
  for (let index = result.length - 1; index > 0; index--) {
    const target = random(index + 1);
    if (!Number.isInteger(target) || target < 0 || target > index) throw new Error('Mélange de cartes invalide.');
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createPokerRoom({ code, profile, at = Date.now(), style = 'luxe' }) {
  if (profile?.id === undefined || profile?.id === null || !code) throw new Error('Profil et code nécessaires.');
  return {
    code: String(code).toUpperCase(), kind: 'poker', status: 'waiting', hostId: profile.id,
    style: style === 'classic' ? 'classic' : 'luxe', createdAt: at,
    players: [{ id: profile.id, name: profile.name, avatar: profile.avatar || '', stack: 0, joinedAt: at }],
    game: null
  };
}

export function joinPokerRoom(room, profile, at = Date.now()) {
  if (!room || room.status !== 'waiting') throw new Error('Cette table ne peut plus être rejointe.');
  if (profile?.id === undefined || profile?.id === null) throw new Error('Connecte-toi pour rejoindre la table.');
  if (room.players.some(player => key(player.id) === key(profile.id))) return room;
  if (room.players.length >= 3) throw new Error('La table est complète.');
  const next = copy(room);
  next.players.push({ id: profile.id, name: profile.name, avatar: profile.avatar || '', stack: 0, joinedAt: at });
  return next;
}

export function leavePokerRoom(room, playerId) {
  if (!room || room.status !== 'waiting') throw new Error('Impossible de quitter une partie commencée.');
  const next = copy(room);
  if (key(next.hostId) === key(playerId)) {
    next.status = 'cancelled';
  } else {
    next.players = next.players.filter(player => key(player.id) !== key(playerId));
  }
  return next;
}

export function choosePokerStyle(room, playerId, style) {
  if (!room || room.status !== 'waiting' || key(room.hostId) !== key(playerId)) throw new Error('Seul l’hôte choisit le style avant la partie.');
  if (!['classic', 'luxe'].includes(style)) throw new Error('Style de table inconnu.');
  return { ...room, style };
}

export function cancelPokerTournament(room, playerId, at = Date.now()) {
  if (!room || !['waiting', 'playing'].includes(room.status)) throw new Error('Cette partie ne peut plus être annulée.');
  if (key(room.hostId) !== key(playerId)) throw new Error('Seul l’hôte peut annuler cette partie.');
  const next = normalizePokerRoom(room);
  next.status = 'cancelled'; next.cancelledAt = at; next.cancelledBy = playerId;
  if (next.game) { next.game.status = 'cancelled'; next.game.turnId = null; }
  delete next.result;
  return next;
}

function blindAmounts(startedAt, now) {
  const level = Math.max(0, Math.min(8, Math.floor((now - startedAt) / POKER_BLIND_INTERVAL_MS)));
  const big = [200, 400, 600, 1000, 1600, 2400, 4000, 6000, 10000][level];
  return { level: level + 1, small: big / 2, big };
}

function takeCards(game, amount) {
  if (game.deck.length < amount) throw new Error('Paquet de cartes épuisé.');
  return game.deck.splice(0, amount);
}

function revealStreet(game) {
  takeCards(game, 1); // burn
  if (game.street === 'preflop') { game.board.push(...takeCards(game, 3)); game.street = 'flop'; }
  else if (game.street === 'flop') { game.board.push(...takeCards(game, 1)); game.street = 'turn'; }
  else if (game.street === 'turn') { game.board.push(...takeCards(game, 1)); game.street = 'river'; }
}

function postBlind(room, index, amount) {
  const player = room.players[index], game = room.game;
  const paid = Math.min(player.stack, amount);
  player.stack -= paid;
  game.bets[key(player.id)] += paid;
  game.committed[key(player.id)] += paid;
  game.pot += paid;
  if (!player.stack) game.allIn[key(player.id)] = true;
}

function beginHand(room, now, shuffledDeck = shuffleDeck()) {
  const next = normalizePokerRoom(room);
  const participants = liveSeats(next);
  if (participants.length < 2) throw new Error('Il faut au moins deux joueurs avec des jetons.');
  const formerDealer = next.game?.dealerIndex ?? -1;
  const dealerIndex = nextSeat(next, formerDealer);
  const smallIndex = participants.length === 2 ? dealerIndex : nextSeat(next, dealerIndex);
  const bigIndex = nextSeat(next, smallIndex);
  const blinds = blindAmounts(next.startedAt, now);
  next.game = {
    handNumber: (next.game?.handNumber || 0) + 1, dealerIndex,
    blinds, deck: [...shuffledDeck], board: [], street: 'preflop',
    pot: 0, bets: {}, committed: {}, folded: {}, allIn: {}, acted: {},
    currentBet: 0, minRaise: blinds.big, turnId: null, holeCards: {},
    startingStacks: Object.fromEntries(next.players.map(player => [key(player.id), player.stack])),
    lastResult: null, status: 'betting'
  };
  for (const player of next.players) {
    const id = key(player.id);
    next.game.bets[id] = 0; next.game.committed[id] = 0;
    next.game.folded[id] = player.stack <= 0;
    next.game.allIn[id] = false; next.game.acted[id] = false;
    if (player.stack > 0) next.game.holeCards[id] = [];
  }
  for (let round = 0; round < 2; round++) {
    let index = dealerIndex;
    for (let count = 0; count < participants.length; count++) {
      index = nextSeat(next, index);
      next.game.holeCards[key(next.players[index].id)].push(...takeCards(next.game, 1));
    }
  }
  postBlind(next, smallIndex, blinds.small);
  postBlind(next, bigIndex, blinds.big);
  next.game.currentBet = Math.max(...Object.values(next.game.bets));
  const first = nextSeat(next, bigIndex, player => player.stack > 0 && !next.game.folded[key(player.id)]);
  next.game.turnId = first < 0 ? null : next.players[first].id;
  if (first < 0) runoutAndSettle(next, now);
  return next;
}

export function startPokerTournament(room, playerId, now = Date.now(), shuffledDeck = shuffleDeck()) {
  if (!room || room.status !== 'waiting') throw new Error('Le tournoi ne peut pas démarrer.');
  if (key(room.hostId) !== key(playerId)) throw new Error('Seul l’hôte peut lancer le tournoi.');
  if (room.players.length !== 3) throw new Error('Il faut trois joueurs pour démarrer.');
  const next = copy(room);
  next.status = 'playing'; next.startedAt = now; next.eliminationOrder = [];
  for (const player of next.players) player.stack = POKER_STARTING_STACK;
  return beginHand(next, now, shuffledDeck);
}

const rankValue = card => RANKS.indexOf(card[0]) + 2;
function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let index = 0; index <= unique.length - 5; index++) {
    if (unique[index] - unique[index + 4] === 4) return unique[index];
  }
  return 0;
}
function evaluateFive(cards) {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const counts = new Map(values.map(value => [value, values.filter(item => item === value).length]));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(card => card[1] === cards[0][1]);
  const straight = straightHigh(values);
  if (flush && straight) return [8, straight];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...values];
  if (straight) return [4, straight];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map(group => group[0]).sort((a, b) => b - a)];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, Math.max(groups[0][0], groups[1][0]), Math.min(groups[0][0], groups[1][0]), groups[2][0]];
  if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map(group => group[0]).sort((a, b) => b - a)];
  return [0, ...values];
}
export function compareHands(a, b) {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}
export function evaluatePokerHand(cards) {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) throw new Error('Il faut cinq à sept cartes.');
  let best = null;
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++)
    for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++)
      for (let e = d + 1; e < cards.length; e++) {
        const result = evaluateFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
        if (!best || compareHands(result, best) > 0) best = result;
      }
  return best;
}

const HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];
function awardUncontested(room, winnerId, now) {
  const game = room.game, winner = byId(room, winnerId);
  winner.stack += game.pot;
  game.lastResult = { type: 'fold', winners: [winnerId], handName: 'Tous les adversaires se sont couchés', board: [...game.board], awards: { [key(winnerId)]: game.pot }, at: now };
  finishHand(room, now);
}
function settleShowdown(room, now) {
  const game = room.game;
  const ranks = Object.fromEntries(room.players.filter(player => !game.folded[key(player.id)]).map(player => [key(player.id), evaluatePokerHand([...game.holeCards[key(player.id)], ...game.board])]));
  const thresholds = [...new Set(Object.values(game.committed).filter(Boolean))].sort((a, b) => a - b);
  const awards = Object.fromEntries(room.players.map(player => [key(player.id), 0]));
  let previous = 0;
  for (const threshold of thresholds) {
    const contributors = room.players.filter(player => game.committed[key(player.id)] >= threshold);
    const contenders = contributors.filter(player => !game.folded[key(player.id)]);
    const amount = (threshold - previous) * contributors.length;
    previous = threshold;
    if (!contenders.length) throw new Error('Pot sans joueur admissible.');
    const winningRank = contenders.map(player => ranks[key(player.id)]).sort((a, b) => compareHands(b, a))[0];
    const winners = contenders.filter(player => compareHands(ranks[key(player.id)], winningRank) === 0);
    const share = Math.floor(amount / winners.length);
    winners.forEach(player => { awards[key(player.id)] += share; });
    for (let index = 0; index < amount - share * winners.length; index++) awards[key(winners[index].id)]++;
  }
  room.players.forEach(player => { player.stack += awards[key(player.id)]; });
  const maxAward = Math.max(...Object.values(awards));
  const winners = room.players.filter(player => awards[key(player.id)] === maxAward && maxAward > 0).map(player => player.id);
  const winningRank = winners.length ? ranks[key(winners[0])] : null;
  game.lastResult = { type: 'showdown', winners, handName: HAND_NAMES[winningRank?.[0] ?? 0], board: [...game.board], awards, at: now };
  finishHand(room, now);
}
function finishHand(room, now) {
  const game = room.game;
  game.status = 'showdown'; game.turnId = null; game.street = 'showdown';
  const busted = room.players.filter(player => player.stack <= 0 && !room.eliminationOrder.some(id => key(id) === key(player.id)))
    .sort((a, b) => game.startingStacks[key(a.id)] - game.startingStacks[key(b.id)] || key(a.id).localeCompare(key(b.id)));
  room.eliminationOrder.push(...busted.map(player => player.id));
  if (liveSeats(room).length !== 1) return;
  const champion = room.players.find(player => player.stack > 0);
  const placements = [champion.id, ...[...room.eliminationOrder].reverse()].slice(0, 3);
  room.status = 'finished'; room.finishedAt = now;
  room.result = { placements, points: Object.fromEntries(placements.map((id, index) => [key(id), POKER_PRESTIGE[index]])), winnerId: champion.id, hands: game.handNumber, endedAt: now };
}
function runoutAndSettle(room, now) {
  const game = room.game;
  while (game.board.length < 5) revealStreet(game);
  settleShowdown(room, now);
}
function completeBettingRound(room, now) {
  const game = room.game;
  if (game.street === 'river') { settleShowdown(room, now); return; }
  revealStreet(game);
  game.currentBet = 0; game.minRaise = game.blinds.big;
  for (const player of room.players) { game.bets[key(player.id)] = 0; game.acted[key(player.id)] = false; }
  const actionable = room.players.filter(player => !game.folded[key(player.id)] && player.stack > 0);
  if (actionable.length < 2) { runoutAndSettle(room, now); return; }
  const first = nextSeat(room, game.dealerIndex, player => !game.folded[key(player.id)] && player.stack > 0);
  game.turnId = first >= 0 ? room.players[first].id : null;
}

export function pokerAction(room, { playerId, type, amount, at = Date.now() }) {
  if (!room || room.status !== 'playing' || room.game?.status !== 'betting') throw new Error('Aucune action de poker en cours.');
  const next = normalizePokerRoom(room), game = next.game, id = key(playerId), player = byId(next, playerId);
  if (!player || key(game.turnId) !== id || game.folded[id] || game.allIn[id]) throw new Error('Ce n’est pas ton tour.');
  const owed = Math.max(0, game.currentBet - game.bets[id]);
  if (type === 'fold') game.folded[id] = true;
  else if (type === 'check') { if (owed) throw new Error('Il faut suivre ou se coucher.'); }
  else if (type === 'call') {
    const paid = Math.min(player.stack, owed);
    player.stack -= paid; game.bets[id] += paid; game.committed[id] += paid; game.pot += paid;
    if (!player.stack) game.allIn[id] = true;
  } else if (type === 'raise') {
    if (game.acted[id]) throw new Error('Une relance à tapis trop courte ne rouvre pas les mises.');
    if (!positiveInteger(amount)) throw new Error('Mise invalide.');
    const target = Number(amount), maximum = game.bets[id] + player.stack;
    if (target <= game.currentBet || target > maximum) throw new Error('Relance hors limites.');
    if (target - game.currentBet < game.minRaise && target !== maximum) throw new Error(`Relance minimale : ${game.currentBet + game.minRaise} jetons.`);
    const paid = target - game.bets[id];
    player.stack -= paid; game.bets[id] += paid; game.committed[id] += paid; game.pot += paid;
    const raiseSize = target - game.currentBet;
    if (raiseSize >= game.minRaise) {
      game.minRaise = raiseSize;
      for (const other of next.players) if (key(other.id) !== id && !game.folded[key(other.id)] && !game.allIn[key(other.id)]) game.acted[key(other.id)] = false;
    }
    game.currentBet = target;
    if (!player.stack) game.allIn[id] = true;
  } else throw new Error('Action inconnue.');
  game.acted[id] = true;
  const remaining = next.players.filter(other => !game.folded[key(other.id)] && game.holeCards[key(other.id)]);
  if (remaining.length === 1) { awardUncontested(next, remaining[0].id, at); return next; }
  const canAct = next.players.filter(other => !game.folded[key(other.id)] && !game.allIn[key(other.id)] && other.stack > 0);
  if (!canAct.length) { runoutAndSettle(next, at); return next; }
  if (canAct.every(other => game.acted[key(other.id)] && game.bets[key(other.id)] === game.currentBet)) {
    completeBettingRound(next, at); return next;
  }
  const index = next.players.findIndex(other => key(other.id) === id);
  const following = nextSeat(next, index, other => !game.folded[key(other.id)] && !game.allIn[key(other.id)] && other.stack > 0);
  game.turnId = next.players[following].id;
  return next;
}

export function nextPokerHand(room, playerId, at = Date.now(), shuffledDeck = shuffleDeck()) {
  if (!room || room.status !== 'playing' || room.game?.status !== 'showdown') throw new Error('La main en cours n’est pas terminée.');
  if (key(room.hostId) !== key(playerId)) throw new Error('Seul l’hôte lance la main suivante.');
  return beginHand(room, at, shuffledDeck);
}

export function pokerHistoryRecord(room) {
  if (room?.status !== 'finished' || !room.result) throw new Error('Tournoi non terminé.');
  return {
    code: room.code, startedAt: room.startedAt, endedAt: room.finishedAt,
    hands: room.result.hands, style: room.style,
    placements: room.result.placements,
    points: room.result.points,
    players: room.players.map(player => ({ id: player.id, name: player.name, avatar: player.avatar || '' }))
  };
}

export function pokerRanking(history = [], profiles = []) {
  const rows = new Map(profiles.map(profile => [key(profile.id), { id: profile.id, name: profile.name, avatar: profile.avatar || '', played: 0, wins: 0, podiums: 0, points: 1000 }]));
  for (const match of history) for (const [index, id] of (match.placements || []).entries()) {
    const profile = (match.players || []).find(player => key(player.id) === key(id));
    const row = rows.get(key(id)) || { id, name: profile?.name || 'Joueur', avatar: profile?.avatar || '', played: 0, wins: 0, podiums: 0, points: 1000 };
    row.played++; if (!index) row.wins++; if (index < 2) row.podiums++;
    row.points += Number(match.points?.[key(id)] ?? POKER_PRESTIGE[index] ?? 0);
    rows.set(key(id), row);
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.played - a.played || String(a.name).localeCompare(String(b.name), 'fr'));
}
