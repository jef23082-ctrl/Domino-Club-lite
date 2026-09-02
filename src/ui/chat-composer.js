import { element as el, button } from './club-elements.js';
import { renderChatMessage } from './chat-renderer.js';
import { playSound } from './sound-player.js';

export function createChatComposer({ repository, channel, identity, canWrite, notify, title = 'Discussion générale' }) {
  const root=el('section','portal-card portal-chat'), messages=el('div','portal-chat-messages'), typing=el('p','portal-typing');
  messages.setAttribute('aria-live','polite'); typing.setAttribute('aria-live','polite');
  root.append(el('h2','',title),messages,typing);
  const form=el('form','portal-chat-form'), input=el('input','online-input');input.maxLength=300;input.placeholder=title==='Discussion générale'?'Écrire dans le salon général…':'Écrire dans la salle…';input.setAttribute('aria-label',title==='Discussion générale'?'Message général':'Message de la salle');
  const picker=el('div','portal-emojis');picker.hidden=true;
  for(const emoji of ['😊','😂','👏','🐷','👑','🔥','🤝','😎','👍','🎉','❤️','😮']) picker.append(button(emoji,()=>{input.value+=emoji;input.focus();picker.hidden=true;}));
  const emoji=button('😊',()=>{picker.hidden=!picker.hidden;});emoji.setAttribute('aria-label','Ajouter un emoji');
  const send=button('Envoyer');send.type='submit'; form.append(emoji,input,send);root.append(picker,form);
  const entries=new Map(); let lastTyping=0, disposed=false, clearTimer=null;const boundAt=Date.now();
  const render=()=>{messages.replaceChildren(...[...entries.values()].sort((a,b)=>Number(a.createdAt)-Number(b.createdAt)).map(renderChatMessage));messages.scrollTop=messages.scrollHeight;};
  const stop=repository.watch(channel,{added:m=>{entries.set(m.id,m);render();if(channel==='GENERAL' && Number(m.createdAt)>=boundAt && m.senderToken!==identity().clientToken)playSound('message');},changed:m=>{entries.set(m.id,m);render();},removed:id=>{entries.delete(id);render();},error:e=>notify(e.message,'error')});
  let typingEntries={};const renderTyping=()=>{typing.textContent=Object.entries(typingEntries).filter(([token,item])=>token!==identity().clientToken && Date.now()-Number(item.at)<4500).map(([,item])=>item.name).join(', ');if(typing.textContent)typing.textContent+=' écrit…';};
  const stopTyping=repository.watchTyping(channel,value=>{typingEntries=value;renderTyping();});const timer=setInterval(renderTyping,1000);
  input.addEventListener('input',()=>{clearTimeout(clearTimer);clearTimer=setTimeout(()=>{if(canWrite(false))repository.clearTyping(channel,identity().clientToken).catch(()=>{});},1800);if(Date.now()-lastTyping<1500 || !canWrite(false))return;lastTyping=Date.now();repository.markTyping(channel,identity()).catch(()=>{});});
  form.addEventListener('submit',async event=>{event.preventDefault();if(!input.value.trim()||send.disabled||!canWrite())return;send.disabled=true;const text=input.value;try{await repository.send(channel,{...identity(),text});if(!disposed&&input.value===text)input.value='';await repository.clearTyping(channel,identity().clientToken);}catch(e){notify(e.message,'error');}finally{send.disabled=false;}});
  return { root, dispose(){disposed=true;stop();stopTyping();clearInterval(timer);clearTimeout(clearTimer);if(canWrite(false))repository.clearTyping(channel,identity().clientToken).catch(()=>{});root.remove();} };
}
