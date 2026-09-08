import { element as el, button } from './club-elements.js?v=20260908T233254904';
import { createWorkBeacon } from './work-beacon.js?v=20260908T233254904';
import { createReactionVisual } from './reaction-visual.js?v=20260908T233254904';
import { displayName } from '../online/display-name.js?v=20260908T233254904';

// Out-of-flow overlay: it never participates in the casino's layout.
export function reactionPicker({ mine, player, sender, actions, working = false, onSend, onClose }) {
  const menu=el('section','reaction-menu');menu.setAttribute('role','dialog');
  menu.setAttribute('aria-label',mine?'Exprimer une émotion':`Réagir à ${displayName(player.name)}`);
  const header=el('header','reaction-menu__header'),close=button('×',onClose,'reaction-menu__close');
  close.setAttribute('aria-label','Fermer les réactions');
  header.append(el('strong','',mine?'Mon humeur':`Interagir avec ${player.name}`),close);
  const caption=el('p','reaction-menu__recipient',mine?`${sender.name} · Sur mon personnage`:`${sender.name} → ${player.name}`);
  const grid=el('div','reaction-menu__grid');grid.setAttribute('aria-label',mine?'Toutes mes interactions':'Toutes les interactions à envoyer');
  for(const[effect,meta]of Object.entries(actions)){
    const label=effect==='working'&&working?'Je suis revenu':meta.label;
    const action=button('',()=>onSend(effect),'reaction-menu__action');
    action.title=meta.description||label;
    const visual=el('span','reaction-menu__visual');
    visual.append(meta.visual==='beacon'?createWorkBeacon({compact:true,active:!working}):meta.visual==='premium'?createReactionVisual(effect,{compact:true}):el('span','reaction-menu__icon',meta.icon));
    action.append(visual,el('span','reaction-menu__label',label));grid.append(action);
  }
  menu.append(header,caption,grid);
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
