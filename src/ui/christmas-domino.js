import {CHRISTMAS_THEME,CHRISTMAS_TABLES,isChristmasTable} from '../config/christmas.js?v=58-r2';
const assets=new URL('../../assets/christmas/v58/domino/',import.meta.url);
const LIGHTS_KEY='domino-club-christmas-tree-lights';
const lightModes=['auto','blink','fixed'];
let lightMode='auto';
try{const saved=localStorage.getItem(LIGHTS_KEY);if(lightModes.includes(saved))lightMode=saved;}catch{}
const requestedLights=new URLSearchParams(location.search).get('treeLights');
if(lightModes.includes(requestedLights)){lightMode=requestedLights;try{localStorage.setItem(LIGHTS_KEY,lightMode);}catch{}}
const images={tree:'tree/tree-r2.webp',garland:'garlands/garland.png',corner:'ui/corner-r2.webp',perimeter:'tables/perimeter-r2.webp',gifts:'ui/gifts-r2.webp'};
// Bulbs follow the actual photographed branches; six independent circuits.
const treeLights=[[50,7],[46,13],[54,14],[42,17],[59,19],[48,20],[53,22],[40,26],[58,27],[34,30],[49,31],[67,32],[30,37],[40,39],[62,39],[72,43],[23,47],[49,47],[67,48],[32,52],[60,54],[21,56],[76,57],[37,60],[58,62],[29,65],[71,65],[16,69],[44,69],[63,73],[31,75],[80,75],[20,79],[51,80],[72,82],[39,85]];
function lights(node,points){
  for(let group=0;group<6;group++){
    const circuit=document.createElement('span');circuit.className='christmas-circuit';circuit.style.cssText=`--duration:${2.1+group*.43}s;--delay:${-group*.67}s`;
    points.filter((_,i)=>i%6===group).forEach(([x,y])=>{const bulb=document.createElement('i');bulb.style.left=`${x}%`;bulb.style.top=`${y}%`;if(node.classList.contains('christmas-tree'))bulb.dataset.bulbColor=['green','red','white'][group%3];circuit.append(bulb);});node.append(circuit);
  }
}
function ornament(type,box){
  const node=document.createElement('span');node.className=`christmas-decoration christmas-${type}`;node.setAttribute('aria-hidden','true');
  const img=document.createElement('img');img.alt='';img.draggable=false;img.src=new URL(images[type],assets).href;node.append(img);
  if(box){const [x,y,w,h,r=0]=box;Object.assign(node.style,{left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`,transform:`rotate(${r}deg)`});}
  if(type==='tree')lights(node,treeLights);
  if(type==='garland')lights(node,[[12,46],[27,57],[38,47],[61,48],[74,57],[88,46]]);
  if(type==='perimeter')lights(node,[[25,25],[32,23],[37,24],[62,23],[68,25],[73,27],[7,65],[12,74],[19,82],[25,88],[33,94],[66,93],[73,87],[81,80]]);
  return node;
}
function cornerPair(target,compact=false){
  if(target.querySelector(':scope > .christmas-corner'))return;
  const left=ornament('corner'),right=ornament('corner');right.classList.add('christmas-corner-right');
  if(compact){left.classList.add('christmas-corner-compact');right.classList.add('christmas-corner-compact');}target.append(left,right);
}
let activeStyle,queued=false;
function sync(){
  queued=false;if(!CHRISTMAS_THEME)return;
  const portal=document.querySelector('#club-portal');
  if(portal){
    if(portal.dataset.christmasTreeLights!==lightMode)portal.dataset.christmasTreeLights=lightMode;
    const domino=portal.dataset.mode==='domino';portal.classList.toggle('christmas-domino',domino);
    const badge=portal.querySelector('.portal-site-version');if(badge&&badge.textContent!==(domino?'V58 NOËL':'V57'))badge.textContent=domino?'V58 NOËL':'V57';
    if(domino){
      if(!portal.hidden&&document.title.includes('V57'))document.title=document.title.replace('V57','V58 NOËL');
      if(!portal.querySelector(':scope > .christmas-tree'))portal.append(ornament('tree',[79,-3,19,45]));
      if(!portal.querySelector(':scope > .christmas-gifts')){const left=ornament('gifts',[1,60,15,17]),right=ornament('gifts',[87,65,12,14]);right.classList.add('christmas-gifts-right');portal.append(left,right);}
      for(const selector of ['.portal-header','.portal-nav']){const target=portal.querySelector(selector);if(target&&!target.querySelector(':scope > .christmas-garland'))target.append(ornament('garland'));}
      if(!portal.querySelector(':scope > .christmas-nav-sash')){const sash=ornament('garland');sash.classList.add('christmas-nav-sash');portal.append(sash);}
      const nav=portal.querySelector('.portal-nav');if(nav)cornerPair(nav,true);
      portal.querySelectorAll('.portal-page:not([hidden]) :is(.portal-card,.portal-live-chat,.portal-history-column,.portal-profile-detail,.portal-connected-strip)').forEach(card=>cornerPair(card,card.classList.contains('portal-connected-strip')));
    }
  }
  const stage=document.querySelector('#casino-stage');
  if(stage&&stage.dataset.christmasTreeLights!==lightMode)stage.dataset.christmasTreeLights=lightMode;
  if(stage&&activeStyle!==stage.dataset.roomTheme){
    activeStyle=stage.dataset.roomTheme;stage.querySelectorAll(':scope > .christmas-table-layer').forEach(n=>n.remove());
    if(isChristmasTable(activeStyle)){
      const layer=document.createElement('div');layer.className='christmas-table-layer';layer.setAttribute('aria-hidden','true');
      const config=CHRISTMAS_TABLES[activeStyle];layer.append(ornament('tree',config.tree),ornament('perimeter',[0,0,100,100]));stage.querySelector('.scene-base').after(layer);
    }
  }
  const select=document.querySelector('#music-track');
  if(select&&!select.querySelector('[data-christmas-audio]'))for(const name of ['Noël — Lounge','Noël — Jazz Club']){const option=document.createElement('option');option.textContent=`${name} (fichier à fournir)`;option.disabled=true;option.dataset.christmasAudio='pending';select.append(option);}
  const musicPanel=document.querySelector('#music-panel');
  if(musicPanel&&!musicPanel.querySelector('.christmas-tree-light-control')){
    const field=document.createElement('fieldset');field.className='christmas-tree-light-control';
    const legend=document.createElement('legend');legend.textContent='Guirlandes du sapin';
    const control=document.createElement('select');control.setAttribute('aria-label','Guirlandes du sapin');
    for(const [value,label] of [['auto','Automatique · réglages de l’appareil'],['blink','Clignotantes · vert, rouge et blanc'],['fixed','Fixes']]){const option=document.createElement('option');option.value=value;option.textContent=label;control.append(option);}
    control.value=lightMode;control.addEventListener('change',()=>{lightMode=control.value;try{localStorage.setItem(LIGHTS_KEY,lightMode);}catch{}sync();});
    field.append(legend,control);musicPanel.append(field);
  }
  const lightControl=musicPanel?.querySelector('.christmas-tree-light-control');
  if(lightControl){lightControl.hidden=!isChristmasTable(stage?.dataset.roomTheme);lightControl.querySelector('select').value=lightMode;}
}
function schedule(){if(!queued){queued=true;queueMicrotask(sync);}}
const options={subtree:true,childList:true,attributes:true,attributeFilter:['data-mode','data-page','data-room-theme']};
const observer=new MutationObserver(schedule);observer.observe(document.body,options);sync();
window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
window.addEventListener('pageshow',e=>{if(e.persisted){observer.observe(document.body,options);sync();}});
