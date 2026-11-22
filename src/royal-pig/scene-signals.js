import { playerKey, parseTile } from '../game/engine.js?v=60';

const same = (a, b) => a != null && b != null && String(a) === String(b);
const list = value => Array.isArray(value) ? value.filter(Boolean) : Object.values(value ?? {}).filter(Boolean);
const counts = (game, id) => game?.hands?.[playerKey(id)]?.length ?? 0;
const scores = (game, id) => Number(game?.roundWins?.[playerKey(id)] ?? 0);
const roundResults = room => list(room?.roundLog).filter(round => round.type === 'winner');
const roundKey = room => room?.matchId + '/' + room?.game?.roundNumber;
const playedAt = pose => Number(pose.playedAt || 0);
const tray = (room, id) => list(room?.game?.turnLog).filter(turn => same(turn.playerId,id));
const realTime = turn => typeof turn?.remainingMs === 'number' ? turn.remainingMs : Infinity;
const elapsed = (turn, duration) => Number.isFinite(realTime(turn)) ? duration - realTime(turn) : Infinity;
const event = (id, playerId, priority = 1) => ({ id, playerId, priority });

export function progressSignals(room, previous, localId) {
  const { game } = room;
  if (!game || !previous?.game) return [];
  if (roundKey(room) !== roundKey(previous)) return resetSignals(room, previous, localId);
  const earlier = previous.game;
  const { lastAction: action, roundResult: result } = game;
  const resultAdded = result && result.at !== earlier.roundResult?.at;
  if (resultAdded) return outcomeSignals(room, previous);
  if (Boolean(game.turnClock?.paused) !== Boolean(earlier.turnClock?.paused)) {
    return game.turnClock?.paused ? [] : [event(170, game.currentTurnId)];
  }
  if (!action || JSON.stringify(action) === JSON.stringify(earlier.lastAction)) return [];
  if (action.type !== 'play' || !action.playerId) return [];
  const mover = action.playerId;
  const facts = [];
  const add = (id, condition, priority = 1) => { if (condition) facts.push(event(id, mover, priority)); };
  const other = game.playerOrder.filter(id => !same(id, mover));
  const beforeCounts = game.playerOrder.map(id => counts(earlier,id));
  const afterCounts = game.playerOrder.map(id => counts(game,id));
  const rankNow = other.filter(id => counts(game,id) <= counts(game,mover)).length;
  const rankBefore = other.filter(id => counts(earlier,id) <= counts(earlier,mover)).length;
  const duration = Number(earlier.turnClock?.durationMs ?? 0);
  const myTurns = tray(room, mover);
  const last = myTurns.at(-1), past = myTurns.at(-2);
  const latestThree = myTurns.slice(-3);
  const lastThree = list(game.turnLog).slice(-3);
  const moves = list(game.board?.placements).sort((a,b) => playedAt(a)-playedAt(b));
  const tile = parseTile(action.tileId);
  add(10, counts(game,mover) === 2 && !action.auto);
  add(28, latestThree.length === 3 && latestThree.every(turn => turn.kind === 'play' && !turn.automatic && elapsed(turn,duration) < 3000), 2);
  add(29, latestThree.length === 3 && latestThree.every(turn => !turn.automatic && elapsed(turn,duration) >= duration * .66 && Number.isFinite(realTime(turn))), 2);
  add(37, Math.max(...afterCounts) - Math.min(...afterCounts) === 4 && Math.max(...beforeCounts) - Math.min(...beforeCounts) !== 4);
  add(38, rankBefore >= 1 && rankNow === 0 && counts(game,mover) <= 3, 2);
  add(69, counts(earlier,mover) >= 4 && counts(game,mover) === 3 && rankBefore >= 1 && rankNow === 0, 2);
  const previousMove = moves.slice(0,-1).findLast(pose => same(pose.playerId,mover));
  if (previousMove) {
    const edgeAt = before => ['left','right'].map(side => {
      const start = before[0];
      const pose = before.findLast(pose => pose.side === side) ?? start;
      return pose?.[side];
    });
    const oldEdges = edgeAt(moves.filter(pose => playedAt(pose) <= playedAt(previousMove)));
    const nowEdges = [earlier.board.leftEnd, earlier.board.rightEnd];
    add(152, oldEdges.every((value,index) => value !== nowEdges[index]));
  }
  const lanes = Number(game.board?.leftPort?.lane || 0) + Number(game.board?.rightPort?.lane || 0);
  const oldLanes = Number(earlier.board?.leftPort?.lane || 0) + Number(earlier.board?.rightPort?.lane || 0);
  add(153, lanes > 0 && oldLanes === 0);
  add(164, lastThree.length === 3 && new Set(lastThree.map(turn => String(turn.playerId))).size === 3 &&
    lastThree.every(turn => turn.kind === 'play' && !turn.automatic && elapsed(turn,duration) < 2500), 2);
  add(165, past && elapsed(past,duration) < 2000 && elapsed(last,duration) >= duration - 1000 && !action.auto && Number.isFinite(realTime(last)), 2);
  add(171, myTurns.length === 5 && myTurns.every(turn => turn.kind === 'play'));
  add(172, latestThree.length === 3 && new Set(latestThree.map(turn => turn.automatic ? 'auto' : turn.kind)).size === 3);
  add(174, myTurns.length >= 4 && myTurns.at(-4).automatic && latestThree.every(turn => !turn.automatic && turn.kind === 'play'));
  add(197, game.roundNumber > 1 && moves.length === 1 && earlier.roundNumber === game.roundNumber);
  add(9, tile.a === 0 && tile.b === 0 && counts(game,mover) <= 2);
  return facts;
}

function resetSignals(room, previous, localId) {
  const game = room.game;
  const player = game.currentTurnId ?? localId;
  const newMatch = previous.matchId !== room.matchId;
  const ids = game.playerOrder.map(String).sort().join();
  const sameTrio = previous.game.playerOrder?.map(String).sort().join() === ids;
  const members = game.playerOrder.map(id => ({ id, points: scores(game,id) }));
  const trailing = members.find(item => item.points === 0 && members.filter(person => person.points === 0).length === 1);
  const leader = members.find(item => item.points === 2);
  const choices = [];
  if (newMatch) {
    if (previous.status === 'finished' && sameTrio) choices.push(event(178, player, 2));
    if (previous.turnTimerSeconds !== room.turnTimerSeconds) choices.push(event(200, player));
    if (Number(previous.game.roundNumber) >= 3 && sameTrio) choices.push(event(196, player));
    return choices;
  }
  if (previous.game.roundResult?.type === 'annulled') choices.push(event(169, player, 2));
  if (previous.game.roundResult?.type === 'winner') choices.push(event(195, previous.game.roundResult.winnerId));
  if (leader) {
    choices.push(event(65, leader.id));
    if (trailing) choices.push(event(64, trailing.id, 2));
  }
  return choices;
}

function outcomeSignals(room, previous) {
  const { game } = room;
  const result = game.roundResult;
  const log = roundResults(room);
  const winner = result.winnerId ?? previous.game.currentTurnId;
  const players = game.playerOrder.filter(id => !same(id,winner));
  const ownWins = scores(game,winner);
  const older = previous.game;
  const priorWins = scores(older,winner);
  const losingRounds = log.slice(0,-1).filter(round => !same(round.winnerId,winner)).length;
  const facts = [];
  const add = (id, condition, player = winner, priority = 2) => { if (condition) facts.push(event(id,player,priority)); };
  if (result.type === 'annulled') {
    const points = result.handPoints || {};
    for (const id of game.playerOrder) add(42, Number(points[playerKey(id)]) === 5,id);
    return facts;
  }
  const ranks = game.playerOrder.map(id => scores(game,id)).sort((a,b)=>a-b);
  const leaderScore = ranks.at(-1);
  const loser = game.playerOrder.find(id => scores(game,id) === 0 && ranks.filter(score => score === 0).length === 1);
  const mostPoints = [...players].sort((a,b)=>Number(result.handPoints?.[playerKey(b)]||0)-Number(result.handPoints?.[playerKey(a)]||0))[0];
  const method = new Set(log.filter(round=>same(round.winnerId,winner)).map(round=>round.cause));
  const streak = log.slice(-2).every(item=>same(item.winnerId,winner)) && log.length >= 2;
  const bothEqual = ranks[1] === ranks[2] && ranks[0] < ranks[1];
  add(20, result.cause === 'empty' && players.some(id => scores(older,id) === 2 && counts(game,id) === 1));
  add(32, result.cause === 'empty');
  add(41, Boolean(loser) && ranks.join() === '0,1,1', loser);
  add(43, Boolean(loser) && ranks.join() !== '0,1,1' && room.status === 'playing', loser);
  add(44, priorWins === 0 && ownWins === 1 && players.some(id=>scores(older,id)>0) && room.status === 'playing');
  add(46, list(game.matchResult?.cochonIds).length, list(game.matchResult?.cochonIds)[0], 3);
  add(48, ranks.join() === '0,0,2', game.playerOrder.find(id=>scores(game,id)===0));
  add(49, ownWins === 2 && players.some(id=>scores(game,id)===2) &&
    log.slice(0,-1).some(round=>Number(round.scores?.[playerKey(winner)]??0)===0 &&
      players.some(id=>Number(round.scores?.[playerKey(id)]??0)===2)));
  add(50, Number(result.handPoints?.[playerKey(mostPoints)] ?? 0) >= 20, mostPoints);
  add(53, ownWins > priorWins && leaderScore - ownWins === 1 && leaderScore - priorWins >= 2);
  add(54, room.status === 'playing' && ownWins > Math.max(...players.map(id=>scores(older,id))) &&
    players.some(id=>scores(older,id)===priorWins && priorWins > 0));
  add(55, bothEqual && leaderScore < 2);
  add(56, Boolean(loser) && log.length === 3, loser);
  add(57, ownWins === 1 && losingRounds === 3);
  add(58, ownWins === 2 && players.every(id=>scores(game,id)===0));
  add(59, same(game.matchResult?.winnerId,winner) && log.some(round=>Math.max(...players.map(id=>Number(round.scores?.[playerKey(id)]??0))) -
    Number(round.scores?.[playerKey(winner)]??0) >= 2));
  add(60, ownWins === 2 && streak && players.some(id=>Number(log.at(-3)?.scores?.[playerKey(id)]??0)===2));
  add(68, Boolean(loser) && losingRounds >= 3, loser);
  add(72, result.cause==='empty' && ownWins>=2);
  add(73, result.cause==='blocked');
  add(74, result.cause==='empty' && result.handPoints?.[playerKey(mostPoints)] <= 5);
  add(75, result.cause==='empty' && game.board.placements.length===19);
  add(82, game.matchResult?.type==='victory',winner,3);
  add(83, game.matchResult?.type==='victory' && result.cause==='blocked',winner,3);
  add(84, game.matchResult?.type==='victory' && ranks.join()==='0,0,3');
  add(85, game.matchResult?.type==='victory' && game.matchResult?.cochonIds?.length===2,winner,3);
  add(89, game.matchResult?.type==='cancelled' && ranks.join()==='1,1,2');
  add(90, game.matchResult?.type==='victory' && ranks.join()==='0,2,3');
  add(96, bothEqual && leaderScore===2 && log.length>=4 && log.slice(-4).every((round,i,last)=>i===0 || !same(round.winnerId,last[i-1].winnerId)));
  add(181, room.status==='playing' && ranks.join()==='0,2,2',winner,3);
  add(185, method.has('empty') && method.has('blocked') && ownWins===2);
  add(186, game.matchResult?.type==='victory' && !same(log[0]?.winnerId,winner) && scores(game,log[0]?.winnerId)===1,log[0]?.winnerId);
  add(188, game.matchResult?.type==='victory' && streak && Number(log.at(-3)?.scores?.[playerKey(winner)])===1 && players.some(id=>Number(log.at(-3)?.scores?.[playerKey(id)])===1));
  return facts;
}
