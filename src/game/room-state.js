import {
  advanceTurn,
  buildRound,
  cancelRoundInRoom,
  ensureBoard,
  finishRoundInRoom,
  handPoints,
  hasPlayableTile,
  placeTile,
  playerKey,
  validSides
} from './engine.js';

export class GameRuleError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
  }
}

function rule(condition, message, code) {
  if (!condition) throw new GameRuleError(message, code);
}

export function roomPlayers(room) {
  return Object.values(room?.players || {}).sort(
    (left, right) => Number(left.joinedAt || 0) - Number(right.joinedAt || 0)
  );
}

export function createInitialRoom({ code, profile, clientToken, at = Date.now() }) {
  const player = {
    playerId: profile.id,
    name: profile.name,
    avatar: profile.avatar || '❓',
    token: clientToken,
    joinedAt: at,
    connected: true,
    isHost: true
  };
  return {
    version: 1,
    code,
    status: 'waiting',
    hostToken: clientToken,
    creatorToken: clientToken,
    createdAt: at,
    updatedAt: at,
    players: { [playerKey(profile.id)]: player }
  };
}

export function joinWaitingRoom(room, { profile, clientToken, at = Date.now() }) {
  rule(room, 'Salle introuvable.', 'room-not-found');
  rule(room.status === 'waiting', 'Cette partie a déjà commencé.', 'room-started');
  room.players = room.players || {};
  const key = playerKey(profile.id);
  const existing = room.players[key];
  rule(!existing || existing.token === clientToken, 'Ce profil est déjà utilisé dans cette salle.', 'profile-in-use');
  rule(existing || Object.keys(room.players).length < 3, 'La salle est déjà complète.', 'room-full');
  room.players[key] = {
    playerId: profile.id,
    name: profile.name,
    avatar: profile.avatar || '❓',
    token: clientToken,
    joinedAt: existing ? existing.joinedAt : at,
    connected: true,
    isHost: room.hostToken === clientToken
  };
  room.updatedAt = at;
  return room;
}

export function startMatchInRoom(room, { clientToken, matchId, at = Date.now(), randomIndex }) {
  rule(room, 'La salle n’existe plus.', 'room-not-found');
  rule(room.hostToken === clientToken, 'Seul l’hôte peut lancer la partie.', 'host-only');
  rule(room.status === 'waiting', 'La partie a déjà commencé.', 'room-started');
  const players = roomPlayers(room);
  rule(players.length === 3, 'Il faut exactement trois joueurs.', 'players-count');
  room.status = 'playing';
  room.matchId = matchId;
  room.matchStartedAt = at;
  room.roundLog = [];
  room.game = buildRound(players.map(player => player.playerId), {}, 1, null, { randomIndex, at });
  room.updatedAt = at;
  return room;
}

export function startRematchInRoom(room, { clientToken, matchId, at = Date.now(), randomIndex }) {
  rule(room, 'La salle n’existe plus.', 'room-not-found');
  rule(room.status === 'finished', 'La partie n’est pas terminée.', 'match-not-finished');
  const players = roomPlayers(room);
  rule(players.length === 3, 'Il faut exactement trois joueurs.', 'players-count');
  rule(players.some(player => player.token === clientToken), 'Seul un joueur de la salle peut relancer.', 'player-only');
  room.hostToken = clientToken;
  Object.values(room.players || {}).forEach(player => {
    player.isHost = player.token === clientToken;
  });
  room.status = 'playing';
  room.matchId = matchId;
  room.matchStartedAt = at;
  room.roundLog = [];
  room.game = buildRound(players.map(player => player.playerId), {}, 1, null, { randomIndex, at });
  room.updatedAt = at;
  delete room.endedAt;
  return room;
}

export function leaveWaitingRoom(room, { playerId, clientToken, at = Date.now() }) {
  rule(room?.status === 'waiting', 'La salle ne peut plus être quittée de cette façon.', 'room-not-waiting');
  delete room.players?.[playerKey(playerId)];
  const remaining = roomPlayers(room);
  if (!remaining.length) return null;
  if (room.hostToken === clientToken) {
    room.hostToken = remaining[0].token;
    remaining.forEach(player => {
      player.isHost = player.token === room.hostToken;
    });
  }
  room.updatedAt = at;
  return room;
}

export function cancelRoomInState(room, { clientToken, creatorName, at = Date.now() }) {
  rule(room, 'La salle n’existe plus.', 'room-not-found');
  rule((room.creatorToken || room.hostToken) === clientToken, 'Seul le créateur peut annuler cette partie.', 'creator-only');
  room.status = 'cancelled';
  room.cancelledAt = at;
  room.cancelledBy = { token: clientToken, name: creatorName || 'le créateur' };
  room.updatedAt = at;
  return room;
}

export function playTileInRoom(room, { playerId, tileId, side, at = Date.now() }) {
  rule(room?.status === 'playing' && room.game?.roundStatus === 'playing', 'La manche n’est pas active.', 'round-inactive');
  const game = room.game;
  rule(String(game.currentTurnId) === String(playerId), 'Ce n’est pas ton tour.', 'wrong-turn');
  const board = ensureBoard(game);
  const handKey = playerKey(playerId);
  const hand = game.hands?.[handKey] || [];
  rule(hand.includes(tileId), 'Ce domino n’est plus dans ta main.', 'tile-missing');
  rule(
    board.placements.length || !game.forcedOpeningTileId || tileId === game.forcedOpeningTileId,
    'Tu dois commencer avec le domino imposé.',
    'forced-opening'
  );
  rule(validSides(tileId, board).includes(side), 'Ce domino ne peut pas être joué de ce côté.', 'invalid-side');

  game.hands[handKey] = hand.filter(id => id !== tileId);
  placeTile(board, tileId, side, playerId, at);
  game.forcedOpeningTileId = null;
  game.consecutivePasses = 0;
  game.lastAction = { type: 'play', playerId, tileId, side, at };
  if (game.hands[handKey].length === 0) finishRoundInRoom(room, playerId, 'empty', { points: 0 }, at);
  else advanceTurn(game);
  room.updatedAt = at;
  return room;
}

export function passTurnInRoom(room, { playerId, at = Date.now() }) {
  rule(room?.status === 'playing' && room.game?.roundStatus === 'playing', 'La manche n’est pas active.', 'round-inactive');
  const game = room.game;
  rule(String(game.currentTurnId) === String(playerId), 'Ce n’est pas ton tour.', 'wrong-turn');
  rule(!hasPlayableTile(game, playerId), 'Tu possèdes au moins un domino jouable.', 'playable-tile');

  game.consecutivePasses = Number(game.consecutivePasses || 0) + 1;
  game.lastAction = { type: 'pass', playerId, at };
  if (game.consecutivePasses >= (game.playerOrder || []).length) {
    const totals = {};
    game.playerOrder.forEach(id => {
      totals[playerKey(id)] = handPoints(game.hands?.[playerKey(id)] || []);
    });
    const values = Object.values(totals).map(Number);
    const minimum = Math.min(...values);
    const candidates = game.playerOrder.filter(id => Number(totals[playerKey(id)]) === minimum);
    if (minimum < 7 && candidates.length === 1) {
      finishRoundInRoom(room, candidates[0], 'blocked', { points: minimum, handPoints: totals }, at);
    } else {
      const reason = candidates.length > 1
        ? 'égalité sur le plus petit total'
        : 'plus petit total égal ou supérieur à 7';
      cancelRoundInRoom(room, reason, totals, at);
    }
  } else {
    advanceTurn(game);
    room.updatedAt = at;
  }
  return room;
}

export function startNextRoundInRoom(room, { at = Date.now(), randomIndex }) {
  rule(room?.status === 'playing' && room.game?.roundStatus === 'ended', 'La manche n’est pas terminée.', 'round-not-ended');
  const starterId = room.game.roundResult?.type === 'winner' ? room.game.roundResult.winnerId : null;
  room.game = buildRound(
    room.game.playerOrder,
    room.game.roundWins,
    Number(room.game.roundNumber || 0) + 1,
    starterId,
    { randomIndex, at }
  );
  room.updatedAt = at;
  return room;
}
