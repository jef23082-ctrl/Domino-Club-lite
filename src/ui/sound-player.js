import { duckLoungeMusic } from './lounge-music.js?v=20260906T072753858';

const MUTE_STORAGE_KEY = 'domino-club-sfx-muted';
const VOLUME_STORAGE_KEY = 'domino-club-sfx-volume';
let audioContext = null;
let masterGain = null;
let muted = false;
let volume = .82;

try {
  muted = globalThis.localStorage?.getItem(MUTE_STORAGE_KEY) === 'true';
  const rawVolume = globalThis.localStorage?.getItem(VOLUME_STORAGE_KEY);
  const stored = Number(rawVolume);
  if (rawVolume !== null && rawVolume !== undefined && Number.isFinite(stored) && stored >= 0 && stored <= 1) volume = stored;
} catch (_) {}

function context() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    updateMasterGain();
  }
  return audioContext;
}

function updateMasterGain() {
  if (masterGain) masterGain.gain.value = muted ? 0 : volume;
}

function remember(key, value) {
  try { globalThis.localStorage?.setItem(key, String(value)); } catch (_) {}
}

function updateControls() {
  const range = globalThis.document?.querySelector('#sound-volume');
  if (range) range.value = String(Math.round(volume * 100));
  const output = globalThis.document?.querySelector('#sound-volume-value');
  if (output) output.textContent = `${Math.round(volume * 100)} %`;
  const toggle = globalThis.document?.querySelector('#sound-toggle');
  if (toggle) {
    toggle.textContent = muted ? 'Activer les effets' : 'Couper les effets';
    toggle.setAttribute('aria-pressed', String(!muted));
  }
}

export function unlockSound() {
  const current = context();
  if (current?.state === 'suspended') current.resume().catch(() => {});
}

function tone(current, frequency, delay, duration, volume = .055, type = 'sine', endFrequency = frequency) {
  const start = current.currentTime + delay;
  const oscillator = current.createOscillator();
  const gain = current.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(masterGain || current.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .025);
}

function impact(current, delay, duration, frequency, volume) {
  const start = current.currentTime + delay;
  const frames = Math.max(1, Math.floor(current.sampleRate * duration));
  const buffer = current.createBuffer(1, frames, current.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / samples.length, 3.4);
  }
  const source = current.createBufferSource();
  const filter = current.createBiquadFilter();
  const gain = current.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.setValueAtTime(.8, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  source.connect(filter).connect(gain).connect(masterGain || current.destination);
  source.start(start);
  source.stop(start + duration);
}

export function playSound(kind) {
  const current = context();
  if (!current || current.state !== 'running') return false;
  if (muted) return true;

  if (String(kind).startsWith('reaction-')) duckLoungeMusic(1050, .72);

  if (kind === 'placement') {
    impact(current, 0, .052, 1250, .27);
    impact(current, .055, .072, 760, .19);
  } else if (kind === 'message') {
    tone(current, 880, 0, .2, .045);
    tone(current, 1318.5, .09, .22, .04);
  } else if (kind === 'pass') {
    tone(current, 310, 0, .18, .05, 'triangle', 190);
    tone(current, 220, .13, .22, .04, 'triangle', 145);
  } else if (kind === 'victory') {
    [523.25, 659.25, 783.99].forEach((frequency, index) => tone(current, frequency, index * .11, .45, .06));
  } else if (kind === 'turn') {
    tone(current, 659.25, 0, .22, .04);
    tone(current, 783.99, .1, .3, .04);
  } else if (kind === 'pig') {
    tone(current, 238, .05, .34, .075, 'sawtooth', 126);
    tone(current, 205, .34, .3, .055, 'sawtooth', 118);
  } else if (String(kind).startsWith('reaction-')) {
    const effect = String(kind).slice(9);
    if (effect === 'clock') [0, .19, .38].forEach(delay => tone(current, 1150, delay, .055, .045, 'square'));
    else if (effect === 'pig') {
      impact(current, 0, .06, 720, .14);
      tone(current, 245, .04, .28, .07, 'sawtooth', 132);
      tone(current, 202, .3, .24, .052, 'sawtooth', 118);
    } else if (effect === 'applause') {
      [587.33, 698.46, 880].forEach((frequency, index) => tone(current, frequency, index * .09, .28, .038, 'sine'));
    } else if (effect === 'smallkeeper') {
      [0, .09, .18].forEach((delay, index) => impact(current, delay, .045, 1320 - index * 150, .12));
      tone(current, 330, .24, .34, .045, 'triangle', 247);
    } else if (effect === 'cool') {
      impact(current, 0, .08, 760, .17);
      tone(current, 174.61, .03, .42, .065, 'triangle', 130.81);
      tone(current, 523.25, .23, .25, .035, 'sine', 659.25);
    } else if (effect === 'catherine') {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone(current, frequency, index * .085, .19, .04, 'square');
        tone(current, frequency * 2, index * .085, .12, .012, 'triangle');
      });
    } else if (effect === 'working') {
      tone(current, 186, 0, .42, .045, 'sawtooth', 248);
      [0, .12, .24].forEach(delay => impact(current, delay, .035, 1020, .08));
    } else if (effect === 'return') {
      impact(current, 0, .05, 900, .09);
      [392, 523.25, 659.25].forEach((frequency, index) => tone(current, frequency, .08 + index * .1, .3, .035));
    }
    else if (effect === 'boss') [659.25, 783.99, 987.77].forEach((frequency, index) => tone(current, frequency, index * .08, .25, .045));
    else tone(current, 420, 0, .32, .05, 'triangle', 175);
  }
  return true;
}

export function setSoundEffectVolume(nextVolume) {
  volume = Math.min(1, Math.max(0, Number(nextVolume) || 0));
  remember(VOLUME_STORAGE_KEY, volume);
  updateMasterGain();
  updateControls();
  return volume;
}

export function toggleSoundEffects() {
  muted = !muted;
  remember(MUTE_STORAGE_KEY, muted);
  updateMasterGain();
  updateControls();
  return !muted;
}

export function syncSoundControls() { updateControls(); }
export function soundEffectState() { return { muted, volume }; }
