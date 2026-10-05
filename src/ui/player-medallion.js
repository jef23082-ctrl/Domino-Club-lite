import { JEAN_CLAUDE_MEDALLION as badge } from '../config/portrait-assets.js?v=20261005T162819119';

const ns='http://www.w3.org/2000/svg';
const layers=new WeakMap();
const svgNode=(tag,attributes={})=>{const n=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attributes))n.setAttribute(key,String(value));return n;};

// A separate decorative layer follows the existing image geometry. The actor
// bitmap, face, frame, and table layout are never modified or regenerated.
export function syncPlayerMedallion(image,characterId,seat='top'){
  let layer=layers.get(image);
  if(characterId!=='jean-claude') {if(layer)layer.setAttribute('hidden','');return;}
  if(!layer){
    layer=svgNode('svg',{viewBox:'0 0 1672 941',width:1672,height:941,preserveAspectRatio:'none','aria-hidden':'true',focusable:'false'});
    layers.set(image,layer);image.after(layer);
    new MutationObserver(()=>{layer.toggleAttribute('hidden',image.hidden||image.dataset.characterId!=='jean-claude');}).observe(image,{attributes:true,attributeFilter:['hidden','data-character-id']});
  }
  layer.setAttribute('class',`${image.className} player-medallion-layer`);
  layer.dataset.characterId=characterId;layer.dataset.renderMode=image.dataset.renderMode||'';
  layer.style.cssText=image.style.cssText;layer.style.pointerEvents='none';
  layer.toggleAttribute('hidden',image.hidden);
  // Room/timer updates must not remount the already-decoded pin image.
  if(layer.dataset.medallionSeat===seat)return layer;
  layer.dataset.medallionSeat=seat;
  const place=badge.seats[seat],crop=svgNode('svg',{...place,viewBox:badge.crop,preserveAspectRatio:'none',overflow:'hidden'});
  crop.removeAttribute('rotation');crop.setAttribute('transform',`rotate(${place.rotation} ${place.x+place.width/2} ${place.y+place.height/2})`);
  crop.append(svgNode('image',{href:badge.src,width:badge.sourceWidth,height:badge.sourceHeight}));layer.replaceChildren(crop);
  return layer;
}
