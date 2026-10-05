import { FIREBASE_PATHS } from '../config/firebase.js?v=20261005T162819119';
import { KHALIL_PROFILE_ID } from '../config/room-cancellation.js?v=20261005T162819119';

export const DEFAULT_ENVIRONMENT_SETTINGS=Object.freeze({weather:'breeze',intensity:85});
export const WEATHER_MODES=Object.freeze(['calm','breeze','windy']);
export const canConfigureEnvironment=profile=>profile?.id!=null&&String(profile.id)===String(KHALIL_PROFILE_ID);

export function normalizeEnvironmentSettings(value){
  const intensity=value?.intensity==null?NaN:Number(value.intensity);
  return {weather:WEATHER_MODES.includes(value?.weather)?value.weather:DEFAULT_ENVIRONMENT_SETTINGS.weather,
    intensity:Number.isFinite(intensity)?Math.max(0,Math.min(100,Math.round(intensity))):DEFAULT_ENVIRONMENT_SETTINGS.intensity};
}
export function environmentSettingsPatch(value){
  if(!value||typeof value!=='object'||!Object.keys(value).length||Object.keys(value).some(key=>!['weather','intensity'].includes(key)))throw new Error('Réglages d’ambiance invalides.');
  const patch={};
  if(Object.hasOwn(value,'weather')){if(!WEATHER_MODES.includes(value.weather))throw new Error('Choisis Calme, Brise légère ou Brise soutenue.');patch.weather=value.weather;}
  if(Object.hasOwn(value,'intensity')){if(!Number.isInteger(value.intensity)||value.intensity<0||value.intensity>100)throw new Error('Choisis une intensité entre 0 et 100 %.');patch.intensity=value.intensity;}
  return patch;
}

// Shared club configuration, never stored inside a room/game transaction.
// Uses the existing profile-access boundary; not a substitute for Firebase Auth.
export class EnvironmentSettingsRepository{
  constructor(database,{identity,requirePlayer,serverTimestamp=()=>Date.now()}={}){
    this.root=database.ref(FIREBASE_PATHS.environmentSettings);this.identity=identity;this.requirePlayer=requirePlayer;this.serverTimestamp=serverTimestamp;
  }
  canConfigure(){return canConfigureEnvironment(this.identity?.()?.profile);}
  watch(onValue,onError){const listener=s=>onValue(normalizeEnvironmentSettings(s.val()));this.root.on('value',listener,onError);return()=>this.root.off('value',listener);}
  async update(value){
    this.requirePlayer?.();if(!this.canConfigure())throw new Error('Seul Khalil peut régler l’ambiance de toutes les tables.');
    const patch=environmentSettingsPatch(value),at=this.serverTimestamp();let denied=false;
    const result=await this.root.transaction(current=>{
      denied=false;if(!this.canConfigure()){denied=true;return;}
      return {...current,...normalizeEnvironmentSettings(current),...patch,version:1,updatedAt:at,updatedBy:KHALIL_PROFILE_ID};
    },undefined,false);
    if(!result.committed)throw new Error(denied?'Seul Khalil peut régler l’ambiance de toutes les tables.':'Les réglages d’ambiance n’ont pas pu être enregistrés.');
    return normalizeEnvironmentSettings(result.snapshot.val());
  }
}
