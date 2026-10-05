import {getEnvironment} from '../config/domino-environments.js?v=20261005T162819119';
import {EnvironmentAnimator} from './environment-animator.js?v=20261005T162819119';
import {DEFAULT_ENVIRONMENT_SETTINGS,canConfigureEnvironment} from '../services/environment-settings-repository.js?v=20261005T162819119';

const QUALITY_KEY='domino-club-environment-quality';
const QUALITIES=['AUTO','FULL','REDUCED','OFF'];
let animator=null,environment=null,settings={...DEFAULT_ENVIRONMENT_SETTINGS},preview=null,quality='AUTO',visibility=null;
let storedQuality=false;
try{const saved=localStorage.getItem(QUALITY_KEY);if(QUALITIES.includes(saved)){quality=saved;storedQuality=true;}}catch{}

function refresh(){if(animator&&environment){animator.set(environment,{...settings,...preview,quality});animator.pause(Boolean(document.querySelector('#game-shell')?.hidden));}}
export function applyDominoEnvironment(style){
  const next=getEnvironment(style),stage=document.querySelector('#casino-stage');
  environment=next;
  if(!next||!stage){animator?.destroy();animator=null;return;}
  if(!animator){
    animator=new EnvironmentAnimator(stage);stage.querySelector('.scene-base')?.after(animator.root);
    if(!visibility){visibility=new MutationObserver(()=>animator?.pause(Boolean(document.querySelector('#game-shell')?.hidden)));visibility.observe(document.querySelector('#game-shell'),{attributes:true,attributeFilter:['hidden']});}
  }
  refresh();
}

export function bindEnvironmentSettings(repository,{identity,canWrite=()=>true,notify=()=>{}}={}){
  const owner=document.querySelector('#environment-global-settings'),wind=document.querySelector('#environment-weather'),range=document.querySelector('#environment-intensity'),output=document.querySelector('#environment-intensity-value'),status=document.querySelector('#environment-status'),local=document.querySelector('#environment-quality');
  const listeners=[];let disposed=false,pending=false,errorText='',authority=false;
  const listen=(target,event,listener)=>{target?.addEventListener(event,listener);listeners.push(()=>target?.removeEventListener(event,listener));};
  function controls(){
    authority=canConfigureEnvironment(identity?.()?.profile);
    owner.hidden=!authority;wind.disabled=range.disabled=!authority||pending;
    const visible={...settings,...preview};wind.value=visible.weather;range.value=String(visible.intensity);output.value=`${visible.intensity} %`;local.value=quality;
    status.textContent=errorText||(pending?'Enregistrement…':'Réglages communs à toutes les tables · sauvegarde automatique');
  }
  function syncAuthority(){
    // Khalil explicitly approved the strong FULL prototype. Other devices
    // default to AUTO and can independently reduce/disable for accessibility.
    if(canConfigureEnvironment(identity?.()?.profile)&&!storedQuality){quality='FULL';storedQuality=true;try{localStorage.setItem(QUALITY_KEY,quality);}catch{}}
    controls();refresh();
  }
  const stop=repository.watch(value=>{settings=value;errorText='';controls();refresh();},error=>{errorText='Réglages partagés indisponibles.';controls();notify(error.message,'error');});
  async function commit(patch){
    if(pending||!canConfigureEnvironment(identity?.()?.profile)||!canWrite()){preview=null;controls();refresh();return;}
    pending=true;errorText='';preview={...settings,...patch};controls();refresh();
    try{settings=await repository.update(patch);}
    catch(error){errorText='Échec de l’enregistrement · réglage précédent rétabli.';notify(error.message,'error');}
    finally{preview=null;pending=false;if(!disposed){controls();refresh();}}
  }
  listen(wind,'change',()=>commit({weather:wind.value}));
  listen(range,'input',()=>{if(!pending&&canConfigureEnvironment(identity?.()?.profile)){preview={...settings,intensity:Number(range.value)};output.value=`${range.value} %`;refresh();}});
  listen(range,'change',()=>commit({intensity:Number(range.value)}));
  listen(local,'change',()=>{quality=QUALITIES.includes(local.value)?local.value:'AUTO';storedQuality=true;try{localStorage.setItem(QUALITY_KEY,quality);}catch{}controls();refresh();});
  function destroy(){if(disposed)return;disposed=true;stop();listeners.forEach(remove=>remove());visibility?.disconnect();visibility=null;animator?.destroy();animator=null;}
  listen(window,'pagehide',event=>{if(!event.persisted)destroy();});
  syncAuthority();
  return {syncAuthority,destroy};
}
