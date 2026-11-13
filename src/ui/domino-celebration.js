import { PLAYER_CUTOUT_ORDER } from '../config/player-assets.js?v=20261005T162819119';
import { DOMINO_FIREWORK_TIMES, runDominoCelebrationEffects } from './domino-celebration-effects.js?v=58-r7';
import * as sound from './sound-player.js?v=20261005T162819119';
import { aleksiPose } from '../config/domino-aleksi.js?v=58-r15';

const assets = new URL('../../assets/v58-celebrations/', import.meta.url);
const source = file => new URL(file, assets).href;
const pose = (characterId, seat, kind) => characterId === 'alexis'
  ? new URL(aleksiPose(seat, kind), document.baseURI).href
  : source(`poses/${characterId}-${seat}-${kind}.webp`);
const supported = characterId => PLAYER_CUTOUT_ORDER.includes(characterId);

export function createDominoCelebration(stage) {
  const create = (tag, name) => Object.assign(stage.ownerDocument.createElement(tag), { className: name });
  const image = (name, alt = '') => Object.assign(create('img', name), { alt, draggable: false });
  const lounge = image('domino-ceremony-lounge');
  const back = create('canvas', 'domino-ceremony-back');
  const front = create('canvas', 'domino-ceremony-front');
  const actors = create('div', 'domino-ceremony-actors');
  const award = create('section', 'domino-ceremony-award');
  const plaque = image('domino-ceremony-art');
  const medal = create('div', 'domino-ceremony-medal');
  const portrait = image('domino-ceremony-portrait');
  const name = create('strong', 'domino-ceremony-name');
  medal.append(portrait);
  award.append(plaque, medal, name);
  for (const layer of [lounge, back, actors, front]) layer.setAttribute('aria-hidden', 'true');
  stage.append(lounge, back, actors, award, front);
  const loaded = new Map();
  let currentKey = '', castKey = '', stopEffects, stopSound;

  function warm(url) {
    if (!loaded.has(url)) {
      const item = new Image();
      item.src = url;
      loaded.set(url, item);
    }
  }

  function prepare(players) {
    for (const file of ['round-plaque.webp', 'match-ribbon.webp', 'match-lounge.webp']) warm(source(file));
    for (const { characterId, seat } of players) {
      if (!supported(characterId)) continue;
      warm(pose(characterId, seat, 'applause'));
      warm(pose(characterId, seat, 'trophy'));
      warm(pose(characterId, 'top', 'applause'));
    }
  }

  function clear() {
    stopEffects?.();
    stopSound?.();
    stopEffects = stopSound = null;
    currentKey = '';
    castKey = '';
    delete stage.dataset.dominoCeremony;
  }

  function updateCast(players, winnerId) {
    if (!stage.dataset.dominoCeremony?.startsWith('match')) return;
    const next = JSON.stringify([players, winnerId]);
    if (next === castKey) return;
    castKey = next;
    const hasMatchScene = players.length === 3 && players.every(player => supported(player.characterId));
    stage.dataset.dominoCeremony = hasMatchScene ? 'match' : 'match-ribbon';
    if (!hasMatchScene) {
      actors.replaceChildren();
      return;
    }
    lounge.src = source('match-lounge.webp');
    actors.replaceChildren(...players.map(player => {
      const frame = create('div', `domino-ceremony-seat domino-ceremony-seat--${player.seat}`);
      const won = String(player.playerId) === String(winnerId);
      frame.classList.toggle('is-winner', won);
      const actor = image('domino-ceremony-pose');
      actor.src = pose(player.characterId, player.seat, won ? 'trophy' : 'applause');
      frame.append(actor);
      return frame;
    }));
  }

  function show({ kind, key, elapsed, players, winnerId, winnerName, audible }) {
    if (key === currentKey) return;
    clear();
    currentKey = key;
    const match = kind === 'match';
    const winner = players.find(player => String(player.playerId) === String(winnerId));
    stage.dataset.dominoCeremony = match ? 'match-ribbon' : 'round';
    plaque.src = source(match ? 'match-ribbon.webp' : 'round-plaque.webp');
    plaque.alt = match ? `${winnerName} gagne la partie` : 'Manche gagnée !';
    name.textContent = winnerName;
    if (!match && supported(winner?.characterId)) {
      portrait.hidden = false;
      portrait.src = pose(winner.characterId, 'top', 'applause');
    } else {
      portrait.hidden = true;
    }
    if (match) updateCast(players, winnerId);
    else actors.replaceChildren();
    stopEffects = runDominoCelebrationEffects(back, front, kind, elapsed);
    if (audible) {
      if (sound.playDominoCelebrationSound) stopSound = sound.playDominoCelebrationSound(kind, match ? elapsed : 0, DOMINO_FIREWORK_TIMES);
      else if (elapsed < 1000) sound.playSound('victory');
    }
  }

  return { prepare, show, clear, updateCast };
}
