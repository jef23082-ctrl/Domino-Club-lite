// Three-seat, no-limit Texas Hold'em sit-and-go. All mutations are pure so a
// Realtime Database transaction can replay them safely after contention.
import { createLoungeName } from '../online/lounge-name.js?v=20260927T021825018';

export const POKER_STARTING_STACK = 20000;
export const POKER_STACK_CHOICES = Object.freeze([5000, 10000, 20000, 50000, 100000]);
export const POKER_LEVEL_MINUTES = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
export const POKER_BLIND_INTERVAL_MS = 5 * 60 * 1000;
export const POKER_RUNOUT_DELAY_MS = 2000;
export const POKER_REVEAL_CHOICE_MS = 5000;
export const POKER_PRESTIGE = Object.freeze([20, -5, -15]);
export const POKER_BLIND_LEVELS = Object.freeze([200, 400, 600, 1000, 1600, 2400, 4000, 6000, 10000]);
export const POKER_PHASES = Object.freeze({
  WAITING: 'waiting', PREFLOP: 'betting-preflop', FLOP: 'betting-flop', TURN: 'betting-turn',
  RIVER: 'betting-river', RUNOUT: 'all-in-runout', SHOWDOWN: 'showdown', FINISHED: 'tournament-finished', CANCELLED: 'cancelled'
});
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
  room.settings = pokerSettings(room.settings);
  room.completedHands ||= {};
  if (room.game) {
    room.game.board = list(room.game.board);
    room.game.deck = list(room.game.deck);
    for (const field of ['bets', 'committed', 'folded', 'allIn', 'acted', 'actedAtBet', 'holeCards', 'startingStacks']) room.game[field] ||= {};
    for (const id of Object.keys(room.game.holeCards)) room.game.holeCards[id] = list(room.game.holeCards[id]);
    room.game.eventSeq = Number(room.game.eventSeq || 0);
    room.game.revision = Number(room.game.revision || 0);
    room.game.commandIds = list(room.game.commandIds);
    room.game.events = list(room.game.events);
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
    style: style === 'classic' ? 'classic' : 'luxe', createdAt: at, lounge: createLoungeName(profile),
    settings: pokerSettings(), completedHands: {},
    players: [{ id: profile.id, name: profile.name, avatar: profile.avatar || '', stack: 0, joinedAt: at }],
    phase: POKER_PHASES.WAITING, game: null
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

export function pokerSettings(settings = {}) {
  return {
    startingStack: POKER_STACK_CHOICES.includes(Number(settings?.startingStack)) ? Number(settings.startingStack) : POKER_STARTING_STACK,
    blindMinutes: POKER_LEVEL_MINUTES.includes(Number(settings?.blindMinutes)) ? Number(settings.blindMinutes) : 5
  };
}

export function choosePokerSettings(room, playerId, settings) {
  if (!room || room.status !== 'waiting' || key(room.hostId) !== key(playerId)) throw new Error('Seul l’hôte règle la table avant le lancement.');
  if (!POKER_STACK_CHOICES.includes(Number(settings?.startingStack)) || !POKER_LEVEL_MINUTES.includes(Number(settings?.blindMinutes))) throw new Error('Réglages Poker invalides.');
  if (settings.style !== undefined && !['classic', 'luxe'].includes(settings.style)) throw new Error('Style de table inconnu.');
  return { ...room, settings: pokerSettings(settings), style: settings.style ?? room.style };
}

// Circular array order is also the visual clockwise order. Never reorder a
// running room: dealer/blind indices and pending actions depend on this array.
export function pokerSeatMap(room, leaderId) {
  const players = room?.players || [];
  if (!players.length) return { top: null, right: null, left: null };
  const leaderIndex = players.findIndex(player => key(player.id) === key(leaderId));
  const topIndex = leaderIndex < 0 ? 0 : leaderIndex;
  return { top: players[topIndex], right: players.length > 1 ? players[(topIndex + 1) % players.length] : null, left: players.length > 2 ? players[(topIndex + 2) % players.length] : null };
}

export function cancelPokerTournament(room, playerId, at = Date.now()) {
  if (!room || !['waiting', 'playing'].includes(room.status)) throw new Error('Cette partie ne peut plus être annulée.');
  if (key(room.hostId) !== key(playerId)) throw new Error('Seul l’hôte peut annuler cette partie.');
  const next = normalizePokerRoom(room);
  next.status = 'cancelled'; next.cancelledAt = at; next.cancelledBy = playerId;
  next.phase = POKER_PHASES.CANCELLED;
  if (next.game) { next.game.status = 'cancelled'; next.game.phase = POKER_PHASES.CANCELLED; next.game.turnId = null; }
  delete next.result;
  return next;
}

function blindAmounts(room, now) {
  const interval = pokerSettings(room.settings).blindMinutes * 60000;
  const level = Math.max(0, Math.min(POKER_BLIND_LEVELS.length - 1, Math.floor((now - room.startedAt) / interval)));
  const big = POKER_BLIND_LEVELS[level];
  return { level: level + 1, small: big / 2, big };
}

export function pokerBlindStatus(room, at = Date.now()) {
  const startedAt = Number(room?.startedAt || at);
  const elapsed = Math.max(0, Number(at) - startedAt);
  const interval = pokerSettings(room?.settings).blindMinutes * 60000;
  const scheduledIndex = Math.max(0, Math.min(POKER_BLIND_LEVELS.length - 1, Math.floor(elapsed / interval)));
  const handIndex = Math.max(0, Math.min(scheduledIndex, Number(room?.game?.blinds?.level || scheduledIndex + 1) - 1));
  const currentBig = POKER_BLIND_LEVELS[handIndex];
  const nextIndex = Math.min(POKER_BLIND_LEVELS.length - 1, Math.max(handIndex + 1, scheduledIndex));
  const nextBig = handIndex < POKER_BLIND_LEVELS.length - 1 ? POKER_BLIND_LEVELS[nextIndex] : null;
  const scheduledNextAt = startedAt + (handIndex + 1) * interval;
  const pendingNextHand = Boolean(nextBig && scheduledIndex > handIndex);
  const nextAt = nextBig ? scheduledNextAt : null;
  return {
    level: handIndex + 1,
    current: { small: currentBig / 2, big: currentBig },
    next: nextBig ? { small: nextBig / 2, big: nextBig } : null,
    nextAt,
    pendingNextHand,
    remainingMs: nextAt ? Math.max(0, nextAt - Number(at)) : 0
  };
}

function recordEvent(game, type, at, details = {}) {
  game.eventSeq = Number(game.eventSeq || 0) + 1;
  game.revision = Number(game.revision || 0) + 1;
  game.lastEvent = { seq: game.eventSeq, type, at, handId: game.handId, ...details };
  game.events ||= [];
  game.events.push(game.lastEvent);
  game.events = game.events.slice(-18);
}

function rememberCommand(game, commandId) {
  if (!commandId) return false;
  game.commandIds ||= [];
  if (game.commandIds.includes(commandId)) return true;
  game.commandIds.push(commandId);
  game.commandIds = game.commandIds.slice(-24);
  return false;
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
  const blinds = blindAmounts(next, now);
  const handNumber = (next.game?.handNumber || 0) + 1;
  next.game = {
    handNumber, handId: `${next.code || 'poker'}-${handNumber}`, startedAt: now, dealerIndex, smallIndex, bigIndex,
    initiatedAllIns: {},
    blinds, deck: [...shuffledDeck], board: [], street: 'preflop',
    pot: 0, bets: {}, committed: {}, folded: {}, allIn: {}, acted: {}, actedAtBet: {},
    currentBet: 0, minRaise: blinds.big, turnId: null, holeCards: {},
    startingStacks: Object.fromEntries(next.players.map(player => [key(player.id), player.stack])),
    lastResult: null, status: 'betting', phase: POKER_PHASES.PREFLOP, eventSeq: Number(next.game?.eventSeq || 0),
    revision: Number(next.game?.revision || 0), commandIds: [], events: []
  };
  for (const player of next.players) {
    const id = key(player.id);
    next.game.bets[id] = 0; next.game.committed[id] = 0;
    next.game.folded[id] = player.stack <= 0;
    next.game.allIn[id] = false; next.game.acted[id] = false; next.game.actedAtBet[id] = 0;
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
  // A short big blind does not reduce the amount the other players must call.
  next.game.currentBet = blinds.big;
  const first = nextSeat(next, bigIndex, player => player.stack > 0 && !next.game.folded[key(player.id)]);
  next.game.turnId = first < 0 ? null : next.players[first].id;
  next.phase = POKER_PHASES.PREFLOP;
  recordEvent(next.game, 'deal', now, { playerId: next.game.turnId, smallBlindId: next.players[smallIndex].id, bigBlindId: next.players[bigIndex].id });
  const funded = next.players.filter(player => !next.game.folded[key(player.id)] && player.stack > 0);
  if (first < 0 || (funded.length === 1 && next.game.bets[key(funded[0].id)] >= next.game.currentBet)) beginRunout(next, now);
  return next;
}

export function startPokerTournament(room, playerId, now = Date.now(), shuffledDeck = shuffleDeck()) {
  if (!room || room.status !== 'waiting') throw new Error('Le tournoi ne peut pas démarrer.');
  if (!room.players.some(player => key(player.id) === key(playerId))) throw new Error('Seul un joueur assis peut lancer le tournoi.');
  if (room.players.length !== 3) throw new Error('Il faut trois joueurs pour démarrer.');
  const next = copy(room);
  next.status = 'playing'; next.startedAt = now; next.eliminationOrder = [];
  for (const player of next.players) player.stack = pokerSettings(next.settings).startingStack;
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
const VALUE_NAMES = Object.freeze({ 14: 'As', 13: 'Roi', 12: 'Dame', 11: 'Valet', 10: '10', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' });
const PLURAL_VALUES = Object.freeze({ 14: 'As', 13: 'Rois', 12: 'Dames', 11: 'Valets' });

export function evaluatePokerHandDetailed(cards) {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) throw new Error('Il faut cinq à sept cartes.');
  let best = null;
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++)
    for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++)
      for (let e = d + 1; e < cards.length; e++) {
        const bestFive = [cards[a], cards[b], cards[c], cards[d], cards[e]];
        const rank = evaluateFive(bestFive);
        if (!best || compareHands(rank, best.rank) > 0) best = { rank, bestFive };
      }
  return { ...best, category: best.rank[0], label: describePokerHand(best.rank) };
}

export function describePokerHand(rank) {
  const category = Number(rank?.[0] || 0), high = VALUE_NAMES[rank?.[1]] || String(rank?.[1] || '');
  if (category === 8) return rank[1] === 14 ? 'Quinte flush royale' : `Quinte flush au ${high}`;
  if (category === 7) return `Carré de ${PLURAL_VALUES[rank[1]] || rank[1]}`;
  if (category === 6) return `Full aux ${PLURAL_VALUES[rank[1]] || rank[1]} par les ${PLURAL_VALUES[rank[2]] || rank[2]}`;
  if (category === 5) return `Couleur, ${high} hauteur`;
  if (category === 4) return `Quinte au ${high}`;
  if (category === 3) return `Brelan de ${PLURAL_VALUES[rank[1]] || rank[1]}`;
  if (category === 2) return `Double paire, ${PLURAL_VALUES[rank[1]] || rank[1]} et ${PLURAL_VALUES[rank[2]] || rank[2]}`;
  if (category === 1) return `Paire de ${PLURAL_VALUES[rank[1]] || rank[1]}`;
  return `${HAND_NAMES[0]}, ${high} hauteur`;
}

function clockwiseFromDealer(room, players) {
  const allowed = new Set(players.map(player => key(player.id)));
  const ordered = [];
  for (let step = 1; step <= room.players.length; step++) {
    const player = room.players[(room.game.dealerIndex + step) % room.players.length];
    if (allowed.has(key(player.id))) ordered.push(player);
  }
  return ordered;
}
function awardUncontested(room, winnerId, now) {
  const game = room.game, winner = byId(room, winnerId);
  winner.stack += game.pot;
  game.lastResult = {
    type: 'fold', winners: [winnerId], handName: 'Tous les adversaires se sont couchés',
    board: [...game.board], awards: { [key(winnerId)]: game.pot }, pots: [{ type: 'main', amount: game.pot, winners: [winnerId] }],
    revealChoiceUntil: now + POKER_REVEAL_CHOICE_MS, shownCards: false, at: now
  };
  recordEvent(game, 'win-fold', now, { playerId: winnerId, amount: game.pot });
  finishHand(room, now);
}
function settleShowdown(room, now) {
  const game = room.game;
  const details = Object.fromEntries(room.players.filter(player => !game.folded[key(player.id)]).map(player => {
    const id = key(player.id), detail = evaluatePokerHandDetailed([...(game.holeCards[id] || []), ...game.board]);
    return [id, { rank: detail.rank, bestFive: detail.bestFive, label: detail.label, cards: [...(game.holeCards[id] || [])] }];
  }));
  const thresholds = [...new Set(Object.values(game.committed).filter(Boolean))].sort((a, b) => a - b);
  const awards = Object.fromEntries(room.players.map(player => [key(player.id), 0]));
  const pots = [];
  let previous = 0, potIndex = 0;
  for (const threshold of thresholds) {
    const contributors = room.players.filter(player => game.committed[key(player.id)] >= threshold);
    const contenders = contributors.filter(player => !game.folded[key(player.id)]);
    const amount = (threshold - previous) * contributors.length;
    previous = threshold;
    if (contributors.length === 1) {
      awards[key(contributors[0].id)] += amount;
      continue;
    }
    if (!contenders.length) throw new Error('Pot sans joueur admissible.');
    const winningRank = contenders.map(player => details[key(player.id)].rank).sort((a, b) => compareHands(b, a))[0];
    const winners = contenders.filter(player => compareHands(details[key(player.id)].rank, winningRank) === 0);
    const share = Math.floor(amount / winners.length);
    winners.forEach(player => { awards[key(player.id)] += share; });
    const oddChipOrder = clockwiseFromDealer(room, winners);
    for (let index = 0; index < amount - share * winners.length; index++) awards[key(oddChipOrder[index].id)]++;
    pots.push({
      index: potIndex, type: potIndex ? 'side' : 'main', amount,
      eligible: contenders.map(player => player.id), winners: winners.map(player => player.id),
      awards: Object.fromEntries(winners.map(player => [key(player.id), share + (oddChipOrder.findIndex(item => key(item.id) === key(player.id)) < amount - share * winners.length ? 1 : 0)])),
      handLabel: details[key(winners[0].id)].label
    });
    potIndex++;
  }
  room.players.forEach(player => { player.stack += awards[key(player.id)]; });
  const winners = [...new Set(pots.flatMap(item => item.winners))];
  const primaryWinner = pots[0]?.winners?.[0];
  game.lastResult = {
    type: 'showdown', winners, handName: primaryWinner !== undefined && primaryWinner !== null ? details[key(primaryWinner)].label : HAND_NAMES[0],
    board: [...game.board], awards, pots, hands: details, at: now
  };
  recordEvent(game, 'showdown', now, { playerId: primaryWinner, winners, amount: game.pot });
  finishHand(room, now);
}
function finishHand(room, now) {
  const game = room.game;
  game.status = 'showdown'; game.phase = POKER_PHASES.SHOWDOWN; room.phase = POKER_PHASES.SHOWDOWN; game.turnId = null; game.street = 'showdown';
  delete game.runout;
  game.completedAt = now;
  saveCompletedHand(room);
  const busted = room.players.filter(player => player.stack <= 0 && !room.eliminationOrder.some(id => key(id) === key(player.id)))
    .sort((a, b) => game.startingStacks[key(a.id)] - game.startingStacks[key(b.id)] || key(a.id).localeCompare(key(b.id)));
  room.eliminationOrder.push(...busted.map(player => player.id));
  if (liveSeats(room).length !== 1) return;
  const champion = room.players.find(player => player.stack > 0);
  const placements = [champion.id, ...[...room.eliminationOrder].reverse()].slice(0, 3);
  room.status = 'finished'; room.finishedAt = now;
  room.phase = POKER_PHASES.FINISHED; game.phase = POKER_PHASES.FINISHED;
  room.result = { placements, points: Object.fromEntries(placements.map((id, index) => [key(id), POKER_PRESTIGE[index]])), winnerId: champion.id, hands: game.handNumber, endedAt: now };
}
function beginRunout(room, now) {
  const game = room.game;
  game.status = 'runout'; game.phase = POKER_PHASES.RUNOUT; room.phase = POKER_PHASES.RUNOUT; game.turnId = null;
  for (const player of room.players) game.acted[key(player.id)] = true;
  recordEvent(game, 'all-in-reveal', now, { players: room.players.filter(player => !game.folded[key(player.id)]).map(player => player.id) });
  if (game.board.length < 5) {
    revealStreet(game);
    recordEvent(game, game.street === 'flop' ? 'flop' : game.street === 'turn' ? 'turn-card' : 'river', now);
    game.runout = { nextTransitionAt: now + POKER_RUNOUT_DELAY_MS, stage: game.board.length < 5 ? 'street' : 'settle' };
  } else {
    settleShowdown(room, now);
  }
}
function completeBettingRound(room, now) {
  const game = room.game;
  if (game.street === 'river') { settleShowdown(room, now); return; }
  revealStreet(game);
  recordEvent(game, game.street === 'flop' ? 'flop' : game.street === 'turn' ? 'turn-card' : 'river', now);
  game.currentBet = 0; game.minRaise = game.blinds.big;
  for (const player of room.players) { game.bets[key(player.id)] = 0; game.acted[key(player.id)] = false; game.actedAtBet[key(player.id)] = 0; }
  const actionable = room.players.filter(player => !game.folded[key(player.id)] && player.stack > 0);
  if (actionable.length < 2) { beginRunout(room, now); return; }
  const first = nextSeat(room, game.dealerIndex, player => !game.folded[key(player.id)] && player.stack > 0);
  game.turnId = first >= 0 ? room.players[first].id : null;
  game.phase = `betting-${game.street}`; room.phase = game.phase;
  recordEvent(game, 'turn-player', now, { playerId: game.turnId });
}

export function advancePokerTimeline(room, { playerId, at = Date.now(), expectedHandId, commandId } = {}) {
  if (!room || room.status !== 'playing' || room.game?.status !== 'runout') throw new Error('Aucune distribution automatique en cours.');
  const next = normalizePokerRoom(room), game = next.game;
  if (playerId !== undefined && !next.players.some(player => key(player.id) === key(playerId))) throw new Error('Seul un joueur assis peut faire avancer la table.');
  if (expectedHandId && key(expectedHandId) !== key(game.handId)) throw new Error('La main a déjà changé.');
  if (rememberCommand(game, commandId)) return next;
  if (Number(game.runout?.nextTransitionAt || 0) > at) throw new Error('La prochaine carte n’est pas encore prête.');
  if (game.runout?.stage === 'settle' || game.board.length >= 5) {
    settleShowdown(next, at);
    return next;
  }
  revealStreet(game);
  recordEvent(game, game.street === 'turn' ? 'turn-card' : game.street === 'river' ? 'river' : 'flop', at);
  game.runout = { nextTransitionAt: at + POKER_RUNOUT_DELAY_MS, stage: game.board.length < 5 ? 'street' : 'settle' };
  return next;
}

export function pokerAction(room, { playerId, type, amount, at = Date.now(), expectedHandId, expectedRevision, commandId }) {
  if (!room || room.status !== 'playing' || room.game?.status !== 'betting') throw new Error('Aucune action de poker en cours.');
  const next = normalizePokerRoom(room), game = next.game, id = key(playerId), player = byId(next, playerId);
  if (expectedHandId && key(expectedHandId) !== key(game.handId)) throw new Error('La main a déjà changé.');
  if (rememberCommand(game, commandId)) return next;
  if (Number.isFinite(expectedRevision) && Number(game.revision) !== Number(expectedRevision)) throw new Error('La table a déjà évolué.');
  if (!player || key(game.turnId) !== id || game.folded[id] || game.allIn[id]) throw new Error('Ce n’est pas ton tour.');
  const owed = Math.max(0, game.currentBet - game.bets[id]);
  let eventType = type;
  if (type === 'fold') game.folded[id] = true;
  else if (type === 'check') { if (owed) throw new Error('Il faut suivre ou se coucher.'); }
  else if (type === 'call') {
    const paid = Math.min(player.stack, owed);
    player.stack -= paid; game.bets[id] += paid; game.committed[id] += paid; game.pot += paid;
    if (!player.stack) game.allIn[id] = true;
  } else if (type === 'raise') {
    if (next.players.filter(other => !game.folded[key(other.id)] && !game.allIn[key(other.id)] && other.stack > 0).length < 2) throw new Error('Aucun adversaire ne peut suivre une relance.');
    const facedSinceAction = Math.max(0, Number(game.currentBet || 0) - Number(game.actedAtBet?.[id] || 0));
    if (game.acted[id] && facedSinceAction < game.minRaise) throw new Error('Une relance à tapis trop courte ne rouvre pas les mises.');
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
    if (!player.stack) { game.allIn[id] = true; eventType = 'all-in'; }
  } else throw new Error('Action inconnue.');
  if (!player.stack && type === 'call') eventType = 'all-in';
  game.acted[id] = true;
  game.actedAtBet[id] = Number(game.currentBet || game.bets[id] || 0);
  if (eventType === 'all-in' && type === 'raise') {
    game.initiatedAllIns ||= {};
    game.initiatedAllIns[id] = Number(game.initiatedAllIns[id] || 0) + 1;
  }
  recordEvent(game, eventType, at, { playerId, action: type, initiatedAllIn: eventType === 'all-in' && type === 'raise', amount: Number(game.bets[id] || 0), paid: type === 'fold' || type === 'check' ? 0 : Number(game.bets[id] || 0) });
  const remaining = next.players.filter(other => !game.folded[key(other.id)] && game.holeCards[key(other.id)]);
  if (remaining.length === 1) { awardUncontested(next, remaining[0].id, at); return next; }
  const canAct = next.players.filter(other => !game.folded[key(other.id)] && !game.allIn[key(other.id)] && other.stack > 0);
  if (canAct.length < 2 && canAct.every(other => game.bets[key(other.id)] >= game.currentBet)) { beginRunout(next, at); return next; }
  if (canAct.every(other => game.acted[key(other.id)] && game.bets[key(other.id)] === game.currentBet)) {
    completeBettingRound(next, at); return next;
  }
  const index = next.players.findIndex(other => key(other.id) === id);
  const following = nextSeat(next, index, other => !game.folded[key(other.id)] && !game.allIn[key(other.id)] && other.stack > 0);
  game.turnId = next.players[following].id;
  recordEvent(game, 'turn-player', at, { playerId: game.turnId });
  return next;
}

export function showPokerCards(room, playerId, at = Date.now()) {
  if (!room || !room.game || room.game.status !== 'showdown' || room.game.lastResult?.type !== 'fold') throw new Error('Aucune main à montrer.');
  const next = normalizePokerRoom(room), game = next.game;
  if (!game.lastResult.winners.some(id => key(id) === key(playerId))) throw new Error('Seul le gagnant peut montrer ses cartes.');
  if (Number(game.lastResult.revealChoiceUntil || 0) < at) throw new Error('Le délai pour montrer les cartes est terminé.');
  if (game.lastResult.shownCards) return next;
  game.lastResult.shownCards = true;
  game.lastResult.revealChoiceUntil = Math.max(Number(game.lastResult.revealChoiceUntil || 0), at + POKER_REVEAL_CHOICE_MS);
  recordEvent(game, 'show-cards', at, { playerId });
  saveCompletedHand(next);
  return next;
}

export function nextPokerHand(room, playerId, at = Date.now(), shuffledDeck = shuffleDeck(), { expectedHandId, commandId } = {}) {
  if (!room || room.status !== 'playing') throw new Error('La main en cours n’est pas terminée.');
  if (expectedHandId && room.game?.handId && key(expectedHandId) !== key(room.game.handId)) return normalizePokerRoom(room);
  if (room.game?.status !== 'showdown') throw new Error('La main en cours n’est pas terminée.');
  if (!room.players.some(player => key(player.id) === key(playerId))) throw new Error('Seul un joueur assis peut lancer la main suivante.');
  if (expectedHandId && key(expectedHandId) !== key(room.game.handId)) throw new Error('La main suivante est déjà lancée.');
  if (room.game.lastResult?.type === 'fold' && Number(room.game.lastResult.revealChoiceUntil || 0) > at) throw new Error('Le gagnant choisit encore s’il montre ses cartes.');
  const normalized = normalizePokerRoom(room);
  if (rememberCommand(normalized.game, commandId)) return normalized;
  return beginHand(normalized, at, shuffledDeck);
}

export function pokerHistoryRecord(room) {
  if (room?.status !== 'finished' || !room.result) throw new Error('Tournoi non terminé.');
  return {
    code: room.code, startedAt: room.startedAt, endedAt: room.finishedAt,
    hands: room.result.hands, style: room.style, lounge: room.lounge || null, settings: pokerSettings(room.settings),
    placements: room.result.placements,
    points: room.result.points,
    players: room.players.map(player => ({ id: player.id, name: player.name, avatar: player.avatar || '' }))
  };
}

function saveCompletedHand(room) {
  const game = room.game, result = game.lastResult;
  const revealed = result.type === 'showdown' ? Object.fromEntries(Object.entries(result.hands || {}).map(([id, hand]) => [id, [...hand.cards]]))
    : result.shownCards ? Object.fromEntries(result.winners.map(id => [key(id), [...(game.holeCards[key(id)] || [])]])) : {};
  room.completedHands ||= {};
  room.completedHands[game.handId] = {
    id: game.handId, code: room.code, handNumber: game.handNumber,
    startedAt: game.startedAt || room.startedAt, endedAt: game.completedAt, revision: game.revision,
    players: room.players.map(player => ({ id: player.id, name: player.name, avatar: player.avatar || '' })),
    board: [...game.board], revealed, winners: [...result.winners], handName: result.handName,
    awards: { ...result.awards }, pots: copy(result.pots || []),
    handLabels: Object.fromEntries(Object.entries(result.hands || {}).map(([id, hand]) => [id, hand.label])),
    initiatedAllIns: { ...(game.initiatedAllIns || {}) }, type: result.type
  };
}

export function pokerPotAward(hand, playerId) {
  const id = key(playerId);
  // Awards can include an uncalled bet refunded to its owner. Only actual
  // contested pots count as winnings in the public hand history.
  if (!hand?.pots?.length) return Number(hand?.awards?.[id] || 0);
  return hand.pots.reduce((total, pot) => {
    if (pot.awards) return total + Number(pot.awards[id] || 0);
    const winners = pot.winners || [], index = winners.findIndex(winner => key(winner) === id);
    return index < 0 ? total : total + Math.floor(pot.amount / winners.length) + (index < pot.amount % winners.length ? 1 : 0);
  }, 0);
}

export function pokerRanking(history = [], profiles = [], hands = []) {
  const rows = new Map(profiles.map(profile => [key(profile.id), { id: profile.id, name: profile.name, avatar: profile.avatar || '', played: 0, wins: 0, podiums: 0, points: 1000 }]));
  for (const match of history) for (const [index, id] of (match.placements || []).entries()) {
    const profile = (match.players || []).find(player => key(player.id) === key(id));
    const row = rows.get(key(id)) || { id, name: profile?.name || 'Joueur', avatar: profile?.avatar || '', played: 0, wins: 0, podiums: 0, points: 1000 };
    row.played++; if (!index) row.wins++; if (index < 2) row.podiums++;
    row.points += Number(match.points?.[key(id)] ?? POKER_PRESTIGE[index] ?? 0);
    rows.set(key(id), row);
  }
  for (const row of rows.values()) { row.handWins = 0; row.allInsGiven = 0; }
  const unique = new Map(hands.filter(hand => hand && !hand.deleted).map(hand => [hand.id, hand]));
  for (const hand of unique.values()) for (const player of hand.players || []) {
    const row = rows.get(key(player.id));
    if (!row) continue;
    if ((hand.winners || []).some(id => key(id) === key(player.id))) row.handWins++;
    row.allInsGiven += Number(hand.initiatedAllIns?.[key(player.id)] || 0);
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.played - a.played || String(a.name).localeCompare(String(b.name), 'fr'));
}
