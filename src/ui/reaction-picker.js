import { element as el, button } from './club-elements.js';

// Out-of-flow overlay: it never participates in the casino's layout.
export function reactionPicker({ mine, player, sender, actions, onSend, onClose }) {
  const menu=el('section','reaction-menu');menu.setAttribute('role','dialog');
  menu.setAttribute('aria-label',mine?'Exprimer une émotion':`Réagir à ${player.name}`);
  const header=el('header','reaction-menu__header'),close=button('×',onClose,'reaction-menu__close');
  close.setAttribute('aria-label','Fermer les réactions');
  header.append(el('strong','',mine?'Mon humeur':`Interagir avec ${player.name}`),close);
  const caption=el('p','reaction-menu__recipient',mine?`${sender.name} · Sur mon personnage`:`${sender.name} → ${player.name}`);
  const tabs=el('div','reaction-menu__tabs'),grid=el('div','reaction-menu__grid');
  tabs.setAttribute('aria-label','Catégories de réactions');
  const favorite=mine?['happy','cool','pray','catherine']:['sakamache','applause','enculax','catherine'];
  const greetings=['sakamache','applause','respect','boss','wow'];
  const groups=mine?[['favorites','Favoris'],['all','Toutes les émotions']]:[['favorites','Favoris'],['greetings','Salutations'],['teasing','Taquineries']];
  const buttons=new Map();
  function render(id){
    for(const[key,b]of buttons)b.setAttribute('aria-pressed',String(key===id));
    grid.replaceChildren();
    const entries=id==='favorites'?favorite.filter(key=>actions[key]).map(key=>[key,actions[key]]):Object.entries(actions);
    for(const[effect,meta]of entries){
      const visible=id==='all'||id==='favorites'&&favorite.includes(effect)||id==='greetings'&&greetings.includes(effect)||id==='teasing'&&!greetings.includes(effect);
      if(!visible)continue;
      const action=button('',()=>onSend(effect),'reaction-menu__action');
      action.title=meta.description||meta.label;action.append(el('span','reaction-menu__icon',meta.icon),el('span','',meta.label));grid.append(action);
    }
  }
  for(const[id,label]of groups){const b=button(label,()=>render(id));buttons.set(id,b);tabs.append(b);}
  menu.append(header,caption,tabs,grid);render('favorites');
  menu.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
    if(event.key==='Tab'){
      const items=[...menu.querySelectorAll('button:not(:disabled)')],first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  return menu;
}
