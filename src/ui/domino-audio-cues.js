import { soundEffectState } from './sound-player.js?v=20261005T162819119';

const cues = {
  start: 'opening.mp3',
  win: 'c-are-the-champion.mp3',
  welcome: 'bienvenue.mp3',
  nose: 'cochon-nez-effet.mp3'
};
const storageKey = 'domino-v58-cues-played';
const players = new Set();
const pending = new Map();
const played = new Set();

try {
  for (const key of JSON.parse(sessionStorage.getItem(storageKey) || '[]')) played.add(key);
} catch {}

function remember(key) {
  if (!key) return;
  played.add(key);
  if (played.size > 80) played.delete(played.values().next().value);
  try { sessionStorage.setItem(storageKey, JSON.stringify([...played])); } catch {}
}

function applyEffectVolume({ player, level }) {
  const { muted, volume } = soundEffectState();
  player.volume = volume * level;
  player.muted = muted;
}

async function attempt(cue) {
  const { player, key } = cue;
  if (cue.starting) return;
  cue.starting = true;
  applyEffectVolume(cue);
  try {
    await player.play();
    if (key) pending.delete(key);
    remember(key);
    return 'playing';
  } catch (error) {
    if (error.name === 'NotAllowedError' && key && performance.now() < cue.expires) return 'blocked';
    if (key) pending.delete(key);
    players.delete(cue);
    return error.name === 'NotAllowedError' ? 'blocked' : 'error';
  } finally {
    cue.starting = false;
  }
}

export function playDominoCue(kind, key = '') {
  if (key && (played.has(key) || pending.has(key))) return Promise.resolve('duplicate');
  const { muted, volume } = soundEffectState();
  if (muted || volume === 0) {
    remember(key);
    return Promise.resolve('muted');
  }
  const file = cues[kind];
  if (!file) return Promise.resolve('error');
  const player = new Audio(new URL(`../../assets/audio/v58/${file}`, import.meta.url).href);
  player.playsInline = true;
  const cue = { player, kind, key, expires: performance.now() + 20000, starting: false, level: 1, fading: false, frame: 0 };
  const release = () => {
    cancelAnimationFrame(cue.frame);
    players.delete(cue);
  };
  player.addEventListener('ended', release, { once: true });
  player.addEventListener('error', release, { once: true });
  players.add(cue);
  if (key) {
    pending.set(key, cue);
    setTimeout(() => {
      if (pending.get(key) !== cue) return;
      pending.delete(key);
      if (!cue.starting) release();
    }, 20000);
  }
  return attempt(cue);
}

export function fadeDominoCue(kind, key = '') {
  for (const cue of players) {
    if (cue.kind !== kind || (key && cue.key !== key) || cue.fading) continue;
    cue.fading = true;
    const startedAt = performance.now();
    const fade = at => {
      if (!players.has(cue)) return;
      const progress = Math.min(1, Math.max(0, (at - startedAt) / 1400));
      cue.level = 1 - .76 * progress * progress * (3 - 2 * progress);
      applyEffectVolume(cue);
      if (progress < 1) cue.frame = requestAnimationFrame(fade);
    };
    cue.frame = requestAnimationFrame(fade);
  }
}

function resumeAfterGesture() {
  for (const cue of pending.values()) {
    if (performance.now() < cue.expires) void attempt(cue);
  }
}

document.addEventListener('click', resumeAfterGesture);
document.addEventListener('keydown', resumeAfterGesture);
for (const [id, event] of [['sound-volume', 'input'], ['sound-toggle', 'click']]) {
  document.getElementById(id)?.addEventListener(event, () => {
    queueMicrotask(() => players.forEach(applyEffectVolume));
  });
}
