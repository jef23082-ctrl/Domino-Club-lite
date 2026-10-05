import { PLAYER_ASSETS } from '../config/player-assets.js?v=20261005T162819119';
import { playerCutoutAsset, hasPlayerCutout } from '../config/player-assets.js?v=20261005T162819119';
import { PORTRAIT_BACKGROUNDS } from '../config/portrait-assets.js?v=20261005T162819119';
import { knownCharacterIdForProfile } from '../online/profile-map.js?v=20261005T162819119';
import { displayName } from '../online/display-name.js?v=20261005T162819119';

export function renderChatMessage(message) {
  const article = document.createElement('article');
  article.className = 'chat-message';
  const avatar = document.createElement('span');
  avatar.className = 'chat-avatar';
  avatar.title = displayName(message.name || 'Joueur');
  avatar.setAttribute('aria-label', avatar.title);
  const characterId=knownCharacterIdForProfile(message),character = PLAYER_ASSETS[characterId];
  if (character) {
    avatar.classList.add('chat-avatar--portrait');
    const background=PORTRAIT_BACKGROUNDS[characterId];
    avatar.style.backgroundImage = background&&hasPlayerCutout(characterId,'top')?`url("${playerCutoutAsset(characterId,'top').src}"),url("${background}")`:`url("${character.seats.top}")`;
    if(background){avatar.style.backgroundSize='1000% auto,cover';avatar.style.backgroundPosition='50% 0,center';}
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
