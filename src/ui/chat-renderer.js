import { PLAYER_ASSETS } from '../config/player-assets.js';
import { knownCharacterIdForProfile } from '../online/profile-map.js';
import { displayName } from '../online/display-name.js';

export function renderChatMessage(message) {
  const article = document.createElement('article');
  article.className = 'chat-message';
  const avatar = document.createElement('span');
  avatar.className = 'chat-avatar';
  avatar.title = displayName(message.name || 'Joueur');
  avatar.setAttribute('aria-label', avatar.title);
  const character = PLAYER_ASSETS[knownCharacterIdForProfile(message)];
  if (character) {
    avatar.classList.add('chat-avatar--portrait');
    avatar.style.backgroundImage = `url("${character.seats.top}")`;
  } else avatar.textContent = String(message.name || '?').charAt(0).toUpperCase();
  const text = document.createElement('p');
  const sender=document.createElement('strong');sender.className='chat-sender';sender.textContent=displayName(message.name||'Joueur');
  const body=document.createElement('span');body.className='chat-text';body.textContent=message.text||'';
  text.append(sender,body);
  const time = document.createElement('time');
  const date = new Date(Number(message.createdAt || Date.now()));
  time.textContent = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  article.append(avatar, text, time);
  return article;
}
