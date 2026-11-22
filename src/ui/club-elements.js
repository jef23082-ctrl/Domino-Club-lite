import { formatWinRate, winRate } from '../online/win-rate.js?v=58-r7';
import { displayName } from '../online/display-name.js?v=20261005T162819119';
import { knownCharacterIdForProfile } from '../online/profile-map.js?v=20261005T162819119';
import { PLAYER_ASSETS } from '../config/player-assets.js?v=20261005T162819119';
import { playerCutoutAsset, hasPlayerCutout } from '../config/player-assets.js?v=20261005T162819119';
import { PORTRAIT_BACKGROUNDS } from '../config/portrait-assets.js?v=20261005T162819119';
import { syncPlayerMedallion } from './player-medallion.js?v=20261005T162819119';
import { paginate } from './pagination.js?v=20261005T162819119';
import { createPremiumCrown, createPremiumPig } from './premium-symbols.js?v=20261005T162819119';
import { personalizedDominoPose } from '../config/domino-personalized.js?v=60';
export function element(tag, className = '', text) {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = displayName(text);
  return node;
}
export function button(text, action, type = '') {
  const node = element('button', `online-action ${type}`, text); node.type = 'button';
  if (action) node.addEventListener('click', action); return node;
}
export function card(title) { const node = element('section','portal-card'); node.append(element('h2','',title)); return node; }
export function avatar(profile, { portrait = true, domino = false } = {}) {
  const box = element('span','portal-avatar');
  const known = knownCharacterIdForProfile(profile);
  if (portrait && known) {
    const image = element('img', 'portal-character-portrait');
    const background=PORTRAIT_BACKGROUNDS[known];
    const personalized = domino ? personalizedDominoPose(known, 'top') : null;
    image.src = personalized || (background && hasPlayerCutout(known, 'top') ? playerCutoutAsset(known, 'top').src : PLAYER_ASSETS[known].seats.top);
    image.dataset.characterId=known;
    if(background){box.style.backgroundImage=`url("${background}")`;box.style.backgroundSize='cover';box.style.backgroundPosition='center';box.style.backgroundRepeat='no-repeat';}
    image.alt = displayName(profile.name); image.loading = 'lazy'; image.decoding = 'async';
    box.classList.add('has-character'); box.append(image);syncPlayerMedallion(image,known);return box;
  }
  const value = String(profile?.avatar || '❓');
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) { const image = element('img'); image.src=value; image.alt=displayName(profile.name || 'Avatar'); box.append(image); }
  else box.textContent=value.slice(0,30);
  return box;
}
export function select(label, options, selected, change) {
  const field = element('label','online-label',label), input = element('select','online-input');
  for (const [value,text] of options) { const option=element('option','',text); option.value=String(value); input.append(option); }
  input.value=String(selected); if(change) input.addEventListener('change',()=>change(input.value)); field.append(input); return {field,input};
}
export function rankingTable(rows, includeStreak = true, { selfId = null, playedLabel = 'Jouées', compact = false, onDetails = null } = {}) {
  const wrapper=element('div','portal-table-wrap'), table=element('table','portal-ranking');
  wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','Classement complet');
  const columns=compact?[['Rang',r=>r.rank],['Joueur',r=>r.name],[playedLabel,r=>r.totalGames],['Victoires',r=>r.vic],['Série',r=>r.currentStreak ?? '—']]:[['Pos',(_,i)=>i+1],['Joueur',r=>r.name],['% Vic',r=>winRate(r.vic,r.totalGames)],['Score',r=>r.score],['Vic',r=>r.vic],['Coch',r=>r.coch],...(includeStreak?[['Série',r=>r.currentStreak ?? '—']]:[]),['Sauvé',r=>r.saved],[playedLabel,r=>r.totalGames]];
  const head=element('thead'), tr=element('tr'), body=element('tbody'); let order=rows.map((r,i)=>({...r,rank:i+1})), direction=1;
  let current=0;const pager=element('nav','portal-pagination');pager.setAttribute('aria-label','Pages du classement');wrapper.dataset.total=String(rows.length);
  const render=()=>{body.replaceChildren();const result=paginate(order,current,compact?4:Math.max(1,order.length));current=result.page;for(const row of result.items){const line=element('tr');line.dataset.playerId=String(row.id??row.playerId);const mine=selfId!==null&&String(row.id??row.playerId)===String(selfId);line.classList.toggle('is-self',mine);columns.forEach(([label,get],index)=>{const cell=element('td'); if(index===1) {const name=onDetails?button(row.name,()=>onDetails(row),'portal-rank-name'):document.createTextNode(displayName(row.name));cell.append(avatar(row,{ domino:true }),name);if(row.rank===1)cell.append(createPremiumCrown('premium-crown--ranking'));else if(row.rank===rows.length&&rows.length>1)cell.append(createPremiumPig('premium-pig--ranking'));if(mine)cell.append(element('span','portal-you','Vous'));} else cell.textContent=index===0?row.rank:label==='% Vic'?formatWinRate(row.vic,row.totalGames):get(row)??0;line.append(cell);});body.append(line);}pager.replaceChildren();if(compact){const prev=button('‹',()=>{current--;render();}),next=button('›',()=>{current++;render();});prev.setAttribute('aria-label','Page précédente du classement');next.setAttribute('aria-label','Page suivante du classement');prev.disabled=current===0;next.disabled=current===result.pages-1;pager.append(prev,element('span','',`${result.start+1}–${result.start+result.items.length} sur ${result.total} joueurs`),next);}};
  for(const [index,[label,get]] of columns.entries()) {const th=element('th'); th.scope='col'; const sort=button(`${label} ↕`,()=>{direction*=-1;order.sort((a,b)=>{const av=index===0?a.rank:get(a),bv=index===0?b.rank:get(b);return direction*(typeof av==='string'?av.localeCompare(bv,'fr'):Number(av)-Number(bv));});render();});th.append(sort);tr.append(th);}
  head.append(tr); table.append(head,body);wrapper.append(table);if(compact){wrapper.classList.add('is-compact');wrapper.append(pager);}render(); return wrapper;
}
