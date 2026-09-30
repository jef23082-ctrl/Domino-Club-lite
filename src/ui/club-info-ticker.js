import { announcementsForMode, announcementColor, DEFAULT_ANNOUNCEMENT_COLOR } from '../services/club-announcement-repository.js?v=20260930T205039435';

const frameUrl=new URL('../../assets/ui/club-info-blue-v45.png',import.meta.url).href;
const node=(tag,className='',text)=>{const n=document.createElement(tag);n.className=className;if(text!==undefined)n.textContent=text;return n;};
const control=(label,action,className='club-info-button')=>{const b=node('button',className,label);b.type='button';b.addEventListener('click',action);return b;};
const sectionName={all:'Tous',domino:'Domino',poker:'Poker'};
const durationOf=item=>Math.max(5,Math.min(60,Number(item?.scrollDuration)||18));

function plaque(preview=false) {
  const root=node('aside',`club-info-ticker${preview?' club-info-preview':''}`);
  if(!preview)root.setAttribute('aria-label','Infos du club');else root.setAttribute('aria-hidden','true');
  // Inline SVG preserves the approved crop. An external SVG used as an image
  // cannot load its nested PNG in browsers.
  const frame=document.createElementNS('http://www.w3.org/2000/svg','svg');
  frame.classList.add('club-info-frame');frame.setAttribute('viewBox','32 141 2110 414');
  frame.setAttribute('preserveAspectRatio','none');frame.setAttribute('aria-hidden','true');
  const image=document.createElementNS(frame.namespaceURI,'image');
  image.setAttribute('href',frameUrl);image.setAttribute('width','2172');image.setAttribute('height','724');frame.append(image);
  const lane=node('div','club-info-lane'),track=node('div','club-info-track');lane.setAttribute('aria-hidden','true');lane.append(track);
  root.append(frame,lane);return {root,lane,track,animation:null,fingerprint:null};
}

export function createClubInfoTicker({repository,identity}) {
  const view=plaque(),root=view.root;root.hidden=true;
  const openButton=control('',openManager,'club-info-open');openButton.setAttribute('aria-label','Gérer les infos du club');
  const previous=control('',()=>advance(-1,true),'club-info-arrow club-info-previous');
  const next=control('',()=>advance(1,true),'club-info-arrow club-info-next');
  previous.setAttribute('aria-label','Message précédent');next.setAttribute('aria-label','Message suivant');
  const currentCopy=node('span','sr-only'),status=node('span','sr-only');status.setAttribute('aria-live','polite');root.append(openButton,previous,next,currentCopy,status);
  let all=[],items=[],selectedId=null,pendingSelectionId=null,mode='domino',visible=false,stopWatch=null,manager=null,disposed=false;
  let timer=null,remaining=0,deadline=0,frame=null;
  const selectedByMode=new Map(),pauses=new Set(),views=new Set([view]);
  const selected=()=>items.find(item=>item.id===selectedId)||null;
  function stopAnimation(target){target.animation?.cancel();target.animation=null;target.fingerprint=null;}
  function measure(target,item) {
    const width=target.root.getBoundingClientRect().width;if(width<=0||target.root.hidden)return;
    const text=item?.text||'Cliquez ici pour écrire un message',color=announcementColor(item?.textColor),duration=durationOf(item);
    const fingerprint=JSON.stringify([item?.id,text,color,duration,width]);if(fingerprint===target.fingerprint)return;
    stopAnimation(target);target.fingerprint=fingerprint;
    const copy=node('span','club-info-original',text);copy.style.color=color;target.track.replaceChildren(copy);target.track.style.transform='translateX(0)';
    target.root.dataset.duration=String(duration);target.root.dataset.messageId=item?.id||'';
    // Club messages must scroll from the first display, including when the OS
    // requests reduced decorative motion. CSS still reduces hover transitions.
    const gap=Math.max(42,target.lane.clientWidth-copy.getBoundingClientRect().width+42),distance=copy.getBoundingClientRect().width+gap;
    copy.style.paddingRight=`${gap}px`;for(let i=0;i<2;i++)target.track.append(copy.cloneNode(true));
    target.animation=target.track.animate([{transform:'translateX(0px)'},{transform:`translateX(-${distance}px)`}],{duration:duration*1000,iterations:Infinity,easing:'linear'});
    if(document.hidden||(!visible&&target===view))target.animation.pause();
  }
  function scheduleMeasure(){if(frame||disposed||!visible)return;frame=requestAnimationFrame(()=>{frame=null;measure(view,selected());});}
  function clearTimer(){if(timer!==null){remaining=Math.max(0,deadline-performance.now());clearTimeout(timer);timer=null;}}
  function resume(){if(disposed||!visible||pauses.size||items.length<2||timer!==null)return;deadline=performance.now()+remaining;timer=setTimeout(()=>{timer=null;advance(1);},remaining);}
  function resetTimer(){clearTimer();remaining=(durationOf(selected())+1.5)*1000;resume();}
  function pause(reason,on){if(on){clearTimer();pauses.add(reason);}else pauses.delete(reason);resume();}
  function render(manual=false,reset=true) {
    const item=selected();root.dataset.messageId=item?.id||'';currentCopy.textContent=item?.text||'Aucun message. Cliquez sur la plaque pour en créer un.';previous.disabled=next.disabled=items.length<2;
    if(manual)status.textContent=item?`Message ${items.findIndex(a=>a.id===selectedId)+1} sur ${items.length} : ${item.text}`:'';
    scheduleMeasure();if(reset)resetTimer();
  }
  function choose(id,manual=false){selectedId=id;selectedByMode.set(mode,id);render(manual);}
  function advance(direction,manual=false){if(!items.length)return;const i=items.findIndex(item=>item.id===selectedId);choose(items[(i+direction+items.length)%items.length].id,manual);}
  function filter() {
    const oldCount=items.length,before=JSON.stringify(selected());items=announcementsForMode(all,mode);
    if(pendingSelectionId&&items.some(item=>item.id===pendingSelectionId)){selectedId=pendingSelectionId;pendingSelectionId=null;}
    if(!items.some(item=>item.id===selectedId))selectedId=items[0]?.id??null;selectedByMode.set(mode,selectedId);
    // Unrelated Firebase updates must not rewind the marquee or its timer.
    render(false,before!==JSON.stringify(selected())||oldCount!==items.length);
  }
  function watch(){if(stopWatch)return;stopWatch=repository.watch(value=>{all=value;filter();manager?.refreshList();},error=>{status.textContent=`Infos du club indisponibles : ${error.message}`;manager?.error(error.message);});}
  function visibility(){pause('document',document.hidden);for(const target of views){if(document.hidden||(!visible&&target===view))target.animation?.pause();else target.animation?.play();}}
  // Hover pauses automatic message switching only. Text continues moving;
  // focus after saving can never freeze the approved marquee.
  root.addEventListener('pointerenter',()=>{if(matchMedia('(hover: hover)').matches)pause('hover',true);});root.addEventListener('pointerleave',()=>pause('hover',false));
  root.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();advance(event.key==='ArrowLeft'?-1:1,true);}});
  document.addEventListener('visibilitychange',visibility);
  const resize=new ResizeObserver(scheduleMeasure);resize.observe(root);

  function openManager() {
    if(!visible||identity()?.profile?.id==null||manager||disposed)return;pause('manager',true);
    const dialog=node('dialog','club-info-manager');dialog.setAttribute('aria-label','Gérer les infos du club');
    const header=node('header','club-info-manager-header'),close=control('×',()=>{if(!busy)dialog.close();},'club-info-close');close.setAttribute('aria-label','Fermer les infos du club');
    const heading=node('div');heading.append(node('small','','DOMINO & POKER CLUB'),node('h2','','Messages du club'));header.append(heading,close);
    const tools=node('div','club-info-tools'),add=control('Créer un message',()=>edit(null),'club-info-primary');tools.append(node('p','','Choisissez un message, sa couleur et sa durée de passage. Les modifications sont partagées avec les joueurs du club.'),add);
    const columns=node('div','club-info-manager-columns'),list=node('div','club-info-message-list'),form=node('form','club-info-form');list.setAttribute('aria-label','Messages du club');
    const editorHeading=node('h3'),preview=plaque(true);views.add(preview);
    const inputFor=(name,label,tag='input')=>{const field=node('label','club-info-field',label),input=node(tag);input.name=name;field.append(input);return {field,input};};
    const text=inputFor('text','Message défilant','textarea'),duration=inputFor('scrollDuration','Durée d’un passage (secondes)'),color=inputFor('textColor','Couleur du texte'),section=inputFor('section','Section','select'),order=inputFor('order','Ordre d’affichage'),active=inputFor('active','Message actif','select');
    text.input.required=true;text.input.maxLength=1200;text.input.rows=4;color.input.type='color';duration.input.type=order.input.type='number';duration.input.min=5;duration.input.max=60;duration.input.step=1;order.input.min=-10000;order.input.max=10000;order.input.step=1;duration.input.required=order.input.required=true;
    for(const [value,label]of Object.entries(sectionName)){const option=node('option','',label);option.value=value;section.input.append(option);}for(const [value,label]of [['true','Oui'],['false','Non']]){const option=node('option','',label);option.value=value;active.input.append(option);}
    const colorHex=node('input');colorHex.type='text';colorHex.setAttribute('aria-label','Code couleur');colorHex.pattern='#[0-9a-fA-F]{6}';colorHex.maxLength=7;colorHex.required=true;
    const colorControl=node('div','club-info-color-control');colorControl.append(color.input,colorHex);color.field.append(colorControl);
    const settings=node('div','club-info-settings');settings.append(duration.field,color.field);const palette=node('div','club-info-palette');
    for(const [label,value]of [['Blanc glacé','#dcf7ff'],['Cyan','#47dcff'],['Rouge vif','#ff3636'],['Or','#ffd36a'],['Vert','#71ff9c'],['Rose','#ffa7e5']]){const swatch=control('',()=>{color.input.value=colorHex.value=value;updatePreview();});swatch.setAttribute('aria-label',label);swatch.title=label;swatch.style.setProperty('--swatch',value);palette.append(swatch);}
    const advanced=node('details','club-info-advanced'),fields=node('div','club-info-form-grid');fields.append(section.field,order.field,active.field);advanced.append(node('summary','','Section, ordre et visibilité'),fields);
    const actions=node('div','club-info-form-actions'),save=node('button','club-info-primary','Enregistrer'),cancel=control('Annuler',()=>dialog.close());save.type='submit';actions.append(save,cancel);
    const feedback=node('p','club-info-feedback');feedback.setAttribute('role','status');form.append(editorHeading,text.field,settings,palette,advanced,node('p','club-info-preview-label','PRÉVISUALISATION EN DIRECT'),preview.root,actions);
    columns.append(list,form);const content=node('div','club-info-manager-content');content.append(header,tools,feedback,columns);dialog.append(content);root.parentElement.append(dialog);
    let editing=null,busy=false,pendingDelete=null,previewFrame=null;
    const values=()=>({title:editing?.title||text.input.value.trim().slice(0,140),text:text.input.value,textColor:color.input.value,section:section.input.value,scrollDuration:Number(duration.input.value),order:Number(order.input.value),active:active.input.value==='true'});
    function error(message){feedback.textContent=message;feedback.setAttribute('role','alert');}
    function updatePreview(){if(previewFrame)return;previewFrame=requestAnimationFrame(()=>{previewFrame=null;if(dialog.open)measure(preview,values());});}
    function edit(item) {
      if(busy)return;editing=item?{...item}:null;feedback.textContent='';feedback.setAttribute('role','status');editorHeading.textContent=item?'Modifier le message':'Nouveau message';
      const value=item||{text:'',textColor:DEFAULT_ANNOUNCEMENT_COLOR,section:'all',scrollDuration:18,order:Math.max(0,...all.map(a=>Number(a.order)||0))+1,active:true};
      text.input.value=value.text;color.input.value=colorHex.value=announcementColor(value.textColor);section.input.value=value.section;duration.input.value=value.scrollDuration;order.input.value=value.order;active.input.value=String(value.active);pendingDelete=null;updatePreview();refreshList();
    }
    async function perform(operation) {
      if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');feedback.textContent='Enregistrement…';feedback.setAttribute('role','status');dialog.querySelectorAll('button,input,textarea,select').forEach(b=>b.disabled=true);
      try{await operation();if(dialog.open)feedback.textContent='Modification enregistrée.';}catch(e){error(e.message||'Enregistrement impossible. Réessayez.');}finally{busy=false;dialog.removeAttribute('aria-busy');dialog.querySelectorAll('button,input,textarea,select').forEach(b=>b.disabled=false);if(dialog.open){if(editing&&!all.some(item=>item.id===editing.id))edit(null);refreshList();}}
    }
    function refreshList() {
      list.replaceChildren();if(!all.length)list.append(node('p','club-info-empty','Aucun message. Créez la première information du club.'));
      all.forEach((item,i)=>{
        const row=node('article','club-info-message-row');row.dataset.announcementId=item.id;row.classList.toggle('is-selected',item.id===editing?.id);const excerpt=node('p','club-info-message-excerpt',item.text);excerpt.style.color=announcementColor(item.textColor);
        row.append(excerpt,node('small','club-info-message-meta',`Message ${i+1} · ${sectionName[item.section]||'Tous'} · ${item.scrollDuration} s · ${item.active?'Actif':'Inactif'} · ${item.author?.name||item.author||'Joueur'}`));const controls=node('div','club-info-row-actions');
        const up=control('↑',()=>perform(()=>repository.move(item.id,-1))),down=control('↓',()=>perform(()=>repository.move(item.id,1)));up.setAttribute('aria-label',`Monter le message ${i+1}`);down.setAttribute('aria-label',`Descendre le message ${i+1}`);up.disabled=i===0||busy;down.disabled=i===all.length-1||busy;
        controls.append(control('Modifier',()=>edit(item)),control('Afficher',()=>{if(!items.some(a=>a.id===item.id)){error('Ce message est inactif ou réservé à l’autre mode.');return;}choose(item.id,true);edit(item);}),control(item.active?'Désactiver':'Activer',()=>perform(()=>repository.setActive(item.id,!item.active))),up,down,control('Supprimer',()=>{pendingDelete={...item};refreshList();},'club-info-button club-info-danger'));row.append(controls);
        if(pendingDelete?.id===item.id){const confirmation=node('div','club-info-confirm');confirmation.append(node('p','','Supprimer ce message pour tous les joueurs ?'),control('Confirmer',()=>perform(async()=>{await repository.remove(item.id,pendingDelete.updatedAt);pendingDelete=null;}), 'club-info-button club-info-danger'),control('Conserver',()=>{pendingDelete=null;refreshList();}));row.append(confirmation);}
        if(busy)row.querySelectorAll('button').forEach(b=>b.disabled=true);list.append(row);
      });
    }
    color.input.addEventListener('input',()=>{colorHex.value=color.input.value;});colorHex.addEventListener('input',()=>{if(/^#[0-9a-f]{6}$/i.test(colorHex.value))color.input.value=colorHex.value;updatePreview();});
    form.addEventListener('input',updatePreview);form.addEventListener('change',updatePreview);
    form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;perform(async()=>{
      const value=values();if(!value.text.trim())throw new Error('Écrivez un message avant de l’enregistrer.');let id=editing?.id;if(id)await repository.edit(id,value,editing.updatedAt);else id=await repository.create(value);
      // Close only after Firebase accepts the write; retain unsaved text on error.
      pendingSelectionId=id;filter();dialog.close();
    });});
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});const previewResize=new ResizeObserver(updatePreview);previewResize.observe(preview.root);
    dialog.addEventListener('close',()=>{previewResize.disconnect();if(previewFrame)cancelAnimationFrame(previewFrame);stopAnimation(preview);views.delete(preview);dialog.remove();manager=null;pauses.delete('hover');pause('manager',false);if(visible&&!disposed)openButton.focus();},{once:true});
    manager={dialog,refreshList,error};dialog.showModal();edit(selected());
  }
  return {root,setContext(context){
    if(disposed)return;const changedMode=mode!==context.mode,wasVisible=visible;mode=context.mode;visible=Boolean(context.visible);root.hidden=!visible;
    if(visible){watch();if(changedMode){selectedId=selectedByMode.get(mode)||null;filter();}else if(!wasVisible)render(false,false);scheduleMeasure();}else{manager?.dialog.close();pauses.delete('hover');view.animation?.pause();}pause('scene',!visible);visibility();
  },dispose(){disposed=true;visible=false;clearTimer();if(frame)cancelAnimationFrame(frame);stopWatch?.();manager?.dialog.close();for(const target of views)stopAnimation(target);resize.disconnect();document.removeEventListener('visibilitychange',visibility);root.remove();}};
}
