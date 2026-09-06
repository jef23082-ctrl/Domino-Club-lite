import {
  selectLoungeTrack,
  setLoungeMusicVolume,
  syncLoungeMusicControls,
  toggleLoungeMusic
} from './lounge-music.js?v=20260906T072753858';
import { setSoundEffectVolume, syncSoundControls, toggleSoundEffects } from './sound-player.js?v=20260906T072753858';

export async function requestAppFullscreen() {
  if (document.fullscreenElement) return true;
  const target = document.querySelector('#app') || document.documentElement;
  try { await target.requestFullscreen(); return true; }
  catch (_) { return false; }
}

export function bindAppShell() {
  const panel = document.querySelector('#chat-panel');
  const toggle = document.querySelector('#chat-toggle');
  const unreadBadge = document.querySelector('#chat-unread-badge');
  let unreadMessages = 0;
  const renderUnread = () => {
    if (!unreadBadge) return;
    unreadBadge.textContent = unreadMessages > 99 ? '99+' : String(unreadMessages);
    unreadBadge.hidden = unreadMessages === 0;
    unreadBadge.setAttribute('aria-label', `${unreadMessages} message${unreadMessages > 1 ? 's' : ''} non lu${unreadMessages > 1 ? 's' : ''}`);
  };
  panel.addEventListener('scene-chat-message', () => {
    if (!panel.classList.contains('is-collapsed')) return;
    unreadMessages += 1;
    renderUnread();
  });
  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    if (!collapsed) { unreadMessages = 0; renderUnread(); }
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Déplier la discussion' : 'Replier la discussion');
  });
  renderUnread();
  const button = document.querySelector('#fullscreen-button');
  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (!await requestAppFullscreen()) throw new Error('fullscreen-blocked');
    } catch (_) { button.title = 'Le navigateur ne permet pas le plein écran dans ce contexte.'; }
  });
  const music = document.querySelector('#music-button');
  const musicPanel = document.querySelector('#music-panel');
  const musicClose = document.querySelector('#music-close');
  const musicToggle = document.querySelector('#music-toggle');
  const musicTrack = document.querySelector('#music-track');
  const musicVolume = document.querySelector('#music-volume');
  const soundToggle = document.querySelector('#sound-toggle');
  const soundVolume = document.querySelector('#sound-volume');
  const closeMusicPanel = () => {
    if (!musicPanel || !music) return;
    musicPanel.hidden = true;
    music.setAttribute('aria-expanded', 'false');
  };
  music?.addEventListener('click', () => {
    const open = Boolean(musicPanel?.hidden);
    if (musicPanel) musicPanel.hidden = !open;
    music.setAttribute('aria-expanded', String(open));
    if (open) { syncLoungeMusicControls(); syncSoundControls(); }
  });
  musicClose?.addEventListener('click', closeMusicPanel);
  musicToggle?.addEventListener('click', () => toggleLoungeMusic());
  musicTrack?.addEventListener('change', event => selectLoungeTrack(event.currentTarget.value));
  musicVolume?.addEventListener('input', event => setLoungeMusicVolume(Number(event.currentTarget.value) / 100));
  soundToggle?.addEventListener('click', () => toggleSoundEffects());
  soundVolume?.addEventListener('input', event => setSoundEffectVolume(Number(event.currentTarget.value) / 100));
  musicPanel?.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeMusicPanel(); music?.focus(); }
  });
  syncLoungeMusicControls();
  syncSoundControls();
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Quitter le plein écran' : 'Afficher en plein écran');
  });
}
