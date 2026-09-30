import { FIREBASE_PATHS } from '../config/firebase.js?v=20260930T205039435';
import { randomId } from './ids.js?v=20260930T205039435';

export const DEFAULT_ANNOUNCEMENT_COLOR='#dcf7ff';
export const announcementColor=value=>/^#[0-9a-f]{6}$/i.test(String(value))?String(value).toLowerCase():DEFAULT_ANNOUNCEMENT_COLOR;

export function announcementFields(value) {
  const title=String(value?.title??'').trim(),text=String(value?.text??'').trim();
  const scrollDuration=Number(value?.scrollDuration),order=Number(value?.order),section=value?.section;
  if(!title||title.length>140)throw new Error('Le titre doit contenir entre 1 et 140 caractères.');
  if(!text||text.length>1200)throw new Error('Le texte doit contenir entre 1 et 1 200 caractères.');
  if(!Number.isFinite(scrollDuration)||scrollDuration<5||scrollDuration>60)throw new Error('Choisissez une durée de défilement de 5 à 60 secondes.');
  if(!Number.isInteger(order)||Math.abs(order)>10000)throw new Error('L’ordre doit être un entier compris entre −10 000 et 10 000.');
  if(!['all','domino','poker'].includes(section))throw new Error('Choisissez Tous, Domino ou Poker.');
  // Older clients/records have no colour. Never erase a saved colour when
  // such a client edits the other fields of an announcement.
  const color={};
  if(value.textColor!==undefined){
    if(!/^#[0-9a-f]{6}$/i.test(String(value.textColor)))throw new Error('Choisissez une couleur au format #RRGGBB.');
    color.textColor=announcementColor(value.textColor);
  }
  return {title,text,scrollDuration,order,section,active:value.active===true,...color};
}
export function orderedAnnouncements(value) {
  return Object.entries(value||{}).filter(([,item])=>item&&typeof item.title==='string')
    .map(([id,item])=>({...item,id,textColor:announcementColor(item.textColor)})).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||(Number(a.createdAt)||0)-(Number(b.createdAt)||0)||a.id.localeCompare(b.id));
}
export const announcementsForMode=(items,mode)=>items.filter(item=>item.active===true&&(item.section==='all'||item.section===mode));

export class ClubAnnouncementRepository {
  constructor(database,{requirePlayer,identity,serverTimestamp=()=>Date.now()}={}) {
    this.root=database.ref(FIREBASE_PATHS.clubAnnouncements);this.requirePlayer=requirePlayer;this.identity=identity;this.serverTimestamp=serverTimestamp;
  }
  player() {
    this.requirePlayer?.();const profile=this.identity?.()?.profile;
    if(profile?.id==null)throw new Error('Identifiez-vous comme joueur pour gérer les infos du club.');
    return {id:profile.id,name:profile.name};
  }
  reference(id) {if(!/^[a-zA-Z0-9_-]{1,100}$/.test(String(id)))throw new Error('Annonce invalide.');return this.root.child(String(id));}
  watch(onValue,onError) {const listener=snapshot=>onValue(orderedAnnouncements(snapshot.val()));this.root.on('value',listener,onError);return()=>this.root.off('value',listener);}
  async create(value) {
    const author=this.player(),fields=announcementFields(value),id=`info_${Date.now()}_${randomId(8)}`,at=this.serverTimestamp();
    await this.reference(id).set({id,...fields,author,createdAt:at,updatedAt:at});return id;
  }
  async edit(id,value,expectedUpdatedAt) {
    this.player();const fields=announcementFields(value),at=this.serverTimestamp();let conflict=false,missing=false;
    const result=await this.reference(id).transaction(current=>{
      conflict=false;missing=false;if(!current){missing=true;return;}
      if(expectedUpdatedAt!==undefined&&current.updatedAt!==expectedUpdatedAt){conflict=true;return;}
      return {...current,...fields,id,updatedAt:at};
    });
    if(!result.committed)throw new Error(missing?'Cette annonce a été supprimée.':conflict?'Cette annonce a été modifiée par un autre joueur. Rouvrez-la pour consulter sa dernière version.':'Enregistrement impossible.');
  }
  async setActive(id,active) {
    this.player();const at=this.serverTimestamp();const result=await this.reference(id).transaction(current=>current?{...current,active:Boolean(active),updatedAt:at}:undefined);
    if(!result.committed)throw new Error('Cette annonce a été supprimée.');
  }
  async move(id,direction) {
    this.player();this.reference(id);const at=this.serverTimestamp();
    await this.root.transaction(current=>{
      const items=orderedAnnouncements(current),i=items.findIndex(item=>item.id===id),j=i+(direction<0?-1:1);
      if(i<0||j<0||j>=items.length)return;
      [items[i],items[j]]=[items[j],items[i]];
      const next={...current};items.forEach((item,index)=>{next[item.id]={...current[item.id],order:index+1,updatedAt:at};});return next;
    });
  }
  async remove(id,expectedUpdatedAt) {
    this.player();let conflict=false;
    const result=await this.reference(id).transaction(current=>{conflict=false;if(!current)return null;if(expectedUpdatedAt!==undefined&&current.updatedAt!==expectedUpdatedAt){conflict=true;return;}return null;});
    if(!result.committed&&conflict)throw new Error('Cette annonce a changé depuis votre confirmation. Consultez-la avant de la supprimer.');
  }
}
