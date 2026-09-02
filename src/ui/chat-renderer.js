import { PLAYER_ASSETS } from '../config/player-assets.js';
import { normalizeProfileName } from '../online/profile-map.js';
import { displayName } from '../online/display-name.js';

export function renderChatMessage(message) {
  const article = document.createElement('article');
  article.className = 'chat-message';
  const avatar = document.createElement('span');
  avatar.className = 'chat-avatar';
  avatar.title = displayName(message.name || 'Joueur');
  avatar.setAttribute('aria-label', avatar.title);
  const character = Object.values(PLAYER_ASSETS).find(player => normalizeProfileName(displayName(player.displayName)) === normalizeProfileName(displayName(message.name)));
  if (character) {
    avatar.classList.add('chat-avatar--portrait');
    avatar.style.backgroundImage = `url("${character.seats.top}")`;
  } else avatar.textContent = String(message.name || '?').charAt(0).toUpperCase();
  const text = document.createElement('p');
  text.textContent = message.text || '';
  const time = document.createElement('time');
  const date = new Date(Number(message.createdAt || Date.now()));
  time.textContent = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  article.append(avatar, text, time);
  return article;
}
