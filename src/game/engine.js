/**
 * Moteur fonctionnel extrait de la V2.
 *
 * Invariants conservés : plateau 1500 × 440, dominos 120 × 70,
 * doubles perpendiculaires, ports gauche/droite et layoutVersion 12.
 * Ce module ne connaît ni le DOM ni Firebase.
 */

export const BOARD_GEOMETRY = Object.freeze({
  width: 1500,
  height: 440,
  centerX: 750,
  centerY: 220,
  tileLength: 120,
  tileWidth: 70,
  margin: 8,
  layoutVersion: 12
});

export function playerKey(id) {
  return `p_${String(id)}`;
}

export function now() {
  return Date.now();
}

export function createDeck() {
  const deck = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) deck.push(`d_${a}_${b}`);
  }
  return deck;
}

export function shuffle(array, randomIndex) {
  const result = [...array];
  for (let index = result.length - 1; index > 0; index -= 1) {
    let selected;
    if (typeof randomIndex === 'function') {
      selected = randomIndex(index + 1);
    } else if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      selected = value[0] % (index + 1);
    } else {
      selected = Math.floor(Math.random() * (index + 1));
    }
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}

export function parseTile(tileId) {
  const parts = String(tileId).split('_');
  return { id: tileId, a: Number(parts[1]), b: Number(parts[2]) };
}

export function tilePoints(tileId) {
  const tile = parseTile(tileId);
  return tile.a + tile.b;
}

export function handPoints(hand) {
  return (hand || []).reduce((sum, tileId) => sum + tilePoints(tileId), 0);
}

export function chooseOpening(playerIds, hands) {
  let best = null;
  playerIds.forEach((playerId, playerIndex) => {
    (hands[playerKey(playerId)] || []).forEach(tileId => {
      const tile = parseTile(tileId);
      const candidate = {
        playerId,
        tileId,
        isDouble: tile.a === tile.b,
        value: tile.a + tile.b,
        doubleValue: tile.a === tile.b ? tile.a : -1,
        playerIndex
      };
      if (
        !best ||
        (candidate.isDouble && !best.isDouble) ||
        (candidate.isDouble === best.isDouble && candidate.doubleValue > best.doubleValue) ||
        (
          candidate.isDouble === best.isDouble &&
          candidate.doubleValue === best.doubleValue &&
          candidate.value > best.value
        ) ||
        (
          candidate.isDouble === best.isDouble &&
          candidate.doubleValue === best.doubleValue &&
          candidate.value === best.value &&
          candidate.playerIndex < best.playerIndex
        )
      ) {
        best = candidate;
      }
    });
  });
  return best;
}

export function buildRound(playerIds, roundWins = {}, roundNumber = 1, starterId = null, options = {}) {
  const deck = shuffle(createDeck(), options.randomIndex);
  const hands = {};
  playerIds.forEach(id => {
    hands[playerKey(id)] = [];
  });
  for (let index = 0; index < 21; index += 1) {
    hands[playerKey(playerIds[index % playerIds.length])].push(deck[index]);
  }
  Object.values(hands).forEach(hand => hand.sort((left, right) => tilePoints(right) - tilePoints(left)));

  let opening = null;
  if (starterId === null || starterId === undefined) opening = chooseOpening(playerIds, hands);
  const chosenStarter = starterId !== null && starterId !== undefined ? starterId : opening.playerId;

  return {
    roundNumber,
    playerOrder: [...playerIds],
    roundWins: { ...roundWins },
    hands,
    unusedTiles: deck.slice(21),
    board: { placements: [], leftEnd: null, rightEnd: null },
    starterId: chosenStarter,
    currentTurnId: chosenStarter,
    forcedOpeningTileId: starterId === null || starterId === undefined ? opening.tileId : null,
    consecutivePasses: 0,
    roundStatus: 'playing',
    roundResult: null,
    matchResult: null,
    lastAction: { type: 'round-start', at: options.at ?? now() }
  };
}

export function validSides(tileId, board) {
  const tile = parseTile(tileId);
  const placements = board?.placements || [];
  if (!placements.length) return ['left', 'right'];
  const sides = [];
  if (tile.a === board.leftEnd || tile.b === board.leftEnd) sides.push('left');
  if (tile.a === board.rightEnd || tile.b === board.rightEnd) sides.push('right');
  return sides;
}

export function ensureBoard(game) {
  if (!game.board || typeof game.board !== 'object') game.board = {};
  if (!Array.isArray(game.board.placements)) game.board.placements = [];
  return game.board;
}

export function hasPlayableTile(game, playerId) {
  ensureBoard(game);
  const hand = game.hands?.[playerKey(playerId)] || [];
  if (!hand.length) return false;
  if (!game.board.placements.length && game.forcedOpeningTileId) {
    return hand.includes(game.forcedOpeningTileId);
  }
  return hand.some(tileId => validSides(tileId, game.board).length > 0);
}

export function advanceTurn(game) {
  const order = game.playerOrder || [];
  const index = order.findIndex(id => String(id) === String(game.currentTurnId));
  game.currentTurnId = order[(index + 1 + order.length) % order.length];
}

export function placementBounds(placement) {
  const vertical = Math.abs(Math.round(Number(placement.angle || 0) / 90)) % 2 === 1;
  const width = vertical ? BOARD_GEOMETRY.tileWidth : BOARD_GEOMETRY.tileLength;
  const height = vertical ? BOARD_GEOMETRY.tileLength : BOARD_GEOMETRY.tileWidth;
  return {
    left: Number(placement.cx) - width / 2,
    right: Number(placement.cx) + width / 2,
    top: Number(placement.cy) - height / 2,
    bottom: Number(placement.cy) + height / 2
  };
}

export function boundsOverlap(left, right) {
  const epsilon = 0.5;
  return (
    left.left < right.right - epsilon &&
    left.right > right.left + epsilon &&
    left.top < right.bottom - epsilon &&
    left.bottom > right.top + epsilon
  );
}

function directionAngle(direction) {
  return Math.atan2(direction.dy, direction.dx) * 180 / Math.PI;
}

function turnDirection(direction, turnSign) {
  return turnSign === 1
    ? { dx: -direction.dy, dy: direction.dx }
    : { dx: direction.dy, dy: -direction.dx };
}

function canPlace(board, candidate, extraPlacements = []) {
  const bounds = placementBounds(candidate);
  const margin = BOARD_GEOMETRY.margin;
  if (
    bounds.left < margin ||
    bounds.right > BOARD_GEOMETRY.width - margin ||
    bounds.top < margin ||
    bounds.bottom > BOARD_GEOMETRY.height - margin
  ) {
    return false;
  }
  return [...(board.placements || []), ...extraPlacements].every(existing =>
    !Number.isFinite(Number(existing.cx)) || !boundsOverlap(bounds, placementBounds(existing))
  );
}

function straightCandidate(port, faceA, faceB) {
  const length = BOARD_GEOMETRY.tileLength;
  return {
    cx: port.x + port.dx * length / 2,
    cy: port.y + port.dy * length / 2,
    angle: directionAngle(port),
    faceA,
    faceB,
    nextPort: {
      ...port,
      x: port.x + port.dx * length,
      y: port.y + port.dy * length,
      afterDouble: false
    }
  };
}

function doubleCandidate(port, value) {
  const width = BOARD_GEOMETRY.tileWidth;
  return {
    cx: port.x + port.dx * width / 2,
    cy: port.y + port.dy * width / 2,
    angle: directionAngle(port) + 90,
    faceA: value,
    faceB: value,
    nextPort: {
      ...port,
      x: port.x + port.dx * width,
      y: port.y + port.dy * width,
      afterDouble: true
    }
  };
}

function turnCandidate(port, faceA, faceB, turnSign = port.turnSign || 1) {
  const width = BOARD_GEOMETRY.tileWidth;
  const length = BOARD_GEOMETRY.tileLength;
  const direction = turnDirection(port, turnSign);
  const outerHalfX = port.x - port.dx * length / 4;
  const outerHalfY = port.y - port.dy * length / 4;
  const turnOffset = width / 2 + length / 2;
  const cx = outerHalfX + direction.dx * turnOffset;
  const cy = outerHalfY + direction.dy * turnOffset;
  return {
    cx,
    cy,
    angle: directionAngle(direction),
    faceA,
    faceB,
    nextPort: {
      x: cx + direction.dx * length / 2,
      y: cy + direction.dy * length / 2,
      dx: direction.dx,
      dy: direction.dy,
      turnSign,
      branch: port.branch,
      afterDouble: false
    }
  };
}

function outwardTurnSign(port) {
  const outwardDy = port.branch === 'left' ? -1 : 1;
  return outwardDy / Number(port.dx || 1);
}

function rowTurnSign(port) {
  const rowDx = Number(port.x) < BOARD_GEOMETRY.centerX ? 1 : -1;
  return rowDx === -Number(port.dy) ? 1 : -1;
}

function cornerDoubleCandidate(port, value, forcedTurnSign = null) {
  const verticalPort = Math.abs(Number(port.dy)) === 1;
  const turnSign = forcedTurnSign ?? (verticalPort ? rowTurnSign(port) : outwardTurnSign(port));
  const direction = turnDirection(port, turnSign);
  const length = BOARD_GEOMETRY.tileLength;
  const width = BOARD_GEOMETRY.tileWidth;
  const outerHalfX = port.x - port.dx * length / 4;
  const outerHalfY = port.y - port.dy * length / 4;
  const turnOffset = width / 2 + length / 2;
  const cx = outerHalfX + direction.dx * turnOffset;
  const cy = outerHalfY + direction.dy * turnOffset;
  return {
    cx,
    cy,
    angle: directionAngle(direction),
    faceA: value,
    faceB: value,
    nextPort: {
      x: cx + direction.dx * length / 2,
      y: cy + direction.dy * length / 2,
      dx: direction.dx,
      dy: direction.dy,
      turnSign,
      branch: port.branch,
      afterDouble: false
    }
  };
}

function canFinishNormalPath(board, port, value, extraPlacements, steps) {
  if (steps <= 0) return true;
  const preferredSign = Math.abs(Number(port.dy)) === 1 ? rowTurnSign(port) : outwardTurnSign(port);
  const candidates = [
    straightCandidate(port, value, value),
    turnCandidate(port, value, value, preferredSign),
    turnCandidate(port, value, value, -preferredSign)
  ];
  return candidates.some(candidate =>
    canPlace(board, candidate, extraPlacements) &&
    canFinishNormalPath(board, candidate.nextPort, value, [...extraPlacements, candidate], steps - 1)
  );
}

function chooseCandidate(board, port, faceA, faceB, isDouble) {
  const rowTiles = Number(port.rowTiles || 0);
  const rowLimit = Number(port.lane || 0) === 0 ? 5 : 10;
  const verticalPort = Math.abs(Number(port.dy)) === 1;

  if (isDouble) {
    const preferCorner = !verticalPort && rowTiles >= rowLimit;
    const preferredSign = verticalPort ? rowTurnSign(port) : outwardTurnSign(port);
    const standardDouble = { candidate: doubleCandidate(port, faceA), isCorner: false };
    const preferredCorner = { candidate: cornerDoubleCandidate(port, faceA, preferredSign), isCorner: true };
    const oppositeCorner = { candidate: cornerDoubleCandidate(port, faceA, -preferredSign), isCorner: true };
    const candidates = preferCorner
      ? [preferredCorner, standardDouble, oppositeCorner]
      : [standardDouble, preferredCorner, oppositeCorner];

    for (const option of candidates) {
      const candidate = option.candidate;
      const isCorner = option.isCorner;
      candidate.nextPort.rowTiles = isCorner ? 0 : rowTiles + (verticalPort ? 0 : 1);
      candidate.nextPort.lane = Number(port.lane || 0) + (isCorner ? 1 : 0);
      const exitOptions = isCorner
        ? [
            turnCandidate(candidate.nextPort, faceA, faceA, rowTurnSign(candidate.nextPort)),
            straightCandidate(candidate.nextPort, faceA, faceA),
            turnCandidate(candidate.nextPort, faceA, faceA, -rowTurnSign(candidate.nextPort))
          ]
        : [straightCandidate(candidate.nextPort, faceA, faceA)];
      const exit = exitOptions.find(optionCandidate => canPlace(board, optionCandidate, [candidate]));
      const placedCount = board.placements?.length || 0;
      const remainingAfterExit = Math.max(0, 19 - placedCount);
      const hasContinuation = exit && canFinishNormalPath(
        board,
        exit.nextPort,
        faceA,
        [candidate, exit],
        Math.min(3, remainingAfterExit)
      );
      if (canPlace(board, candidate) && (placedCount >= 20 || (exit && hasContinuation))) return candidate;
    }
    throw new Error('Le double ne peut pas être placé perpendiculairement sans chevauchement.');
  }

  const preferredSign = verticalPort ? rowTurnSign(port) : outwardTurnSign(port);
  const straightOption = { candidate: straightCandidate(port, faceA, faceB), kind: 'straight' };
  const preferredOption = { candidate: turnCandidate(port, faceA, faceB, preferredSign), kind: 'turn' };
  const oppositeOption = { candidate: turnCandidate(port, faceA, faceB, -preferredSign), kind: 'turn' };
  let options;
  if (port.afterDouble) options = [straightOption];
  else if (verticalPort || rowTiles >= rowLimit) options = [preferredOption, straightOption, oppositeOption];
  else options = [straightOption, preferredOption, oppositeOption];

  const placedCount = board.placements?.length || 0;
  const remaining = Math.max(0, 20 - placedCount);
  const lookAhead = placedCount >= 17 ? Math.min(3, remaining) : Math.min(1, remaining);
  for (const option of options) {
    const candidate = option.candidate;
    const isTurn = option.kind === 'turn';
    candidate.nextPort.rowTiles = isTurn ? (verticalPort ? 1 : 0) : rowTiles + (verticalPort ? 0 : 1);
    candidate.nextPort.lane = Number(port.lane || 0) + (isTurn && !verticalPort ? 1 : 0);
    if (
      canPlace(board, candidate) &&
      canFinishNormalPath(board, candidate.nextPort, faceB, [candidate], lookAhead)
    ) {
      return candidate;
    }
  }
  if (port.afterDouble) throw new Error('La sortie du double ne dispose pas de la place nécessaire.');
  throw new Error('Le plateau ne dispose plus d’un emplacement valide.');
}

export function boardHasCurrentLayout(board) {
  const placements = board?.placements;
  if (!Array.isArray(placements) || !placements.length) return true;
  return (
    Number(board.layoutVersion) === BOARD_GEOMETRY.layoutVersion &&
    board.leftPort &&
    board.rightPort &&
    placements.every(placement =>
      Number.isFinite(Number(placement.cx)) &&
      Number.isFinite(Number(placement.cy)) &&
      Number.isFinite(Number(placement.angle))
    )
  );
}

export function placeTileCore(board, tileId, side, playerId, playedAt = now()) {
  const tile = parseTile(tileId);
  board.placements = board.placements || [];
  board.layoutVersion = BOARD_GEOMETRY.layoutVersion;

  if (!board.placements.length) {
    const isDouble = tile.a === tile.b;
    const angle = isDouble ? 90 : 0;
    const placement = {
      tileId,
      left: tile.a,
      right: tile.b,
      side: 'start',
      playerId,
      playedAt,
      cx: BOARD_GEOMETRY.centerX,
      cy: BOARD_GEOMETRY.centerY,
      angle,
      faceA: tile.a,
      faceB: tile.b
    };
    board.leftEnd = tile.a;
    board.rightEnd = tile.b;
    const halfSpan = isDouble ? BOARD_GEOMETRY.tileWidth / 2 : BOARD_GEOMETRY.tileLength / 2;
    board.leftPort = {
      x: placement.cx - halfSpan,
      y: placement.cy,
      dx: -1,
      dy: 0,
      turnSign: 1,
      branch: 'left',
      rowTiles: 0,
      lane: 0
    };
    board.rightPort = {
      x: placement.cx + halfSpan,
      y: placement.cy,
      dx: 1,
      dy: 0,
      turnSign: 1,
      branch: 'right',
      rowTiles: 0,
      lane: 0
    };
    board.placements.push(placement);
    return placement;
  }

  const playLeft = side === 'left';
  const matchedValue = playLeft ? board.leftEnd : board.rightEnd;
  const outerValue = tile.a === matchedValue ? tile.b : tile.a;
  const portKey = playLeft ? 'leftPort' : 'rightPort';
  const port = board[portKey];
  if (!port) throw new Error('Extrémité graphique du plateau absente.');
  const candidate = chooseCandidate(board, port, matchedValue, outerValue, tile.a === tile.b);
  const placement = {
    tileId,
    left: playLeft ? outerValue : matchedValue,
    right: playLeft ? matchedValue : outerValue,
    side: playLeft ? 'left' : 'right',
    playerId,
    playedAt,
    cx: candidate.cx,
    cy: candidate.cy,
    angle: candidate.angle,
    faceA: candidate.faceA,
    faceB: candidate.faceB
  };
  board[portKey] = candidate.nextPort;
  if (playLeft) {
    board.leftEnd = outerValue;
    board.placements.unshift(placement);
  } else {
    board.rightEnd = outerValue;
    board.placements.push(placement);
  }
  return placement;
}

export function migrateBoardLayout(board) {
  if (!board?.placements?.length || boardHasCurrentLayout(board)) return board;
  const chronological = board.placements
    .map((placement, index) => ({ ...placement, _index: index }))
    .sort((left, right) =>
      Number(left.playedAt || 0) - Number(right.playedAt || 0) || left._index - right._index
    );
  board.placements = [];
  delete board.leftPort;
  delete board.rightPort;
  chronological.forEach((placement, index) => {
    placeTileCore(
      board,
      placement.tileId,
      index === 0 ? 'start' : placement.side,
      placement.playerId,
      placement.playedAt || now() + index
    );
  });
  return board;
}

export function placeTile(board, tileId, side, playerId, playedAt = now()) {
  board.placements = board.placements || [];
  if (board.placements.length && !boardHasCurrentLayout(board)) migrateBoardLayout(board);
  return placeTileCore(board, tileId, side, playerId, playedAt);
}

export function finishRoundInRoom(room, winnerId, cause, details = {}, at = now()) {
  const game = room.game;
  const key = playerKey(winnerId);
  game.roundWins = game.roundWins || {};
  game.roundWins[key] = Number(game.roundWins[key] || 0) + 1;
  game.roundStatus = 'ended';
  game.roundResult = {
    type: 'winner',
    winnerId,
    cause,
    points: details.points ?? 0,
    handPoints: details.handPoints || null,
    at
  };
  room.roundLog = room.roundLog || [];
  room.roundLog.push({
    roundNumber: game.roundNumber,
    type: 'winner',
    winnerId,
    cause,
    points: details.points ?? 0,
    scores: { ...game.roundWins },
    at
  });
  const playerIds = game.playerOrder || [];
  if (Number(game.roundWins[key]) >= 3) {
    const cochonIds = playerIds.filter(id =>
      String(id) !== String(winnerId) && Number(game.roundWins[playerKey(id)] || 0) === 0
    );
    game.matchResult = {
      type: 'victory',
      winnerId,
      cochonIds,
      savedId: null,
      scores: { ...game.roundWins },
      at
    };
    room.status = 'finished';
    room.endedAt = at;
  } else if (playerIds.every(id => Number(game.roundWins[playerKey(id)] || 0) > 0)) {
    game.matchResult = {
      type: 'cancelled',
      winnerId: null,
      cochonIds: [],
      savedId: winnerId,
      scores: { ...game.roundWins },
      at
    };
    room.status = 'finished';
    room.endedAt = at;
  }
  game.lastAction = { type: 'round-win', playerId: winnerId, cause, at };
  room.updatedAt = at;
}

export function cancelRoundInRoom(room, reason, handPointTotals = {}, at = now()) {
  const game = room.game;
  game.roundStatus = 'ended';
  game.roundResult = { type: 'annulled', reason, handPoints: handPointTotals, at };
  room.roundLog = room.roundLog || [];
  room.roundLog.push({
    roundNumber: game.roundNumber,
    type: 'annulled',
    reason,
    handPoints: handPointTotals,
    scores: { ...(game.roundWins || {}) },
    at
  });
  game.lastAction = { type: 'round-annulled', reason, at };
  room.updatedAt = at;
}
