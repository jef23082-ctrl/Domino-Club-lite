export const automaticIds = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 26, 27, 31, 34, 35, 36, 39, 40, 45, 51, 52,
  66, 71, 76, 77, 79, 80, 81, 86, 91, 141, 142, 143, 144, 145, 146, 147, 148, 149,
  150, 151, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 166, 167, 168, 173,
  175, 176, 177, 180, 182, 183, 184, 187, 189, 190
]);

const same = (a, b) => String(a) === String(b);
const rounds = room => Object.values(room.roundLog || {});
const ordered = board => [...board.placements].sort((a, b) => a.playedAt - b.playedAt);
const choice = (rules, fallback) => rules.find(([matches]) => matches)?.[1] ?? fallback;
const isDouble = tile => tile.a === tile.b;
const hasBlank = tile => tile.a === 0 || tile.b === 0;
const pointTotals = result => Object.values(result.handPoints ?? {}).map(Number).sort((a, b) => a - b);

export function createTableEvents({ playerKey, parseTile, localId }) {
  const byPlayer = new Map();
  let actionKey = '';
  let roundKey = '';
  let hasPassed = false;

  function resolvedRound(room) {
    const { game } = room;
    const result = game.roundResult;
    const match = game.matchResult;
    const id = result.winnerId ?? game.currentTurnId ?? localId;
    const totals = pointTotals(result);
    let interaction;
    if (match?.type === 'victory') {
      const scores = Object.values(match.scores).sort((a, b) => a - b);
      const log = rounds(room);
      const preceding = log.slice(-3);
      const streak = preceding.length === 3 && preceding.every(item => same(item.winnerId, id));
      const before = log.at(-4)?.scores;
      const comeback = streak && before && !before[playerKey(id)] && Object.values(before).some(score => score === 2);
      interaction = choice([[comeback, 86], [scores.join() === '0,2,3', 187], [streak, 52]], 81);
    } else if (match?.type === 'cancelled') {
      const scores = Object.values(match.scores);
      interaction = scores.every(score => score === 1) ? 180 : 45;
    } else if (result.type === 'annulled') {
      interaction = choice([
        [totals.length === 3 && totals.every(total => total === totals[0]), 184],
        [totals[0] === totals[1], 79],
        [totals[0] === 7, 183]
      ], 35);
    } else if (result.cause === 'blocked') {
      const lastHand = result.remainingHands?.[playerKey(id)] ?? [];
      interaction = choice([[totals[1] - totals[0] === 1, 36], [lastHand.length === 1, 182]], 71);
    } else {
      const rivalCounts = Object.entries(result.remainingHands ?? {}).filter(([key]) => key !== playerKey(id))
        .map(([, hand]) => hand.length);
      const secondWin = same(rounds(room).at(-2)?.winnerId, id);
      interaction = choice([
        [secondWin, 51],
        [game.board.placements.length === 19, 80],
        [rivalCounts.includes(1), 77],
        [rivalCounts.length === 2 && rivalCounts.every(count => count >= 4), 76]
      ], 71);
    }
    return { id: interaction, playerId: id, priority: 3 };
  }

  function readPlay(room, previous, action, personal) {
    const { game } = room;
    const { board } = game;
    const poses = ordered(board);
    const tile = parseTile(action.tileId);
    const pair = [board.leftEnd, board.rightEnd];
    const before = previous?.game?.board;
    const oldPair = [before?.leftEnd, before?.rightEnd];
    const clock = previous?.game?.turnClock;
    const remaining = same(clock?.turnId, action.playerId) ? clock.deadlineAt - action.at : NaN;
    const quick = remaining > 0 && clock.durationMs - remaining < 2000;
    const past = rounds(room).at(-1);
    const lastTile = poses.at(-2);
    const priorSide = poses.slice(-4, -1).map(pose => pose.side);
    const lastSides = poses.slice(-5).map(pose => pose.side);
    const recentValues = poses.map(pose => parseTile(pose.tileId));
    const priorTile = recentValues.at(-2);
    const exhausted = [tile.a, tile.b].some(value => recentValues.filter(piece => piece.a === value || piece.b === value).length === 7);
    const allValues = new Set(recentValues.flatMap(piece => [piece.a, piece.b]));
    const oldValues = new Set(recentValues.slice(0, -1).flatMap(piece => [piece.a, piece.b]));
    const counts = game.playerOrder.map(id => game.hands[playerKey(id)]?.length ?? 0);
    const theirCounts = game.playerOrder.filter(id => !same(id, action.playerId)).map(id => game.hands[playerKey(id)]?.length ?? 0);
    const selfCount = game.hands[playerKey(action.playerId)]?.length;
    const matchBefore = [tile.a, tile.b].filter((value, index, values) => values.indexOf(value) === index);
    const options = oldPair.filter(value => matchBefore.includes(value)).length;
    const firstDouble = isDouble(tile) && recentValues.slice(0, -1).every(piece => !isDouble(piece));

    return choice([
      [poses.length === 1 && past?.type === 'annulled' && previous?.game?.forcedOpeningTileId, 190],
      [poses.length === 1 && same(past?.winnerId, action.playerId), 189],
      [poses.length === 1, 11],
      [action.auto, 26],
      [remaining >= 0 && remaining <= 1000, 27],
      [previous?.game?.consecutivePasses === 2, 141],
      [isDouble(tile) && recentValues.filter(isDouble).length === 7, 155],
      [poses.length === 16, 15],
      [poses.length === 10, 154],
      [counts.every(count => count === 1), 177],
      [selfCount === 1, 31],
      [theirCounts.every(count => count === 1), 176],
      [counts.every(count => count === 1 || count === 2), 40],
      [personal.auto, 166],
      [personal.passes >= 2, 163],
      [personal.passes && quick, 161],
      [personal.passes && isDouble(tile), 173],
      [personal.passes, 39],
      [exhausted, 150],
      [allValues.size === 7 && oldValues.size === 6, 151],
      [pair.every(value => value === 0) && !oldPair.every(value => value === 0), 145],
      [pair.every(value => value === 6) && !oldPair.every(value => value === 6), 146],
      [pair[0] === pair[1] && oldPair[0] !== oldPair[1], 142],
      [pair[0] !== pair[1] && oldPair[0] === oldPair[1], 143],
      [pair.includes(0) && !oldValues.has(0), 144],
      [quick && lastTile?.tileId === 'd_6_6', 167],
      [firstDouble && poses.length >= 10, 160],
      [tile.a === 0 && tile.b === 0, 13],
      [tile.a === 6 && tile.b === 6, 14],
      [priorTile && isDouble(tile) && isDouble(priorTile), 18],
      [isDouble(tile) && personal.double, 158],
      [isDouble(tile), 12],
      [priorTile && hasBlank(tile) && hasBlank(priorTile), 159],
      [lastSides.length === 5 && lastSides.every(side => side === action.side), 148],
      [lastSides.length === 5 && lastSides.slice(0, -1).every(side => side !== 'start' && side === lastSides[0] && side !== action.side), 157],
      [priorSide.length === 3 && priorSide.every(side => side !== 'start' && side === priorSide[0] && side !== action.side), 147],
      [lastSides.length >= 4 && lastSides.slice(-4).every((side, index, sides) => side !== 'start' && (index === 0 || side !== sides[index - 1])), 149],
      [personal.sides.length >= 2 && personal.sides.slice(-2).every(side => side === action.side), 175],
      [quick, 19],
      [oldPair[0] !== oldPair[1] && options === 1 && poses.length % 4 === 0, 156]
    ], action.side === 'left' ? 16 : 17);
  }

  return function observe(room, previous) {
    const game = room?.game;
    if (!game) return null;
    const nextRound = room.matchId + '/' + game.roundNumber;
    if (nextRound !== roundKey) {
      roundKey = nextRound;
      actionKey = '';
      hasPassed = false;
      byPlayer.clear();
    }
    const action = game.lastAction;
    const result = game.roundResult;
    if (!action && !result) return null;
    const nextAction = JSON.stringify([action, result?.type, result?.at]);
    if (nextAction === actionKey) return null;
    actionKey = nextAction;
    if (result) return resolvedRound(room);

    const playerId = action.playerId;
    const key = playerKey(playerId);
    const personal = byPlayer.get(key) ?? { passes: 0, auto: false, double: false, sides: [] };
    if (action.type === 'pass') {
      const id = choice([
        [action.auto, 26],
        [personal.passes, 162],
        [!hasPassed && game.board.placements.length >= 12, 168]
      ], 34);
      hasPassed = true;
      byPlayer.set(key, { ...personal, passes: personal.passes + 1, auto: Boolean(action.auto), double: false, sides: [] });
      return { id, playerId, priority: same(playerId, localId) ? 3 : 1 };
    }
    if (action.type !== 'play') return null;
    const id = readPlay(room, previous, action, personal);
    byPlayer.set(key, { passes: 0, auto: Boolean(action.auto), double: isDouble(parseTile(action.tileId)), sides: [...personal.sides.slice(-1), action.side] });
    return { id, playerId, priority: id === 141 || id === 27 ? 2 : 1 };
  };
}
