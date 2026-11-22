import { rankingRows } from '../online/club-presentation.js?v=20261005T162819119';

const parts = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY = 86400000;
const id = value => String(value);
const same = (a, b) => a != null && b != null && id(a) === id(b);
const all = value => Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean);
const isWinner = (match, player) => match.resultType === 'victory' && same(match.winnerId, player);
const isPig = (match, player) => all(match.cochonIds).some(value => same(value, player));
const won = (rows, player) => rows.filter(match => isWinner(match, player)).length;
const pigs = (rows, player) => rows.filter(match => isPig(match, player)).length;
const rate = (rows, player) => rows.length ? won(rows, player) / rows.length : 0;
const roster = match => all(match?.players).map(person => id(person.playerId)).sort();
const group = (rows, key) => {
  const groups = new Map();
  for (const row of rows) {
    const value = key(row);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.values()];
};
const day = at => parts.format(new Date(at));
const month = at => day(at).slice(0, 7);
const quarter = at => {
  const [year, month] = day(at).split('-').map(Number);
  return year * 4 + Math.floor((month - 1) / 3);
};
const week = at => {
  const utc = Date.parse(day(at) + 'T00:00:00Z');
  return Math.floor((utc + 3 * DAY) / (7 * DAY));
};
const streak = (rows, find) => {
  let count = 0;
  for (let i = rows.length - 1; i >= 0 && find(rows[i]); i--) count++;
  return count;
};
function bestStreak(rows, find) {
  let count = 0, best = 0;
  for (const row of rows) {
    count = find(row) ? count + 1 : 0;
    best = Math.max(count, best);
  }
  return best;
}
const turnsOf = round => all(round.turnLog);
const withTurns = (match, player) => all(match.rounds).length > 0
  && all(match.rounds).every(round => turnsOf(round).some(turn => same(turn.playerId, player)));
const playerTurns = (round, player) => turnsOf(round).filter(turn => same(turn.playerId, player));
const passCount = (round, player) => playerTurns(round, player).filter(turn => turn.kind === 'pass').length;
const means = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const knownMean = matches => matches.length && matches.every(Number.isFinite) ? means(matches) : NaN;
const recorded = (rows, target) => all(rows).find(match => same(match.matchId, target?.matchId));

function bestRanks(history) {
  const totals = new Map();
  const best = new Map();
  for (const match of history) {
    for (const person of all(match.players)) {
      const key = id(person.playerId);
      const row = totals.get(key) ?? { played: 0, wins: 0, pigs: 0, name: person.name ?? '' };
      row.played++;
      if (isWinner(match, key)) row.wins += all(match.cochonIds).length >= 2 ? 2 : 1;
      if (isPig(match, key)) row.pigs++;
      totals.set(key, row);
    }
    const rows = [...totals].filter(([, row]) => row.played >= 5).sort(([, a], [, b]) => b.wins / b.played - a.wins / a.played ||
      (b.wins - b.pigs) - (a.wins - a.pigs) || b.wins - a.wins || a.pigs - b.pigs || a.name.localeCompare(b.name, 'fr'));
    rows.forEach(([key], index) => best.set(key, Math.min(best.get(key) ?? Infinity, index + 1)));
  }
  return best;
}

/** Returns only announcements supported by committed online results. */
export function statisticalEvents(history, result) {
  const match = recorded(history, result);
  if (!match || !(Number(match.endedAt) > 0) || all(match.players).length !== 3) return [];
  const sorted = all(history).filter(row => Number(row.endedAt) > 0 &&
    (Number(row.endedAt) < Number(match.endedAt) || same(row.matchId, match.matchId)))
    .sort((a, b) => a.endedAt - b.endedAt);
  const before = sorted.filter(row => !same(row.matchId, match.matchId));
  const rankedBefore = rankingRows(before), ranked = rankingRows(sorted);
  const bestRank = bestRanks(before);
  const resultEvents = [];
  const at = Number(match.endedAt);
  for (const { playerId } of all(match.players)) {
    const player = id(playerId);
    const own = sorted.filter(row => roster(row).includes(player));
    const past = own.filter(row => !same(row.matchId, match.matchId));
    const row = ranked.find(row => same(row.playerId, player));
    const old = rankedBefore.find(row => same(row.playerId, player));
    const rank = ranked.indexOf(row) + 1, oldRank = rankedBefore.indexOf(old) + 1;
    const wins = won(own, player), oldWins = won(past, player);
    const wasWon = isWinner(match, player);
    const pigTotal = pigs(own, player), newPig = isPig(match, player);
    const oldRate = past.length ? old?.rate ?? 0 : 0;
    const quarterNow = own.filter(row => quarter(row.endedAt) === quarter(at));
    const priorQuarter = past.filter(row => quarter(row.endedAt) === quarter(at) - 1);
    const monthNow = own.filter(row => month(row.endedAt) === month(at));
    const periods = group(past, row => month(row.endedAt));
    const weeks = group(own, row => week(row.endedAt));
    const rounds = own.flatMap(row => all(row.rounds));
    const pastRounds = past.flatMap(row => all(row.rounds));
    const presentRounds = all(match.rounds);
    const currentDay = own.filter(row => day(row.endedAt) === day(at));
    const pastDays = group(past.filter(row => day(row.endedAt) !== day(at)), row => day(row.endedAt));
    const winsOfRounds = rows => rows.filter(round => same(round.winnerId, player)).length;
    const ownWin = row => isWinner(row, player);
    const currentTrio = roster(match).join('/');
    const pastTrio = past.filter(row => roster(row).join('/') === currentTrio);
    const rivals = all(match.players).filter(person => !same(person.playerId, player));
    const emit = (interaction, ok, { rival, other, values, priority = 2 } = {}) => {
      if (ok) resultEvents.push({ id: interaction, playerId, rival, other, values, priority });
    };
    const overtaken = rankedBefore.find((person, index) => index + 1 < oldRank &&
      ranked.findIndex(row => same(row.playerId, person.playerId)) + 1 > rank);
    const tied = ranked.find(person => !same(person.playerId, player) && person.played >= 5 &&
      person.rate === row?.rate && person.score === row?.score && person.won === row?.won && person.pigs === row?.pigs);
    const aheadWins = ranked.find(person => !same(person.playerId, player) && person.won < row?.won &&
      rankedBefore.find(prior => same(prior.playerId, person.playerId))?.won >= (old?.won ?? 0));
    const comeback = tied && rankedBefore.find(person => same(person.playerId, tied.playerId))?.rate > oldRate;

    emit(104, overtaken && rank < oldRank, { rival: overtaken?.name });
    emit(105, Boolean(tied) && wasWon && own.length >= 5, { rival: tied?.name });
    emit(106, rank === 4 && oldRank > 4);
    emit(108, rank <= 3 && oldRank > 3 && own.length >= 5, { priority: 3 });
    emit(109, rank === 1 && oldRank > 1 && own.length >= 5, { priority: 3 });
    emit(110, oldRank - rank >= 3);
    [49, 50, 99, 100, 199, 200].forEach((threshold, index) => {
      const credited = row?.won ?? 0;
      const reached = threshold % 50 === 0;
      emit(111 + index, wasWon && (old?.won ?? 0) < threshold && (reached ? credited >= threshold : credited === threshold),
        { priority: reached ? 3 : 2 });
    });
    [9, 10, 25, 50].forEach((threshold, index) => emit(117 + index, newPig && pigTotal === threshold));
    const longestWithoutPig = streak(own, entry => !isPig(entry, player));
    const recordWithoutPig = past.length >= 4 && longestWithoutPig >= 5 && longestWithoutPig > bestStreak(past, entry => !isPig(entry, player));
    const daysWon = winsOfRounds(currentDay.flatMap(row => all(row.rounds)));
    const bestDaysWon = Math.max(0, ...pastDays.map(rows => winsOfRounds(rows.flatMap(row => all(row.rounds)))));
    const dailyRecord = pastDays.length >= 2 && daysWon > bestDaysWon;
    let runningWins = 0;
    const previousBestRate = Math.max(0, ...past.map((row, index) => {
      runningWins += isWinner(row, player) ? all(row.cochonIds).length >= 2 ? 2 : 1 : 0;
      return index + 1 >= 10 ? runningWins / (index + 1) : 0;
    }));
    emit(121, dailyRecord || recordWithoutPig);
    emit(122, wasWon && past.length >= 10 && row?.rate > previousBestRate && row?.rate > oldRate);
    emit(123, own.length === 50, { priority: 3 });
    emit(124, own.length === 100, { priority: 3 });
    emit(125, wasWon && streak(rounds, round => same(round.winnerId, player)) === 5);
    emit(78, presentRounds.some(round=>same(round.winnerId,player)) &&
      pastRounds.length >= 6 && pastRounds.slice(-6).every(round=>!same(round.winnerId,player)));
    emit(126, streak(own, ownWin) === 3);
    emit(127, streak(own, row => !ownWin(row)) === 5);
    emit(128, Boolean(aheadWins) && wasWon, { rival: aheadWins?.name });
    const tiedPigs = newPig && ranked.find(person => !same(person.playerId, player) && person.pigs === pigTotal);
    emit(129, Boolean(tiedPigs), { rival: tiedPigs?.name });
    emit(130, newPig && pigTotal > Math.max(0, ...rankedBefore.map(row => row.pigs)) && rankedBefore.length >= 3);
    const bestSaves = Math.max(0, ...ranked.filter(person => !same(person.playerId, player)).map(row => row.saved));
    const clubWins = Math.max(0, ...ranked.filter(person => !same(person.playerId, player)).map(row => won(sorted, row.playerId)));
    emit(131, same(match.savedId, player) && bestSaves >= 3 && row?.saved === bestSaves - 1);
    emit(132, Boolean(comeback) && rank < oldRank, { rival: tied?.name });
    emit(133, oldRank >= (bestRank.get(player) ?? 0) + 3 && rank === bestRank.get(player) + 1);
    emit(134, old?.score < 0 && row?.score === 0);
    emit(135, old && old.score <= 0 && row?.score > 0);
    emit(136, rank < (bestRank.get(player) ?? 0) && own.length >= 6);
    emit(137, wasWon && clubWins >= 10 && wins === clubWins - 1);
    emit(138, quarterNow.length >= 25 && quarterNow.length % 25 === 0);
    emit(139, rank <= 5 && oldRank > 5 && own.length >= 5);
    emit(140, oldRank > 0 && oldRank <= 3 && rank > 3);

    const recent = own.slice(-20), earlier = past.slice(-39, -19);
    const recentWins = won(recent, player), earlierWins = won(earlier, player);
    const windowSize = 10;
    const shortNew = own.slice(-windowSize), shortOld = own.slice(-2 * windowSize, -windowSize);
    const lastWeek = weeks.at(-2) ?? [], thisWeek = weeks.at(-1) ?? [];
    const lastMonth = periods.filter(rows => month(rows[0].endedAt) < month(at)).at(-1) ?? [];
    const chances = rows => rows.filter(row => all(row.rounds).some(round => {
      const scores = round.scores || {};
      return Number(scores['p_' + player] ?? 0) === 0 && Object.values(scores).some(score => Number(score) === 2);
    }));
    const savedRatio = rows => rows.filter(row => same(row.savedId, player)).length / rows.length;
    const chancesNow = chances(recent), chancesBefore = chances(earlier);
    const averageHands = rows => knownMean(rows.flatMap(row => all(row.rounds)).map(round => Number(round.handPoints?.['p_' + player] ?? NaN)));
    emit(201, recent.length === 20 && earlier.length === 20 && recentWins > earlierWins, {
      values: { recent: recentWins, ancien: earlierWins, gain: (recentWins - earlierWins) + (recentWins - earlierWins === 1 ? ' victoire' : ' victoires') }
    });
    emit(202, thisWeek.length === 10 && lastWeek.length >= 10 && Math.round(rate(thisWeek, player) * 100) === Math.round(rate(lastWeek, player) * 100));
    emit(203, lastMonth.length >= 8 && monthNow.length < lastMonth.length && won(monthNow, player) > won(lastMonth, player));
    emit(204, own.length >= 20 && pigs(shortNew, player) < pigs(shortOld, player) && !newPig);
    emit(205, chancesBefore.length >= 3 && chancesNow.length >= 3 && same(match.savedId, player) && savedRatio(chancesNow) > savedRatio(chancesBefore));
    emit(206, own.length >= 30 && wasWon && rate(shortNew, player) === rate(own.slice(-30, -20), player) && rate(shortNew, player) > rate(shortOld, player));
    emit(207, weeks.length >= 4 && weeks.slice(-4).every((rows, index, all) => won(rows, player) > 0 &&
      (!index || week(rows[0].endedAt) === week(all[index - 1][0].endedAt) + 1)) && won(thisWeek, player) === 1 && wasWon);
    const todayRounds = currentDay.flatMap(row => all(row.rounds));
    emit(208, todayRounds.length >= 7 && winsOfRounds(todayRounds) * 2 > todayRounds.length);
    emit(209, own.length >= 20 && averageHands(shortNew) < averageHands(shortOld));
    const monthRoundsWon = monthNow.flatMap(row => all(row.rounds)).filter(round => same(round.winnerId, player));
    emit(210, wasWon && ['empty','blocked'].every(cause => monthRoundsWon.filter(round => round.cause === cause).length >= 2));

    const firstRival = rivals[0], secondRival = rivals[1];
    const sameTrioOptions = { rival: firstRival?.name, other: secondRival?.name };
    const beatingRival = rivals.find(person => pastTrio.length >= 3 && streak(pastTrio, row => isWinner(row, person.playerId)) >= 3);
    emit(211, wasWon && pastTrio.some(row => quarter(row.endedAt) === quarter(at)) && !pastTrio.some(row => quarter(row.endedAt) === quarter(at) && ownWin(row)), sameTrioOptions);
    emit(212, wasWon && ownWin(pastTrio.at(-1) ?? {}), sameTrioOptions);
    emit(213, wasWon && Boolean(beatingRival), { rival: beatingRival?.name, priority: 3 });
    for (const rival of rivals) {
      const shared = own.filter(row => roster(row).includes(id(rival.playerId))).slice(-10);
      emit(214, shared.length === 10 && won(shared, player) === won(shared, rival.playerId) && won(shared, player) > 0, { rival: rival.name });
    }
    const seenRivals = rows => new Set(rows.flatMap(roster).filter(value => value !== player));
    emit(215, wasWon && seenRivals(monthNow.filter(ownWin)).size >= 5 &&
      seenRivals(monthNow.filter(row => !same(row.matchId, match.matchId) && ownWin(row))).size < 5);
    const opponentCounts = new Map();
    for (const row of quarterNow) for (const person of all(row.players)) {
      if (!same(person.playerId, player)) opponentCounts.set(person.name, (opponentCounts.get(person.name) || 0) + 1);
    }
    const common = [...opponentCounts].sort((a,b) => b[1] - a[1]);
    emit(216, common.length > 1 && common[0][1] >= 6 && common[0][1] > common[1][1], { rival: common[0]?.[0] });
    emit(217, pastTrio.length === 9, sameTrioOptions);
    emit(198, same(match.players[0]?.playerId,player) && !pastTrio.some(row=>day(row.endedAt)===day(at)));
    emit(218, pastTrio.length > 0 && at - pastTrio.at(-1).endedAt >= 30 * DAY, sameTrioOptions);
    const leader = rankedBefore[0];
    emit(219, wasWon && leader?.played >= 5 && rivals.some(person => same(person.playerId, leader.playerId)) &&
      !quarterNow.some(row => !same(row.matchId, match.matchId) && ownWin(row) && roster(row).includes(id(leader.playerId))));
    emit(220, wasWon && pastTrio.length && !ownWin(pastTrio.at(-1)));

    const knownRounds = rows => rows.filter(round => playerTurns(round, player).length);
    const lastTen = knownRounds(rounds).slice(-10), knownPast = knownRounds(pastRounds);
    const newPassMean = means(lastTen.map(round => passCount(round, player)));
    let bestPass = Infinity;
    for(let i = 10; i <= knownPast.length; i++) bestPass = Math.min(bestPass, means(knownPast.slice(i-10,i).map(round=>passCount(round,player))));
    const precise = rows => rows.filter(row => withTurns(row, player)).flatMap(row => all(row.rounds))
      .flatMap(round => playerTurns(round, player)).filter(turn => turn.kind === 'play' && !turn.automatic && typeof turn.remainingMs === 'number' && turn.remainingMs >= 0 && turn.remainingMs <= 1000).length;
    const noPass = round => playerTurns(round, player).length > 0 && !passCount(round, player);
    const fewPasses = streak(rounds, noPass);
    emit(221, recordWithoutPig, { priority: 3 });
    emit(222, withTurns(match, player) && knownPast.length >= 10 && lastTen.length === 10 && newPassMean < bestPass);
    emit(223, withTurns(match, player) && pastDays.filter(rows => rows.some(row => withTurns(row, player))).length >= 2 &&
      precise(currentDay) > Math.max(...pastDays.map(precise)));
    emit(224, withTurns(match, player) && fewPasses >= 4 && fewPasses > bestStreak(pastRounds, noPass));
    const perfect = item => isWinner(item, player) && withTurns(item, player) && all(item.rounds).length === 3 &&
      all(item.rounds).every(round => same(round.winnerId, player) && noPass(round));
    emit(225, perfect(match) && !past.some(perfect), { priority: 3 });
    emit(226, dailyRecord, { priority: 3 });
    function recordCause(cause) {
      const count = rows => rows.flatMap(row => all(row.rounds)).filter(round => same(round.winnerId, player) && round.cause === cause).length;
      return wasWon && lastMonth.length >= 5 && periods.length >= 2 && count(monthNow) > Math.max(...periods.filter(rows => month(rows[0].endedAt) !== month(at)).map(count));
    }
    emit(227, recordCause('empty'));
    emit(228, recordCause('blocked'));
    function recordFormat(key, value) {
      const recent = monthNow.filter(row => row[key] === value);
      const reference = group(past.filter(row => row[key] === value && month(row.endedAt) !== month(at)), row => month(row.endedAt))
        .filter(rows => rows.length >= 5);
      return wasWon && value !== undefined && recent.length >= 5 && reference.length && rate(recent, player) > Math.max(...reference.map(rows => rate(rows, player)));
    }
    emit(229, match.turnTimerSeconds === 10 && recordFormat('turnTimerSeconds', 10));
    emit(230, recordFormat('style', match.style));

    const wasFirstMonth = wasWon && won(monthNow, player) === 1;
    emit(231, wasWon && won(quarterNow, player) === 1);
    emit(232, wasFirstMonth && won(quarterNow, player) > 1);
    emit(233, quarterNow.length === 1 && priorQuarter.some(ownWin));
    const [year, ...md] = day(at).split('-');
    emit(234, wasWon && past.some(row => ownWin(row) && day(row.endedAt) === [Number(year)-1, ...md].join('-')));
    emit(235, wasWon && past.length && at - past.at(-1).endedAt >= 30 * DAY);
    const yearQuarters = new Set(own.filter(row => day(row.endedAt).startsWith(year + '-')).map(row => quarter(row.endedAt)));
    emit(236, yearQuarters.size === 4 && quarterNow.length === 1);
    const olderRanking = past.length && rankingRows(before.filter(row => !same(row.matchId, past.at(-1).matchId)));
    const olderRank = olderRanking ? olderRanking.findIndex(row => same(row.playerId, player)) + 1 : 0;
    emit(237, rank <= 3 && oldRank > 0 && oldRank <= 3 && olderRank > 3);
    const periodPositions = rows => rankingRows(rows).findIndex(row => same(row.playerId, player)) + 1;
    const nowPeriodRank = periodPositions(sorted.filter(row => quarter(row.endedAt) === quarter(at)));
    const pastPeriodRank = periodPositions(before.filter(row => quarter(row.endedAt) === quarter(at) - 1));
    emit(238, priorQuarter.length >= 5 && quarterNow.length >= 5 && quarterNow.length <= priorQuarter.length && nowPeriodRank < pastPeriodRank);
    function disparity(rows) {
      const samples = group(rows, row => roster(row).join('/')).filter(rows => rows.length >= 3).map(rows => rate(rows, player));
      return samples.length >= 2 ? Math.max(...samples) - Math.min(...samples) : NaN;
    }
    emit(239, own.length >= 40 && disparity(recent) < disparity(earlier));
    const pastPartnerCounts = periods.filter(rows => month(rows[0].endedAt) !== month(at)).map(rows => seenRivals(rows).size);
    emit(240, monthNow.length >= 4 && pastPartnerCounts.length >= 2 && seenRivals(monthNow).size > Math.max(...pastPartnerCounts) &&
      seenRivals(monthNow.slice(0,-1)).size <= Math.max(...pastPartnerCounts));
  }
  if (resultEvents.some(item => item.id === 130 || item.id === 136 || item.id === 226)) {
    const record = resultEvents.find(item => item.id === 130);
    if (record) resultEvents.push({ ...record, id: 98, priority: 3 });
  }
  return resultEvents;
}

export function rankingOpportunities(history, players) {
  if (all(players).length !== 3 || history.length < 12) return [];
  const before = rankingRows(history);
  return players.flatMap(player => {
    const position = before.findIndex(row => same(row.playerId, player.playerId));
    if (position < 0 || before[position].played < 5) return [];
    const next = rankingRows(history.concat({ resultType: 'victory', winnerId: player.playerId, players }));
    const newPosition = next.findIndex(row => same(row.playerId, player.playerId));
    const rivals = players.filter(person => !same(person.playerId, player.playerId));
    const vulnerable = rivals.find(person => {
      const old = before.findIndex(row => same(row.playerId, person.playerId));
      if (old <= position) return false;
      const outcome = rankingRows(history.concat({ resultType: 'victory', winnerId: person.playerId, players }));
      return outcome.findIndex(row => same(row.playerId, person.playerId)) < outcome.findIndex(row => same(row.playerId, player.playerId));
    });
    const events = [];
    if (newPosition < position) {
      if (position > 0 && newPosition === 0) events.push({ id: 103, playerId: player.playerId, priority: 2 });
      if (position >= 3 && newPosition < 3) events.push({ id: 102, playerId: player.playerId, priority: 2 });
      events.push({ id: 101, playerId: player.playerId, rival: before[position - 1]?.name, priority: 2 });
    }
    if (vulnerable) events.push({ id: 107, playerId: player.playerId, rival: vulnerable.name, priority: 2 });
    return events;
  });
}

export function roundStatisticalEvents(history, room) {
  const result = room?.game?.roundResult;
  const current = all(room?.roundLog);
  if (result?.type !== 'winner' || current.length === 0) return [];
  const at = Number(result.at);
  if (!(at > 0)) return [];
  const player = result.winnerId;
  const past = all(history).filter(row => !same(row.matchId,room.matchId) && Number(row.endedAt) < at && roster(row).includes(id(player)))
    .sort((a,b)=>a.endedAt-b.endedAt);
  const archived = past.flatMap(row=>all(row.rounds));
  const before = archived.concat(current.slice(0,-1));
  const allRounds = before.concat(current.at(-1));
  const own = round => same(round.winnerId,player);
  const noPass = round => playerTurns(round,player).length > 0 && !passCount(round,player);
  const today = past.filter(row=>day(row.endedAt)===day(at)).flatMap(row=>all(row.rounds)).concat(current);
  const roundsToday = today.filter(own).length;
  const straightNoPass = streak(allRounds,noPass);
  return [
    [125, streak(allRounds,own) === 5],
    [78, before.length >= 6 && before.slice(-6).every(round=>!own(round))],
    [208, today.length >= 7 && roundsToday * 2 > today.length && (roundsToday - 1) * 2 <= today.length - 1],
    [224, straightNoPass >= 4 && straightNoPass > bestStreak(before,noPass)]
  ].filter(([,ok])=>ok).map(([id])=>({id,playerId:player,priority:3}));
}
