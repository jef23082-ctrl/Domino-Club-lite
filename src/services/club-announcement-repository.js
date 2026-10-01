import { FIREBASE_PATHS } from '../config/firebase.js?v=20261001T025219457';
import { randomId } from './ids.js?v=20261001T025219457';
import {normalizeAnnouncementContent,announcementContentText,announcementContent} from './club-announcement-content.js?v=20261001T025219457';

export const DEFAULT_ANNOUNCEMENT_COLOR='#dcf7ff';
export const announcementColor=value=>/^#[0-9a-f]{6}$/i.test(String(value))?String(value).toLowerCase():DEFAULT_ANNOUNCEMENT_COLOR;

export function announcementFields(value) {
  const content=value?.content===undefined?undefined:normalizeAnnouncementContent(value.content);
  const title=String(value?.title??'').trim(),text=content===undefined?String(value?.text??'').trim():announcementContentText(content);
  const scrollDuration=Number(value?.scrollDuration),order=Number(value?.order),section=value?.section;
  if(!title||title.length>140)throw new Error('Le titre doit contenir entre 1 et 140 caractères.');
  if(!text||(content===undefined&&text.length>1200))throw new Error('Le texte doit contenir entre 1 et 1 200 caractères.');
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
  return {title,text,scrollDuration,order,section,active:value.active===true,...color,...(content===undefined?{}:{content})};
}
export function orderedAnnouncements(value) {
  return Object.entries(value||{}).filter(([,item])=>item&&typeof item.title==='string')
    .map(([id,item])=>({...item,id,textColor:announcementColor(item.textColor),...(item.content===undefined?{}:{content:announcementContent(item)})})).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||(Number(a.createdAt)||0)-(Number(b.createdAt)||0)||a.id.localeCompare(b.id));
}
export const announcementsForMode=(items,mode)=>items.filter(item=>item.active===true&&(item.section==='all'||item.section===mode));
export const canDeleteAnnouncement=(profile,item,privilegedPlayerId)=>profile?.id!=null&&(String(profile.id)===String(privilegedPlayerId??3)||item?.author?.id!=null&&String(item.author.id)===String(profile.id));

export class ClubAnnouncementRepository {
  constructor(database,{requirePlayer,identity,privilegedPlayerId=()=>3,serverTimestamp=()=>Date.now()}={}) {
    this.root=database.ref(FIREBASE_PATHS.clubAnnouncements);this.requirePlayer=requirePlayer;this.identity=identity;this.privilegedPlayerId=privilegedPlayerId;this.serverTimestamp=serverTimestamp;
  }
  player() {
    this.requirePlayer?.();const profile=this.identity?.()?.profile;
    if(profile?.id==null)throw new Error('Identifiez-vous comme joueur pour gérer les infos du club.');
    return {id:profile.id,name:profile.name};
  }
  reference(id) {if(!/^[a-zA-Z0-9_-]{1,100}$/.test(String(id)))throw new Error('Annonce invalide.');return this.root.child(String(id));}
  canManage(item){return canDeleteAnnouncement(this.identity?.()?.profile,item,typeof this.privilegedPlayerId==='function'?this.privilegedPlayerId():this.privilegedPlayerId);}
  canRemove(item){return this.canManage(item);}
  canReorder(){return this.canManage({});}
  watch(onValue,onError) {const listener=snapshot=>onValue(orderedAnnouncements(snapshot.val()));this.root.on('value',listener,onError);return()=>this.root.off('value',listener);}
  async create(value) {
    const author=this.player(),fields=announcementFields(this.canReorder()?value:{...value,order:0}),id=`info_${Date.now()}_${randomId(8)}`,at=this.serverTimestamp();
    // New messages from ordinary players are appended atomically. Supplying
    // a custom order must not bypass Khalil's exclusive reordering controls.
    await this.root.transaction(current=>{
      const order=this.canReorder()?fields.order:Math.max(0,...orderedAnnouncements(current).map(item=>Number(item.order)||0))+1;
      if(order>10000)throw new Error('La liste est pleine. Demandez à Khalil de réorganiser les messages.');
      return {...current,[id]:{id,...fields,order,author,createdAt:at,updatedAt:at}};
    });return id;
  }
  async edit(id,value,expectedUpdatedAt) {
    this.player();const fields=announcementFields(this.canReorder()?value:{...value,order:0}),at=this.serverTimestamp();let conflict=false,missing=false,denied=false;
    const result=await this.reference(id).transaction(current=>{
      conflict=false;missing=false;denied=false;if(!current){missing=true;return;}
      if(!this.canManage(current)){denied=true;return;}
      if(expectedUpdatedAt!==undefined&&current.updatedAt!==expectedUpdatedAt){conflict=true;return;}
      const next={...current,...fields,order:this.canReorder()?fields.order:current.order??0,id,updatedAt:at};
      // An old client may change plain text without knowing about images.
      // Preserve rich content only if its fallback text was not changed.
      if(fields.content===undefined&&fields.text!==current.text)delete next.content;
      return next;
    });
    if(!result.committed)throw new Error(denied?'Seul Khalil peut modifier les messages des autres joueurs.':missing?'Cette annonce a été supprimée.':conflict?'Cette annonce a été modifiée par un autre joueur. Rouvrez-la pour consulter sa dernière version.':'Enregistrement impossible.');
  }
  async setActive(id,active) {
    this.player();const at=this.serverTimestamp();let denied=false;
    const result=await this.reference(id).transaction(current=>{denied=false;if(!current)return;if(!this.canManage(current)){denied=true;return;}return {...current,active:Boolean(active),updatedAt:at};});
    if(!result.committed)throw new Error(denied?'Seul Khalil peut activer ou désactiver les messages des autres joueurs.':'Cette annonce a été supprimée.');
  }
  async move(id,direction) {
    this.player();this.reference(id);if(!this.canReorder())throw new Error('Seul Khalil peut changer l’ordre des messages.');const at=this.serverTimestamp();let denied=false;
    const result=await this.root.transaction(current=>{
      denied=false;if(!this.canReorder()){denied=true;return;}
      const items=orderedAnnouncements(current),i=items.findIndex(item=>item.id===id),j=i+(direction<0?-1:1);
      if(i<0||j<0||j>=items.length)return;
      [items[i],items[j]]=[items[j],items[i]];
      const next={...current};items.forEach((item,index)=>{next[item.id]={...current[item.id],order:index+1,updatedAt:at};});return next;
    });
    if(!result.committed&&denied)throw new Error('Seul Khalil peut changer l’ordre des messages.');
  }
  async remove(id,expectedUpdatedAt) {
    this.player();let conflict=false,denied=false;
    const result=await this.reference(id).transaction(current=>{conflict=false;denied=false;if(!current)return null;if(!this.canRemove(current)){denied=true;return;}if(expectedUpdatedAt!==undefined&&current.updatedAt!==expectedUpdatedAt){conflict=true;return;}return null;});
    if(!result.committed&&denied)throw new Error('Seul Khalil peut supprimer les messages des autres joueurs.');
    if(!result.committed&&conflict)throw new Error('Cette annonce a changé depuis votre confirmation. Consultez-la avant de la supprimer.');
  }
}
