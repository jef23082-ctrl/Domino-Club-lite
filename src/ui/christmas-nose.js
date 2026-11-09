import {playPigGrunt,stopPigGrunt} from './sound-player.js?v=20261005T162819119';
import {isChristmasTable} from '../config/christmas.js?v=58-r2';
const source=new URL('../../assets/christmas/v58/domino/audio/nose-christmas-r2.wav',import.meta.url).href;
let active=null,original=null;
export function stopChristmasNose(){
  if(!active)return;
  const player=active;active=null;stopPigGrunt();player.removeEventListener('ended',restore);
  player.src=original;original=null;
}
function restore(){stopChristmasNose();}
export function playMascotNose(style){
  stopChristmasNose();
  if(!isChristmasTable(style))return playPigGrunt();
  const player=document.querySelector('#pig-grunt-audio');if(!player)return Promise.resolve('error');
  original=player.src;active=player;player.src=source;player.addEventListener('ended',restore,{once:true});
  return playPigGrunt().then(result=>{if(result!=='playing')stopChristmasNose();return result;});
}
