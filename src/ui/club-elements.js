import { displayName } from '../online/display-name.js';
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
export function avatar(profile) {
  const box = element('span','portal-avatar');
  const value = String(profile?.avatar || '❓');
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) { const image = element('img'); image.src=value; image.alt=profile.name || 'Avatar'; box.append(image); }
  else box.textContent=value.slice(0,30);
  return box;
}
export function select(label, options, selected, change) {
  const field = element('label','online-label',label), input = element('select','online-input');
  for (const [value,text] of options) { const option=element('option','',text); option.value=String(value); input.append(option); }
  input.value=String(selected); if(change) input.addEventListener('change',()=>change(input.value)); field.append(input); return {field,input};
}
export function rankingTable(rows, includeStreak = true) {
  const wrapper=element('div','portal-table-wrap'), table=element('table','portal-ranking');
  const columns=[['Pos',(_,i)=>i+1],['Joueur',r=>r.name],['% Vic',r=>r.percent],['Score',r=>r.score],['Vic',r=>r.vic],['Coch',r=>r.coch],...(includeStreak?[['Série',r=>r.currentStreak]]:[]),['Sauvé',r=>r.saved],['Jouées',r=>r.totalGames]];
  const head=element('thead'), tr=element('tr'), body=element('tbody'); let order=rows.map((r,i)=>({...r,rank:i+1})), direction=1;
  const render=()=>{body.replaceChildren(); for(const row of order){const line=element('tr');columns.forEach(([label,get],index)=>{const cell=element('td'); if(index===1) cell.append(avatar(row),document.createTextNode(displayName(row.name))); else cell.textContent=index===0?row.rank: `${get(row) ?? 0}${label==='% Vic'?'%':''}`;line.append(cell);});body.append(line);}};
  for(const [index,[label,get]] of columns.entries()) {const th=element('th'); th.scope='col'; const sort=button(`${label} ↕`,()=>{direction*=-1;order.sort((a,b)=>{const av=index===0?a.rank:get(a),bv=index===0?b.rank:get(b);return direction*(typeof av==='string'?av.localeCompare(bv,'fr'):Number(av)-Number(bv));});render();});th.append(sort);tr.append(th);}
  head.append(tr); table.append(head,body);wrapper.append(table);render(); return wrapper;
}
