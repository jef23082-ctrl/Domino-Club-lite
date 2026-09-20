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
} from './engine.js?v=20260920T151452528';

export class GameRuleError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
  }
}

export const TURN_TIMER_OPTIONS = Object.freeze([0, 10, 15, 20, 30]);

export function normalizeTurnTimerSeconds(value, fallback = 15) {
  const seconds = Math.round(Number(value));
  return TURN_TIMER_OPTIONS.includes(seconds) ? seconds : fallback;
}

function resetTurnClock(room, at = Date.now()) {
  const game = room?.game;
  if (!game || game.roundStatus !== 'playing') return;
  const seconds = normalizeTurnTimerSeconds(room.turnTimerSeconds);
  if (!seconds) {
    delete game.turnClock;
    return;
  }
  game.turnClock = {
    turnId: String(game.currentTurnId),
    durationMs: seconds * 1000,
    remainingMs: seconds * 1000,
    deadlineAt: at + seconds * 1000,
    paused: false,
    revision: Number(game.turnClock?.revision || 0) + 1,
    updatedAt: at
  };
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
    style: 'luxe',
    turnTimerSeconds: 15,
    hostToken: clientToken,
    creatorToken: clientToken,
    createdAt: at,
    updatedAt: at,
    players: { [playerKey(profile.id)]: player },
    music: { trackIndex: 0, startedAt: null, changedAt: at }
  };
}

export function joinWaitingRoom(room, { profile, clientToken, at = Date.now() }) {
  rule(room, 'Salle introuvable.', 'room-not-found');
  rule(room.status === 'waiting', 'Cette partie a déjà commencé.', 'room-started');
  room.players = room.players || {};
  const key = playerKey(profile.id);
  const existing = room.players[key];
  rule(existing || Object.keys(room.players).length < 3, 'La salle est déjà complète.', 'room-full');
  const previousToken = existing?.token;
  if (existing && room.hostToken === previousToken) room.hostToken = clientToken;
  if (existing && room.creatorToken === previousToken) room.creatorToken = clientToken;
  room.players[key] = {
    playerId: profile.id,
    name: profile.name,
    avatar: profile.avatar || '❓',
    token: clientToken,
    joinedAt: existing ? existing.joinedAt : at,
    connected: true,
    isHost: room.hostToken === clientToken
  };
  Object.values(room.players).forEach(player => { player.isHost = player.token === room.hostToken; });
  room.updatedAt = at;
  return room;
}

export function reattachPlayerInRoom(room, { profile, clientToken, at = Date.now() }) {
  rule(room && room.status !== 'cancelled', 'Salle introuvable.', 'room-not-found');
  const key = playerKey(profile.id);
  const existing = room.players?.[key];
  rule(existing, 'Ce profil ne possède pas de place dans cette salle.', 'player-not-seated');
  const previousToken = existing.token;
  existing.token = clientToken;
  existing.name = profile.name || existing.name;
  existing.avatar = profile.avatar || existing.avatar || '❓';
  existing.connected = true;
  if (room.hostToken === previousToken) room.hostToken = clientToken;
  if (room.creatorToken === previousToken) room.creatorToken = clientToken;
  Object.values(room.players || {}).forEach(player => {
    player.isHost = player.token === room.hostToken;
  });
  room.updatedAt = at;
  return room;
}

export function startMatchInRoom(room, { clientToken, matchId, musicTrackIndex = null, at = Date.now(), randomIndex }) {
  rule(room, 'La salle n’existe plus.', 'room-not-found');
  rule(room.hostToken === clientToken, 'Seul l’hôte peut lancer la partie.', 'host-only');
  rule(room.status === 'waiting', 'La partie a déjà commencé.', 'room-started');
  const players = roomPlayers(room);
  rule(players.length === 3, 'Il faut exactement trois joueurs.', 'players-count');
  room.status = 'playing';
  room.matchId = matchId;
  room.matchStartedAt = at;
  room.roundLog = [];
  room.music = {
    trackIndex: Math.min(2, Math.max(0, Math.round(Number(musicTrackIndex ?? room.music?.trackIndex) || 0))),
    startedAt: at,
    changedAt: at
  };
  room.game = buildRound(players.map(player => player.playerId), {}, 1, null, { randomIndex, at });
  resetTurnClock(room, at);
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
  room.music = {
    trackIndex: Math.min(2, Math.max(0, Math.round(Number(room.music?.trackIndex) || 0))),
    startedAt: at,
    changedAt: at
  };
  room.game = buildRound(players.map(player => player.playerId), {}, 1, null, { randomIndex, at });
  resetTurnClock(room, at);
  room.updatedAt = at;
  delete room.endedAt;
  return room;
}

export function selectRoomStyle(room, { clientToken, style, at = Date.now() }) {
  rule(room, 'Salle introuvable.', 'room-not-found');
  rule(room.hostToken === clientToken, 'Seul l’hôte choisit le style de la salle.', 'host-only');
  rule(room.status === 'waiting', 'Le style doit être choisi avant de lancer la partie.', 'room-started');
  rule(style === 'classic' || style === 'luxe', 'Ce style de salle n’existe pas.', 'invalid-room-style');
  room.style = style;
  room.updatedAt = at;
  return room;
}

export function selectTurnTimerInRoom(room, { clientToken, seconds, at = Date.now() }) {
  rule(room, 'Salle introuvable.', 'room-not-found');
  rule(room.hostToken === clientToken, 'Seul l’hôte règle le compte à rebours.', 'host-only');
  rule(room.status === 'waiting', 'Le compte à rebours doit être réglé avant de lancer la partie.', 'room-started');
  const normalized = normalizeTurnTimerSeconds(seconds, -1);
  rule(normalized >= 0, 'Cette durée de compte à rebours n’existe pas.', 'invalid-turn-timer');
  room.turnTimerSeconds = normalized;
  room.updatedAt = at;
  return room;
}

export function setTurnClockPausedInRoom(room, { clientToken, paused, expectedTurnId, at = Date.now() }) {
  rule(room?.status === 'playing' && room.game?.roundStatus === 'playing', 'La manche n’est pas active.', 'round-inactive');
  rule(roomPlayers(room).some(player => player.token === clientToken), 'Seul un joueur de la salle peut synchroniser la pause.', 'player-only');
  const clock = room.game.turnClock;
  if (!clock) return room;
  rule(String(room.game.currentTurnId) === String(expectedTurnId) && String(clock.turnId) === String(expectedTurnId), 'Le tour a déjà changé.', 'stale-turn');
  const nextPaused = Boolean(paused);
  if (clock.paused === nextPaused) return room;
  if (nextPaused) {
    clock.remainingMs = Math.max(0, Number(clock.deadlineAt || at) - at);
    clock.paused = true;
    clock.pausedAt = at;
  } else {
    clock.deadlineAt = at + Math.max(0, Number(clock.remainingMs || 0));
    clock.paused = false;
    delete clock.pausedAt;
  }
  clock.updatedAt = at;
  room.updatedAt = at;
  return room;
}

export function selectRoomMusic(room, { clientToken, trackIndex, at = Date.now() }) {
  rule(room && room.status !== 'cancelled', 'Salle introuvable.', 'room-not-found');
  rule(room.hostToken === clientToken, 'Seul l’hôte choisit la musique de la table.', 'host-only');
  const nextTrack = Math.min(2, Math.max(0, Math.round(Number(trackIndex) || 0)));
  room.music = {
    trackIndex: nextTrack,
    startedAt: room.status === 'playing' ? at : null,
    changedAt: at
  };
  room.updatedAt = at;
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
  rule(!game.turnClock?.paused, 'La partie est en pause pendant le travail d’un joueur.', 'game-paused');
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
  if (game.hands[handKey].length === 0) finishRoundInRoom(room, playerId, 'empty', { points: 0, lastTileId: tileId }, at);
  else {
    advanceTurn(game);
    resetTurnClock(room, at);
  }
  room.updatedAt = at;
  return room;
}

export function passTurnInRoom(room, { playerId, at = Date.now() }) {
  rule(room?.status === 'playing' && room.game?.roundStatus === 'playing', 'La manche n’est pas active.', 'round-inactive');
  const game = room.game;
  rule(!game.turnClock?.paused, 'La partie est en pause pendant le travail d’un joueur.', 'game-paused');
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
    resetTurnClock(room, at);
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
  resetTurnClock(room, at);
  room.updatedAt = at;
  return room;
}

export function timeoutTurnInRoom(room, { expectedTurnId, at = Date.now(), randomIndex = limit => Math.floor(Math.random() * limit) }) {
  rule(room?.status === 'playing' && room.game?.roundStatus === 'playing', 'La manche n’est pas active.', 'round-inactive');
  const game = room.game;
  const turnId = game.currentTurnId;
  const clock = game.turnClock;
  rule(clock && normalizeTurnTimerSeconds(room.turnTimerSeconds) > 0, 'Le compte à rebours est désactivé.', 'turn-timer-disabled');
  rule(!clock.paused, 'La partie est en pause.', 'game-paused');
  rule(String(turnId) === String(expectedTurnId) && String(clock.turnId) === String(expectedTurnId), 'Le tour a déjà changé.', 'stale-turn');
  rule(Number(clock.deadlineAt || 0) <= at, 'Le compte à rebours n’est pas terminé.', 'turn-timer-active');

  const hand = game.hands?.[playerKey(turnId)] || [];
  const forced = !game.board?.placements?.length && game.forcedOpeningTileId;
  const candidates = forced
    ? hand.filter(tileId => tileId === game.forcedOpeningTileId)
    : hand.filter(tileId => validSides(tileId, game.board).length > 0);
  if (!candidates.length) {
    passTurnInRoom(room, { playerId: turnId, at });
    game.lastAction.auto = true;
    game.lastAction.reason = 'timeout';
    return room;
  }
  const tileId = candidates[Math.max(0, Math.min(candidates.length - 1, Number(randomIndex(candidates.length)) || 0))];
  const sides = validSides(tileId, game.board);
  const side = sides[Math.max(0, Math.min(sides.length - 1, Number(randomIndex(sides.length)) || 0))];
  playTileInRoom(room, { playerId: turnId, tileId, side, at });
  game.lastAction.auto = true;
  game.lastAction.reason = 'timeout';
  return room;
}
