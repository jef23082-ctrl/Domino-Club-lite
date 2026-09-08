const MUTE_STORAGE_KEY = 'domino-club-lounge-muted';
const VOLUME_STORAGE_KEY = 'domino-club-lounge-volume';
const TRACK_STORAGE_KEY = 'domino-club-lounge-track';

export const LOUNGE_TRACKS = Object.freeze([
  Object.freeze({ name: 'Musique 1', source: './assets/audio/musique1.mp3' }),
  Object.freeze({ name: 'Musique 2', source: './assets/audio/musique2.mp3' }),
  Object.freeze({ name: 'Musique 3', source: './assets/audio/musique3.mp3' })
]);

function storage() {
  try { return globalThis.localStorage; }
  catch (_) { return null; }
}

function readNumber(key, fallback, minimum, maximum, integer = false) {
  const raw = storage()?.getItem(key);
  if (raw === null || raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const bounded = Math.min(maximum, Math.max(minimum, value));
  return integer ? Math.round(bounded) : bounded;
}

function remember(key, value) {
  try { storage()?.setItem(key, String(value)); }
  catch (_) {}
}

let muted = storage()?.getItem(MUTE_STORAGE_KEY) === 'true';
let volume = readNumber(VOLUME_STORAGE_KEY, .82, 0, 1);
let selectedTrackIndex = readNumber(TRACK_STORAGE_KEY, 0, 0, LOUNGE_TRACKS.length - 1, true);
let sceneActive = false;
let hostCanChoose = false;
let synchronizedStartedAt = null;
let audio = null;
let duckFactor = 1;
let duckTimer = 0;

function appliedVolume() { return muted ? 0 : volume * duckFactor; }

function trackUrl(index = selectedTrackIndex) {
  return new URL(`../../assets/audio/musique${index + 1}.mp3`, import.meta.url).href;
}

function player() {
  if (!globalThis.Audio) return null;
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.addEventListener('loadedmetadata', correctPlaybackPosition);
  }
  return audio;
}

function targetTime() {
  if (!synchronizedStartedAt || !audio?.duration || !Number.isFinite(audio.duration)) return 0;
  return Math.max(0, (Date.now() - synchronizedStartedAt) / 1000) % audio.duration;
}

function correctPlaybackPosition(force = false) {
  if (!audio || !synchronizedStartedAt || !Number.isFinite(audio.duration)) return;
  const target = targetTime();
  const difference = Math.abs(audio.currentTime - target);
  const circularDrift = Math.min(difference, Math.abs(audio.duration - difference));
  if (force || circularDrift > .65) {
    try { audio.currentTime = target; }
    catch (_) {}
  }
}

function ensureSource(forcePosition = false) {
  const current = player();
  if (!current) return null;
  const source = trackUrl();
  if (current.src !== source) {
    current.src = source;
    current.load();
    forcePosition = true;
  }
  current.volume = appliedVolume();
  if (forcePosition) correctPlaybackPosition(true);
  return current;
}

function updateControls() {
  const documentRef = globalThis.document;
  if (!documentRef) return;
  const track = LOUNGE_TRACKS[selectedTrackIndex];
  const button = documentRef.querySelector('#music-button');
  if (button) {
    button.classList.toggle('is-muted', muted);
    button.title = `${track.name} · volume ${Math.round(volume * 100)} %`;
  }
  const toggle = documentRef.querySelector('#music-toggle');
  if (toggle) {
    toggle.textContent = muted ? 'Activer la musique' : 'Couper la musique';
    toggle.setAttribute('aria-pressed', String(!muted));
  }
  const select = documentRef.querySelector('#music-track');
  if (select) {
    select.value = String(selectedTrackIndex);
    select.disabled = !hostCanChoose;
  }
  const field = documentRef.querySelector('#music-track-field');
  if (field) field.hidden = !hostCanChoose;
  const range = documentRef.querySelector('#music-volume');
  if (range) range.value = String(Math.round(volume * 100));
  const output = documentRef.querySelector('#music-volume-value');
  if (output) output.textContent = `${Math.round(volume * 100)} %`;
}

export function primeLoungeMusic() {
  const current = ensureSource(true);
  if (!current || muted || !sceneActive) { updateControls(); return Boolean(current); }
  current.play().catch(() => {});
  return true;
}

export function startLoungeMusic() {
  sceneActive = true;
  const current = ensureSource(true);
  updateControls();
  if (!current || muted) return Boolean(current);
  current.play().catch(() => {});
  return true;
}

export function stopLoungeMusic() {
  sceneActive = false;
  audio?.pause();
  updateControls();
}

export function muteLoungeMusic() {
  muted = true;
  remember(MUTE_STORAGE_KEY, true);
  if (audio) {
    audio.volume = 0;
    audio.pause();
  }
  updateControls();
  return muted;
}

export function toggleLoungeMusic() {
  muted = !muted;
  remember(MUTE_STORAGE_KEY, muted);
  if (audio) audio.volume = appliedVolume();
  if (!muted && sceneActive) primeLoungeMusic();
  updateControls();
  return !muted;
}

export function selectLoungeTrack(index) {
  selectedTrackIndex = Math.min(LOUNGE_TRACKS.length - 1, Math.max(0, Math.round(Number(index) || 0)));
  remember(TRACK_STORAGE_KEY, selectedTrackIndex);
  ensureSource(true);
  if (sceneActive && !muted) audio?.play().catch(() => {});
  updateControls();
  return selectedTrackIndex;
}

export function synchronizeLoungeMusic(music = {}) {
  const index = Math.min(LOUNGE_TRACKS.length - 1, Math.max(0, Math.round(Number(music.trackIndex) || 0)));
  const startedAt = Number(music.startedAt) > 0 ? Number(music.startedAt) : null;
  const sourceChanged = index !== selectedTrackIndex;
  const timingChanged = startedAt !== synchronizedStartedAt;
  selectedTrackIndex = index;
  synchronizedStartedAt = startedAt;
  // Room snapshots arrive after every domino and presence update. Only seek
  // when the host actually changes the track or its shared start time.
  ensureSource(sourceChanged || timingChanged);
  if (sceneActive && !muted) audio?.play().catch(() => {});
  updateControls();
}

export function setLoungeTrackAuthority(canChoose) {
  hostCanChoose = Boolean(canChoose);
  updateControls();
}

export function setLoungeMusicVolume(nextVolume) {
  volume = Math.min(1, Math.max(0, Number(nextVolume) || 0));
  remember(VOLUME_STORAGE_KEY, volume);
  if (audio) audio.volume = appliedVolume();
  updateControls();
  return volume;
}

export function syncLoungeMusicControls() {
  updateControls();
}

export function duckLoungeMusic(duration = 900, factor = .78) {
  if (!audio || muted || !sceneActive) return;
  duckFactor = Math.min(1, Math.max(.25, Number(factor) || .78));
  audio.volume = appliedVolume();
  clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    duckFactor = 1;
    if (audio) audio.volume = appliedVolume();
  }, Math.max(250, Number(duration) || 900));
}

export function loungeMusicState() {
  return {
    muted,
    sceneActive,
    trackCount: LOUNGE_TRACKS.length,
    selectedTrackIndex,
    trackName: LOUNGE_TRACKS[selectedTrackIndex].name,
    volume,
    hostCanChoose,
    synchronizedStartedAt
  };
}
