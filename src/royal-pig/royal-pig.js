import { createSpeaker } from './catalog.js?v=60';
import { createTableEvents } from './table-events.js?v=60';
import { progressSignals } from './scene-signals.js?v=60';
import { rankingOpportunities, roundStatisticalEvents, statisticalEvents } from './stat-signals.js?v=60';
import { parseTile, playerKey, hasPlayableTile } from '../game/engine.js?v=60';

const now = () => Date.now();
const same = (a,b) => a != null && b != null && String(a) === String(b);
const roundKey = room => room?.matchId ? room.matchId + '/' + room.game?.roundNumber : '';
const publicPlayers = room => Object.values(room?.players ?? {});
const quietLines = [3, 1, 5, 7, 8, 2, 4, 6, 95, 70, 61, 62, 63, 100];
const urgentClock = [22, 23, 24, 25, 66];
const plainMoves = new Set([16,17,19,10,21,2]);
const idleBlinkTimes = [4.20, 11.05, 18.60, 25.80];
const scenes = new Map([
  [72,'trinquer'], [83,'trinquer'], [70,'marcher'], [61,'marcher'], [62,'marcher'], [63,'marcher']
]);

export function createRoyalPig(stage, { isVisible, getLocalPlayer, getClock, getWorking, onNose, motionPreference, isHoliday }) {
  const figure = document.createElement('div');
  figure.className = 'royal-pig-v60';
  const idle = document.createElement('video');
  const gesture = document.createElement('video');
  const snout = document.createElement('button');
  snout.type = 'button';
  snout.setAttribute('aria-label', 'Toucher le groin du cochon');
  snout.className = 'royal-pig-v60__nose';
  for (const item of [idle,gesture]) {
    item.muted = true;
    item.playsInline = true;
    item.preload = 'metadata';
    item.setAttribute('aria-hidden','true');
  }
  idle.loop = true;
  idle.src = './assets/royal-pig-v60/royal-pig.webm';
  idle.poster = './assets/royal-pig-v60/royal-pig-still.webp';
  const bubble = document.createElement('p');
  bubble.className = 'royal-pig-v60__bubble';
  bubble.setAttribute('role','status');
  bubble.setAttribute('aria-live','polite');
  bubble.hidden = figure.hidden = true;
  figure.append(idle, gesture, snout);
  stage.append(figure,bubble);
  const portrait = matchMedia('(max-width: 600px) and (orientation: portrait)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function motionMode() {
    const preference = motionPreference();
    if (preference !== 'AUTO') return preference;
    return reducedMotion.matches ? 'REDUCED' : 'FULL';
  }

  function positionBubble() {
    const floating = portrait.matches && !document.fullscreenElement;
    const parent = floating ? document.body : stage;
    if (bubble.parentElement !== parent) parent.append(bubble);
    bubble.classList.toggle('royal-pig-v60__bubble--below', floating);
    if (floating) bubble.style.top = stage.getBoundingClientRect().bottom + 8 + 'px';
    else bubble.style.removeProperty('top');
  }

  let room, latestHistory = [], local;
  let detect = null, openSince = 0, visibleSince = 0, bubbleEnd = 0, lastSpoken = 0, privateDue = '', turnMark = '', ambient = 0, turnNumber = 0;
  let noseHits = [], loopMark = 0, guestRoster = '', pendingNewWelcome = false;
  let previousFinished;
  let waitingRoom;
  let waitingStyleChanged = false;
  let observedPresence = new Map();
  let nextGesture = '';
  const visitedHosts = new Set();
  const historySeen = new Set();
  const finished = new Map();
  const viewed = new Set();
  let queue = [];
  let poll;

  function stopGesture() {
    nextGesture = '';
    gesture.pause();
    figure.removeAttribute('data-gesture');
  }
  gesture.addEventListener('ended', () => {
    if (!nextGesture) { stopGesture(); return; }
    const next = nextGesture;
    nextGesture = '';
    startGesture(next);
  });
  gesture.addEventListener('error', stopGesture);
  function startGesture(clip) {
    gesture.src = './assets/royal-pig-v60/' + clip + '.webm';
    gesture.play().then(()=>{ if (!figure.hidden && motionMode() === 'FULL') figure.dataset.gesture = clip; }).catch(stopGesture);
  }
  function animate(id) {
    const clip = scenes.get(id);
    if (!clip || motionMode() !== 'FULL' || figure.hasAttribute('data-gesture')) return;
    if (clip === 'marcher') { nextGesture = clip; startGesture('lever'); }
    else startGesture(clip);
  }

  const speak = createSpeaker((text, entry, duration) => {
    bubble.textContent = text;
    bubble.dataset.interaction = String(entry.id);
    bubble.toggleAttribute('data-long', text.length > 65);
    positionBubble();
    bubble.hidden = false;
    bubbleEnd = now() + duration;
    lastSpoken = now();
    animate(entry.id);
  });

  function add(events, bucket, scope, boundary = '', ttl = 30000) {
    if (!events.length) return;
    const byId = new Set();
    for (const item of events) {
      const key = item.id + ':' + item.playerId;
      if (!item.playerId || byId.has(key) || queue.some(candidate=>candidate.bucket===bucket &&
        candidate.id===item.id && same(candidate.playerId,item.playerId))) continue;
      byId.add(key);
      queue.push({ ...item, bucket, scope, boundary, expires: now() + ttl });
    }
    if (queue.length > 100) queue = queue.slice(-100);
  }
  const scopeOf = value => publicPlayers(value).map(p=>String(p.playerId)).sort().join(',');

  function digest() {
    for (const [matchId, item] of finished) {
      if (now() - item.at > 12 * 60000) { finished.delete(matchId); continue; }
      if (!latestHistory.some(row=>same(row.matchId,matchId)) || historySeen.has(matchId)) continue;
      historySeen.add(matchId);
      finished.delete(matchId);
      if (historySeen.size > 100) historySeen.delete(historySeen.values().next().value);
      add(statisticalEvents(latestHistory,{ matchId }).map(entry=>({...entry,priority:entry.priority+1})),
        'statistics:' + matchId, item.scope, item.round, 12 * 60000);
    }
  }

  function history(rows) {
    if (!Array.isArray(rows)) return;
    latestHistory = rows.filter(row => row.matchId && Number(row.endedAt) > 0 &&
      publicPlayers(row).length === 3 && publicPlayers(row).every(player=>player?.playerId!=null))
      .map(row=>({...row,players:publicPlayers(row),cochonIds:Object.values(row.cochonIds || {})}));
    digest();
  }

  function roundStarts(current, previous) {
    const key = roundKey(current);
    const player = current.game.currentTurnId ?? local;
    const scope = scopeOf(current);
    openSince = now();
    privateDue = '';
    turnMark = '';
    if (previous?.matchId === current.matchId) return;
    add(rankingOpportunities(latestHistory, publicPlayers(current)), 'ranking:' + current.matchId, scope, '', 26000);
    if (pendingNewWelcome) {
      add([{id:91,playerId:local,priority:2},{id:191,playerId:local,priority:2},
        ...(isHoliday(current.style) ? [{ id:97, playerId:local,priority:1 }] : [])], 'welcome:' + key, scope);
      pendingNewWelcome = false;
    }
    const host = current.hostPlayerId;
    if (host != null && !same(host, local) && !visitedHosts.has(String(host))) {
      visitedHosts.add(String(host));
      add([{ id:199,playerId:local,priority:1 }], 'new-host:' + key, scope);
    }
    if (waitingStyleChanged && waitingRoom?.code === current.code) {
      add([{ id:194,playerId:player,priority:2 }], 'decor:' + key, scope);
    }
    waitingRoom = null;
    waitingStyleChanged = false;
  }

  function sessionSignals(current, before) {
    const game = current.game;
    const result = game.matchResult;
    if (!result || before?.game?.matchResult?.at === result.at) return [];
    const scope = scopeOf(current);
    const recent = latestHistory.filter(match=>scopeOf(match)===scope).slice(0,5);
    const oldChampion = recent[0]?.winnerId;
    const choices = [];
    if (result.winnerId) {
      if (oldChampion && !same(oldChampion,result.winnerId)) choices.push({id:87,playerId:result.winnerId,priority:3});
      if (same(recent[0]?.winnerId,result.winnerId) && now()-Number(recent[0].endedAt) < 10 * 3600000) choices.push({id:88,playerId:result.winnerId,priority:3});
      for (const playerId of result.cochonIds ?? []) {
        if (recent[0]?.cochonIds?.some(id=>same(id,playerId))) choices.push({id:47,playerId,priority:2});
      }
    }
    previousFinished = { ...result, scope, matchId:current.matchId };
    if (result.savedId && recent.length && recent[0]?.winnerId && same(recent[0].winnerId,before?.game?.currentTurnId)) {
      choices.push({ id:45, playerId:result.savedId, priority:2 });
    }
    return choices;
  }

  function sync(next) {
    if (!next?.game) return;
    const previous = room;
    const currentLocal = getLocalPlayer();
    if (!detect || local !== currentLocal) {
      local = currentLocal;
      detect = createTableEvents({playerKey,parseTile,localId:local});
    }
    room = next;
    const scope = scopeOf(next);
    const key = roundKey(next);
    const members = publicPlayers(next);
    if (guestRoster !== scope) {
      if (guestRoster) for(const member of members.filter(person=>!guestRoster.split(',').includes(String(person.playerId)))) hello(member.playerId);
      guestRoster = scope;
    }
    if (key !== roundKey(previous)) roundStarts(next,previous);
    const candidate = detect(next,previous);
    const other = progressSignals(next,previous,local);
    const { game } = next;
    const currentResult = game.roundResult;
    const freshResult = currentResult && currentResult.at !== previous?.game?.roundResult?.at &&
      getClock() - Number(currentResult.at) < 120000;
    if (game.roundStatus !== 'playing') bubble.hidden = true;
    if (freshResult) {
      const endings = [...other,...sessionSignals(next,previous),...(candidate?[candidate]:[])].filter(Boolean);
      const winner = currentResult.winnerId;
      if (winner && game.roundNumber === 1 && previousFinished?.scope === scope &&
        previousFinished.matchId !== next.matchId && previousFinished.winnerId != null && !same(previousFinished.winnerId,winner)) {
        endings.push({id:179,playerId:winner,priority:2});
      }
      if (winner) endings.push({id:67,playerId:winner,priority:2});
      add(endings.map(item=>({...item,priority:3})), 'result:' + key, scope, key, 10 * 60000);
      if (next.status === 'playing') add(roundStatisticalEvents(latestHistory,next), 'statistics:' + key, scope, key, 10 * 60000);
    } else if (game.roundStatus === 'playing') {
      const showCandidate = candidate && (!plainMoves.has(candidate.id) || Math.random() < .07);
      add([...other,...(showCandidate ? [candidate] : [])],
        'move:' + key + ':' + (game.lastAction?.at ?? game.turnClock?.revision ?? ''), scope, '', 5500);
    }
    if (game.turnClock?.paused && !previous?.game?.turnClock?.paused) signal(30,getWorking(),2);
    if (next.status === 'finished' && game.matchResult && freshResult && !historySeen.has(next.matchId)) {
      finished.set(next.matchId,{at:now(),scope,round:key});
      digest();
    }
    if (!poll) {
      poll = window.setInterval(tick, 450);
      tick();
    }
  }

  function hello(playerId) {
    const label = String(playerId);
    const id = viewed.has(label) ? 193 : 92;
    viewed.add(label);
    if (room) add([{ id, playerId, priority:2 }], 'arrival:' + label + ':' + now(), scopeOf(room));
  }

  function presence(rows) {
    if (!room) return;
    for (const member of publicPlayers(room)) {
      const key = String(member.playerId);
      const entry = Object.values(rows || {}).find(item=>same(item?.playerId,member.playerId) &&
        item.roomCode === room.code && item.role === 'player');
      const state = Boolean(entry);
      const previous = observedPresence.get(key);
      observedPresence.set(key,state);
      if (same(member.playerId,local)) continue;
      if (previous === false && state) hello(member.playerId);
      if (previous === true && !state && Object.values(rows || {}).some(item=>
        same(item?.playerId,member.playerId) && item.roomCode !== room.code)) signal(99,member.playerId,2);
    }
  }

  function waiting(value) {
    if (waitingRoom?.code === value.code && waitingRoom.style !== value.style) waitingStyleChanged = true;
    if (waitingRoom?.code !== value.code) waitingStyleChanged = false;
    waitingRoom = value;
  }

  function signal(id, playerId, priority = 2) {
    if (!room || !playerId) return;
    add([{id,playerId,priority}], 'signal:' + id + ':' + String(playerId), scopeOf(room));
  }

  function clock(nowAt, key) {
    const game = room.game;
    const id = game.currentTurnId;
    const value = game.turnClock;
    if (!value || value.paused) return;
    const marker = key + ':' + id + ':' + value.revision;
    if (turnMark !== marker) {
      turnMark = marker;
      privateDue = '';
      turnNumber++;
      if (same(id,local) && !hasPlayableTile(game,id)) signal(33,id,1);
      if (turnNumber % 6 === 0) signal(21,id,1);
    }
    const remaining = Math.ceil((value.deadlineAt - getClock())/1000);
    const mode = urgentClock[turnNumber % urgentClock.length];
    const seconds = {22:10,23:5,24:3,25:1,66:Math.ceil(value.durationMs/1000*.45)}[mode];
    if (remaining < 1 || remaining > seconds || privateDue === marker || nowAt - lastSpoken < 17000) return;
    privateDue = marker;
    add([{id:mode,playerId:id,priority:2}], 'clock:' + marker, scopeOf(room), '', 1600);
  }

  function tick() {
    const visible = isVisible() && !document.hidden;
    if (visible && figure.hidden) visibleSince = now();
    figure.hidden = !visible;
    if (!visible) { idle.pause(); stopGesture(); bubble.hidden = true; return; }
    const motion = motionMode();
    if (motion === 'OFF') idle.pause();
    else if (idle.paused) idle.play().catch(()=>{});
    if (motion !== 'FULL') stopGesture();
    const { game } = room || {};
    const at = now();
    const key = roundKey(room);
    const canSpeak = room?.status === 'playing' && game?.roundStatus === 'playing' &&
      !stage.querySelector('.online-result-card');
    if (!canSpeak) { bubble.hidden = true; stopGesture(); return; }
    if (at >= bubbleEnd) bubble.hidden = true;
    if (!bubble.hidden && (portrait.matches || bubble.parentElement !== stage)) positionBubble();
    if (!game.turnClock?.paused) clock(at,key);
    if (!game.turnClock?.paused && at - lastSpoken > 51000 && at - openSince > 3000 && !queue.some(item=>item.priority>=2 && item.expires>at)) {
      const id = quietLines[ambient++ % quietLines.length];
      const seat = {61:'left',62:'right',63:'top'}[id];
      const playerId = (seat && stage.querySelector('#seat-' + seat)?.dataset.playerId) || game.currentTurnId || local;
      signal(id,playerId,1);
    }
    const scope = scopeOf(room);
    queue = queue.filter(item=>item.expires > at);
    const timeSinceOpening = at - Math.max(openSince, visibleSince);
    const ready = item => item.scope===scope && item.boundary!==key;
    if (timeSinceOpening < 1000 && queue.some(item=>item.boundary && ready(item))) return;
    const choices = queue.filter(item=>ready(item) && (!item.boundary || timeSinceOpening <= 15000) &&
      (!game.turnClock?.paused || item.id===30));
    choices.sort((a,b)=>b.priority-a.priority ||
      Number(b.bucket.startsWith('statistics:'))-Number(a.bucket.startsWith('statistics:')) ||
      (a.id+turnNumber)%9-(b.id+turnNumber)%9);
    const members = publicPlayers(room);
    for (const item of choices) {
      if (!bubble.hidden && item.priority < 3) break;
      const target = members.find(member=>same(member.playerId,item.playerId));
      if (!target?.name) continue;
      const others = members.filter(member=>!same(member.playerId,item.playerId));
      if (speak(item.id,{name:target.name,rival:item.rival ?? others[0]?.name,other:item.other ?? others[1]?.name,values:item.values},item)) {
        queue = queue.filter(remaining=>remaining.bucket!==item.bucket);
        break;
      }
    }
  }

  snout.addEventListener('click',()=>{
    const at = now();
    noseHits = [...noseHits.filter(value=>at-value<5000),at];
    const player = publicPlayers(room).find(person=>same(person.playerId,local));
    if (!player || room.game?.roundStatus !== 'playing') return;
    if (at-lastSpoken<1500 && noseHits.length!==3) return;
    onNose?.();
    speak(noseHits.length>=3?94:93,{name:player.name},{preview:true});
  });

  idle.addEventListener('timeupdate',()=>{
    if (!room || figure.hidden || now() - loopMark < 90000) return;
    if (!idleBlinkTimes.some(at => Math.abs(idle.currentTime - at) <= 0.18)) return;
    loopMark = now();
    if (now() - lastSpoken > 30000) signal(1,room.game.currentTurnId,1);
  });

  function reset() {
    if (poll) { window.clearInterval(poll); poll = null; }
    idle.pause();
    stopGesture();
    figure.hidden = bubble.hidden = true;
    visibleSince = 0;
    room = null;
    detect = null;
    guestRoster = '';
    waitingRoom = null;
    waitingStyleChanged = false;
    observedPresence = new Map();
    pendingNewWelcome = true;
    queue = queue.filter(item=>item.boundary);
  }

  return { sync, history, signal, reset, presence, waiting };
}
