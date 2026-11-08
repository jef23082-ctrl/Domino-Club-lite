import {CHRISTMAS_THEME,CHRISTMAS_TABLES,isChristmasTable} from '../config/christmas.js';
const assets=new URL('../../assets/christmas/v58/domino/',import.meta.url);
function ornament(type,box){
  const node=document.createElement('span');node.className=`christmas-decoration christmas-${type}`;node.setAttribute('aria-hidden','true');
  const img=document.createElement('img');img.alt='';img.draggable=false;img.src=new URL(type==='tree'?'tree/tree.png':'garlands/garland.png',assets).href;node.append(img);
  if(box){const [x,y,w,h,r=0]=box;Object.assign(node.style,{left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`,transform:`rotate(${r}deg)`});}
  const spots=type==='tree'?[[49,12],[40,28],[57,35],[30,45],[65,53],[40,61],[22,72],[56,75],[72,81],[42,86]]:[[12,46],[27,57],[38,47],[61,48],[74,57],[88,46]];
  spots.forEach(([x,y],i)=>{const light=document.createElement('i');light.style.cssText=`left:${x}%;top:${y}%;--duration:${1.8+i*.29}s;--delay:${-i*.61}s`;node.append(light);});return node;
}
let activeStyle,queued=false;
function sync(){
  queued=false;if(!CHRISTMAS_THEME)return;
  const portal=document.querySelector('#club-portal');
  if(portal){
    const domino=portal.dataset.mode==='domino';portal.classList.toggle('christmas-domino',domino);
    const badge=portal.querySelector('.portal-site-version');if(badge&&badge.textContent!==(domino?'V58 NOËL':'V57'))badge.textContent=domino?'V58 NOËL':'V57';
    if(domino){
      if(!portal.hidden&&document.title.includes('V57'))document.title=document.title.replace('V57','V58 NOËL');
      if(!portal.querySelector(':scope > .christmas-tree'))portal.append(ornament('tree',[80,0,19,46]));
      for(const selector of ['.portal-header','.portal-nav']){const target=portal.querySelector(selector);if(target&&!target.querySelector(':scope > .christmas-garland'))target.append(ornament('garland'));}
      portal.querySelectorAll('.portal-page:not([hidden]) .portal-card').forEach((card,i)=>{if(!card.querySelector(':scope > .christmas-garland')){const deco=ornament('garland');deco.classList.add('christmas-corner');if(i%2)deco.classList.add('christmas-corner-right');card.append(deco);}});
    }
  }
  const stage=document.querySelector('#casino-stage');
  if(stage&&activeStyle!==stage.dataset.roomTheme){
    activeStyle=stage.dataset.roomTheme;stage.querySelectorAll(':scope > .christmas-table-layer').forEach(n=>n.remove());
    if(isChristmasTable(activeStyle)){
      const layer=document.createElement('div');layer.className='christmas-table-layer';layer.setAttribute('aria-hidden','true');
      const config=CHRISTMAS_TABLES[activeStyle];layer.append(ornament('tree',config.tree));config.garlands.forEach(b=>layer.append(ornament('garland',b)));stage.querySelector('.scene-base').after(layer);
    }
  }
  const select=document.querySelector('#music-track');
  if(select&&!select.querySelector('[data-christmas-audio]'))for(const name of ['Noël — Lounge','Noël — Jazz Club']){const option=document.createElement('option');option.textContent=`${name} (fichier à fournir)`;option.disabled=true;option.dataset.christmasAudio='pending';select.append(option);}
}
function schedule(){if(!queued){queued=true;queueMicrotask(sync);}}
const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-mode','data-page','data-room-theme']});sync();
window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
window.addEventListener('pageshow',e=>{if(e.persisted){observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-mode','data-page','data-room-theme']});sync();}});
