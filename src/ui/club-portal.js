import { element as el, button, card, avatar, select, rankingTable } from './club-elements.js';
import { recalculatePhysical, physicalRanking, profileDetails, nightKey, matchNight } from '../game/club-state.js';
import { rankingRows, historyDescription, formatMatchDate, roomDeletionTarget } from '../online/club-presentation.js';
import { roomPlayers } from '../game/room-state.js';
import { createChatComposer } from './chat-composer.js?v=20260902T015215899';
import { navigationIcon } from './navigation-icon.js';
import { activeRooms, connectedRoomPlayers } from '../online/room-activity.js';
import { displayName } from '../online/display-name.js';

const SECTIONS=[['home','Accueil','⌂'],['online','En ligne','◎'],['ranking','Classement','☷'],['profiles','Profils','♙'],['history','Historique','◷'],['admin','Admin','⚙']];
export function createClubPortal({ ui, physical, access, stats, admin, chat, identity, canWrite, notify, actions, onData }) {
  const app=document.querySelector('#app'), game=document.querySelector('#game-shell');
  const root=el('section','club-portal');root.id='club-portal';root.hidden=true;
  const scroll=el('div','portal-scroll'), header=el('header','portal-header');
  header.append(el('p','portal-kicker','DOMINO CLUB ÉLITE'),el('h1','','Le Roi du Cochon'));
  const dataStatus=el('p','portal-data-status','Chargement des données du club…');header.append(dataStatus);scroll.append(header);
  const pages=new Map(), nav=el('nav','portal-nav');nav.setAttribute('aria-label','Navigation principale');
  const buttons=new Map();
  for(const [id,label,icon] of SECTIONS){const page=el('section','portal-page');page.id=`page-${id}`;page.hidden=true;page.setAttribute('aria-label',label);pages.set(id,page);scroll.append(page);
    const item=button('',()=>open(id),'portal-nav-item');item.id=`nav-btn-${id}`;const glyph=el('span','portal-nav-icon');glyph.append(navigationIcon(id));item.append(glyph,el('span','',label));nav.append(item);buttons.set(id,item);}
  root.append(scroll,nav);app.append(root);
  const online=pages.get('online'); const hero=card('Domino en ligne');hero.classList.add('portal-online-hero');hero.append(el('p','','Salle privée entre collègues. Les résultats en ligne restent séparés des parties jouées en réel.'));
  const statusRow=el('div','portal-grid'), presenceCard=card('Joueurs connectés'), inviteCard=card('Tes invitations'), gamesCard=card('Parties en cours');
  const presences=el('div','portal-live-list'), invites=el('div','portal-live-list'), games=el('div','portal-live-list');
  presenceCard.append(presences);inviteCard.append(invites);gamesCard.append(games);statusRow.append(presenceCard,inviteCard,gamesCard);
  const chatSlot=el('div'), summarySlot=el('div','portal-grid');
  const lobbyHost=el('div');online.append(hero,lobbyHost,statusRow,chatSlot,summarySlot);
  let data=null, snapshot=null, summary={history:[],stats:{},rooms:{}}, page='home', authenticated=false, inScene=false, profileId=null, editorId='new', generalChat=null, roomChat=null, roomChatCode='', stopData, stopStats;
  let physicalFingerprint='', dialogBusy=false;
  const activityTimer=setInterval(()=>{if(authenticated && page==='online' && !inScene)renderOnlineExtras();},15000);

  function reparentNotices(parent){parent.append(ui.toast,ui.network);}
  function open(next='home') {
    if(!authenticated)return;
    if(page==='admin' && next!=='admin')access.lock();
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    page=next;inScene=false;root.hidden=false;game.hidden=true;ui.menu.hidden=true;reparentNotices(app);
    for(const [id,view] of pages){view.hidden=id!==next;buttons.get(id).classList.toggle('active',id===next);if(id===next)buttons.get(id).setAttribute('aria-current','page');else buttons.get(id).removeAttribute('aria-current');}
    scroll.scrollTop=0;
    if(next==='online'){actions.renderOnline();renderOnlineExtras();} else renderPage();
  }
  function showTable(){if(!snapshot?.room?.game)return;access.lock();inScene=true;root.hidden=true;game.hidden=false;ui.hub.hidden=true;ui.menu.hidden=false;reparentNotices(game);document.querySelector('#casino-stage').classList.remove('is-online-dimmed');}
  function row(text, actionLabel, action){const node=el('div','portal-list-row');node.append(el('span','',text));if(actionLabel)node.append(button(actionLabel,action,'online-action--small'));return node;}
  function renderOnlineExtras(){
    if(!snapshot)return;
    const now=Date.now(), live=Object.values(snapshot.presences||{}).filter(item=>item&&now-Number(item.lastSeen||0)<120000);
    const unique=new Map(live.map(item=>[String(item.playerId),item]));
    presences.replaceChildren(...[...unique.values()].map(item=>row(`${item.name} · ${item.roomCode ? item.role==='spectator'?'Spectateur':'En salle' : 'Disponible'}`)));
    if(!unique.size)presences.append(el('p','portal-muted','Aucun joueur connecté.'));
    const valid=Object.entries(snapshot.invitations||{}).filter(([,item])=>item&&(!item.createdAt||now-Number(item.createdAt)<3600000));
    invites.replaceChildren();for(const [id,invitation] of valid){const node=row(`${invitation.fromName} t’invite dans la salle ${invitation.roomCode}.`,'Accepter',()=>actions.acceptInvite(id,invitation));node.append(button('Refuser',()=>actions.declineInvite(id),'online-action--small online-action--danger'));invites.append(node);}
    if(!valid.length)invites.append(el('p','portal-muted','Aucune invitation.'));
    const active=activeRooms(snapshot.rooms,snapshot.presences,now);games.replaceChildren();
    for(const room of active){const mine=roomPlayers(room).some(p=>p.token===snapshot.clientToken),connected=connectedRoomPlayers(room,snapshot.presences,now).length;games.append(row(`${roomPlayers(room).map(p=>p.name).join(' · ')} · ${connected}/3 joueurs connectés${connected<3?' · En attente de reconnexion':''} · ${Object.keys(room.spectators||{}).length} spectateur(s)`,mine?'Reprendre':'Regarder',()=>actions.watchRoom(room.code,mine?'player':'spectator')));}
    if(!active.length)games.append(el('p','portal-muted','Aucune partie en cours.'));
    const interrupted=Object.values(snapshot.rooms||{}).filter(room=>room?.status==='playing').length-active.length;
    if(interrupted)games.append(el('p','portal-muted',`${interrupted} ancienne${interrupted>1?'s':''} salle${interrupted>1?'s':''} sans joueur connecté, conservée${interrupted>1?'s':''} dans Admin. Aucune donnée supprimée.`));
    const currentCode=snapshot.roomCode || '';
    if(currentCode!==roomChatCode){roomChat?.dispose();roomChat=null;roomChatCode=currentCode;if(currentCode){roomChat=createChatComposer({repository:chat,channel:currentCode,identity,canWrite,notify,title:'Discussion de la salle'});chatSlot.prepend(roomChat.root);}}
    renderOnlineSummary();
  }
  function renderOnlineSummary(){
    const rank=card('Classement en ligne'), history=card('Historique en ligne');
    const rows=rankingRows(summary.history,summary.stats).map(row=>({...row,vic:row.won,coch:row.pigs,currentStreak:row.streak,totalGames:row.played}));
    rank.append(rows.length?rankingTable(rows):el('p','portal-muted','Aucune partie en ligne enregistrée.'));
    if(!summary.history.length)history.append(el('p','portal-muted','Aucune partie en ligne enregistrée.'));
    for(const match of summary.history){const description=historyDescription(match);history.append(row(`${formatMatchDate(match.endedAt)} · ${description.title} · ${description.detail}`));}
    rank.classList.add('portal-online-records');history.classList.add('portal-online-records');summarySlot.replaceChildren(rank,history);
  }
  function update(value){snapshot=value;renderOnlineExtras();}
  function activate(profile){
    if(authenticated)return;authenticated=true;profileId=profile.id;
    ui.hub.classList.add('portal-online-panel');lobbyHost.append(ui.hub);
    generalChat=createChatComposer({repository:chat,channel:'GENERAL',identity:()=>({...identity(),role:'lobby'}),canWrite,notify});chatSlot.append(generalChat.root);
    stopData=physical.watch(value=>{const fingerprint=JSON.stringify(value);if(fingerprint===physicalFingerprint)return;physicalFingerprint=fingerprint;data=value;onData?.(value);dataStatus.textContent=`${data.players.length} joueurs · ${data.history.length} manche${data.history.length>1?'s':''} physique${data.history.length>1?'s':''} · Données synchronisées`;
      if(page!=='online' && page!=='admin')renderPage();},error=>{dataStatus.textContent=`Chargement impossible : ${error.message}`;});
    stopStats=stats.watchSummary(value=>{summary=value;renderOnlineSummary();if(page==='admin'&&access.unlocked)renderOnlineAdmin();},error=>notify(error.message,'error'));
    open('home');
  }
  function renderPage(){
    if(page==='online')return;
    const target=pages.get(page);target.replaceChildren();if(!data){target.append(el('p','portal-muted','Chargement des données…'));return;}
    if(page==='home')renderHome(target);
    if(page==='ranking'){const section=card('Classement Général');section.append(rankingTable(physicalRanking(data.players)));target.append(section);}
    if(page==='profiles')renderProfiles(target);
    if(page==='history'){const night=card('Classement Complet de la Nuit');night.append(el('p','portal-muted','Les manches sont regroupées de midi à midi le lendemain.'),rankingTable(physicalRanking(recalculatePhysical(data.players,data.history.filter(match=>matchNight(match)===nightKey(new Date())))),false));const history=card('Historique des Manches');renderPhysicalHistory(history);target.append(night,history);}
    if(page==='admin')renderAdmin(target);
  }
  function renderHome(target){
    const grid=el('div','portal-players');const sorted=[...data.players].sort((a,b)=>(b.vic-b.coch)-(a.vic-a.coch)||b.vic-a.vic);
    sorted.forEach((player,index)=>{const tile=button('',()=>{profileId=player.id;open('profiles');},'portal-player-card');tile.append(el('span','portal-rank',`#${index+1}`),avatar(player),el('strong','',player.name),el('span','portal-player-stats',`${player.vic || 0} victoires · ${player.coch || 0} 🐷`));if(data.currentTable.includes(player.id))tile.append(el('span','portal-at-table','À la table'));if(player.currentStreak>=3)tile.append(el('span','portal-streak',`🔥 ×${player.currentStreak}`));grid.append(tile);});
    const table=card('Table Actuelle'), seats=el('div','portal-current-table');
    for(const id of data.currentTable){const player=data.players.find(p=>String(p.id)===String(id));if(!player)continue;const place=el('div');place.append(avatar(player),el('strong','',player.name));seats.append(place);}
    if(!seats.children.length)seats.append(el('p','portal-muted','Aucune partie physique en cours.'));
    const controls=el('div','portal-actions');controls.append(button('▶ Nouvelle Partie',openNewGame,'online-action--primary'),button('✓ Fin de Manche',openRound));table.append(seats,controls);target.append(grid,table);
  }
  function renderProfiles(target){
    const section=card('Fiches des Joueurs');if(!data.players.length){section.append(el('p','','Aucun joueur.'));target.append(section);return;}
    const player=data.players.find(p=>String(p.id)===String(profileId))||data.players[0];profileId=player.id;
    const picker=select('Joueur',data.players.map(p=>[p.id,p.name]),player.id,id=>{profileId=id;renderPage();});section.append(picker.field);
    const heading=el('div','portal-profile-heading');heading.append(avatar(player),el('h3','',player.name),el('p','portal-muted',`${player.totalGames || 0} manches jouées`));section.append(heading);
    const details=profileDetails(player,data), grid=el('div','portal-stats');
    const values=[['Manches Gagnées',player.vic,`🐷 Préféré : ${details.favoriteVictim}`],['Cochons Reçus',player.coch,`🎯 Victime de : ${details.favoriteGiver}`],['Pourcentage Victoires',`${player.totalGames?Math.round(player.vic/player.totalGames*100):0}%`],['Parties Jouées',player.totalGames],['Sauvé (Égalité)',player.saved],['Record de Série',details.record]];
    for(const [label,value,note] of values){const box=el('div','portal-stat');box.append(el('span','',label),el('strong','',value||0));if(note)box.append(el('small','',note));grid.append(box);}section.append(grid);target.append(section);
  }
  function renderPhysicalHistory(target,destructive=false){
    if(!data.history.length)target.append(el('p','portal-muted','Aucune manche enregistrée.'));
    data.history.forEach((match,index)=>{const node=el('article','portal-history-row'), names=(match.table||[]).map(id=>data.players.find(p=>String(p.id)===String(id))?.name||'Joueur supprimé');
      node.append(el('p','portal-muted',`${match.date || ''} ${match.duration || ''} · #${data.history.length-index}`),el('p','',`Table : ${names.join(', ')}`),el('p','',`🏆 ${match.winner} · 🐷 ${match.cochon || 'Aucun'}`));
      if(destructive)node.append(button('Supprimer cette manche',()=>confirmAction('Supprimer cette manche ?',`${match.date} · ${match.winner}. Les scores, séries et cochons seront recalculés. Une sauvegarde préalable est conservée.`,()=>physical.deleteHistory(match)),'online-action--danger online-action--small'));target.append(node);});
  }
  function modal(title){
    const dialog=el('dialog','portal-dialog');dialog.setAttribute('aria-label',title);dialog.append(el('h2','',title));app.append(dialog);
    const cancel=button('Annuler',()=>{if(!dialogBusy)dialog.close();});dialog.addEventListener('cancel',event=>{if(dialogBusy)event.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());
    return {dialog,cancel,show:()=>dialog.showModal()};
  }
  function choosePlayers(container,players,{multi=false,max=3,onChange=()=>{}}={}){
    let selected=[];const picks=new Map();
    for(const player of players){const pick=button(player.name,()=>{if(selected.includes(player.id))selected=selected.filter(id=>id!==player.id);else if(!multi)selected=[player.id];else if(selected.length<max)selected.push(player.id);else return notify(`Maximum : ${max} joueurs.`,'error');sync();onChange(selected);},'portal-choice');pick.setAttribute('aria-pressed','false');picks.set(player.id,pick);container.append(pick);}
    function sync(){for(const[id,pick]of picks){pick.setAttribute('aria-pressed',String(selected.includes(id)));pick.classList.toggle('selected',selected.includes(id));}}
    return {get:()=>[...selected],clear:()=>{selected=[];sync();}};
  }
  function saveDialog(dialog,commit,operation){commit.disabled=true;dialogBusy=true;Promise.resolve().then(operation).then(()=>{dialog.close();notify('Enregistrement confirmé.');renderPage();}).catch(error=>notify(error.message,'error')).finally(()=>{commit.disabled=false;dialogBusy=false;});}
  function openNewGame(){const {dialog,cancel,show}=modal('Lancer une Nouvelle Partie');dialog.append(el('p','','Sélectionne les 3 joueurs qui s’installent :'));const list=el('div','portal-choices');const choice=choosePlayers(list,data.players,{multi:true,max:3});const commit=button('Démarrer',()=>saveDialog(dialog,commit,()=>physical.start(choice.get())),'online-action--primary');dialog.append(list,cancel,commit);show();}
  function openRound(){
    const table=[...data.currentTable];const version={head:data.history[0]||null,startedAt:data.matchStartTime};if(!table.length)return notify('Lance d’abord une nouvelle partie.','error');
    const {dialog,cancel,show}=modal('Fin de la Manche');const participants=data.players.filter(p=>table.includes(p.id));
    const group=title=>{const section=el('section','portal-choice-group');section.append(el('h3','',title));const picks=el('div','portal-choices');section.append(picks);dialog.append(section);return picks;};
    let winner,saved,cochons;
    winner=choosePlayers(group('🏆 Qui a gagné la partie ?'),participants,{onChange:()=>{saved?.clear();cochons?.clear();}});
    cochons=choosePlayers(group('🐷 Qui prend le cochon ? (Optionnel)'),participants,{multi:true,max:2,onChange:()=>{if(saved.get().length){cochons.clear();notify('Pas de cochon en cas d’égalité.','error');}}});
    saved=choosePlayers(group('🛡️ Qui s’est sauvé de l’égalité ?'),participants,{onChange:()=>{winner.clear();cochons.clear();}});
    const incoming=choosePlayers(group('🚀 Qui rejoint la table ? (Optionnel)'),data.players,{multi:true,max:3});
    const commit=button('Valider',()=>saveDialog(dialog,commit,()=>physical.record({winnerId:winner.get()[0]??null,savedId:saved.get()[0]??null,cochonIds:cochons.get(),incoming:incoming.get()},table,version)),'online-action--primary');dialog.append(cancel,commit);show();
  }
  function confirmAction(title,description,operation){const {dialog,cancel,show}=modal(title);dialog.append(el('p','',description));const commit=button('Confirmer la suppression',()=>saveDialog(dialog,commit,operation),'online-action--danger');dialog.append(cancel,commit);show();}
  function renderAdmin(target){
    if(!access.unlocked){const section=card('Zone Admin'), form=el('form','portal-admin-login'), label=el('label','online-label','Mot de passe administrateur'), input=el('input','online-input');input.type='password';input.autocomplete='off';label.append(input);const submit=button('Valider');submit.type='submit';form.append(label,submit,button('Retour à l’accueil',()=>open('home')));form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const accepted=await access.unlock(input.value);input.value='';if(page!=='admin')return;if(accepted)renderPage();else notify('Mot de passe admin incorrect.','error');}finally{submit.disabled=false;}});section.append(form);target.append(section);return;}
    target.append(button('Reverrouiller',()=>{access.lock();renderPage();},'online-action--small'));
    const editor=card('Ajouter / Modifier un Joueur');const picker=select('Sélectionner un joueur',[['new','— CRÉER UN NOUVEAU JOUEUR —'],...data.players.map(p=>[p.id,p.name])],editorId,id=>{editorId=id;renderPage();});editor.append(picker.field);
    const existing=data.players.find(p=>String(p.id)===String(editorId));let imageData=existing?.avatar||'❓';
    const nameLabel=el('label','online-label','Nom du Joueur'), name=el('input','online-input');name.value=displayName(existing?.name||'');name.maxLength=60;nameLabel.append(name);
    const avatarLabel=el('label','online-label','Avatar / Image / Émoji'), text=el('input','online-input');text.value=imageData.startsWith('data:image')?'':imageData;avatarLabel.append(text);const preview=el('div','portal-avatar-preview');const updatePreview=()=>preview.replaceChildren(avatar({name:name.value,avatar:imageData}));updatePreview();text.addEventListener('input',()=>{imageData=text.value;updatePreview();});
    const fileLabel=el('label','online-label','Fichier'), file=el('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';fileLabel.append(file);
    file.addEventListener('change',async()=>{const selected=file.files[0];if(!selected)return;try{if(selected.size>10*1024*1024)throw new Error('Image limitée à 10 Mo.');const image=await createImageBitmap(selected);const factor=Math.min(1,120/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();imageData=canvas.toDataURL('image/jpeg',.7);text.value='';updatePreview();}catch(error){notify(error.message,'error');}});
    const save=button('Enregistrer le Joueur',async()=>{save.disabled=true;try{await physical.savePlayer({id:existing?.id??null,name:name.value,avatar:imageData,expected:existing});notify('Joueur enregistré.');editorId='new';renderPage();}catch(e){notify(e.message,'error');}finally{save.disabled=false;}},'online-action--primary');editor.append(nameLabel,avatarLabel,preview,fileLabel,save);
    if(existing)editor.append(button('Supprimer le joueur',()=>confirmAction('Supprimer ce joueur ?',`${existing.name} sera retiré des profils et de la table actuelle. Les anciennes manches restent conservées.`,async()=>{await physical.deletePlayer(existing);editorId='new';}),'online-action--danger'));
    const history=card('Corriger l’Historique (Suppression)');renderPhysicalHistory(history,true);const onlineAdmin=el('div','portal-admin-online');onlineAdmin.id='portal-admin-online';target.append(editor,history,onlineAdmin);renderOnlineAdmin();
  }
  function renderOnlineAdmin(){const slot=pages.get('admin').querySelector('#portal-admin-online');if(!slot||!access.unlocked)return;slot.replaceChildren();const rooms=card('Gérer les parties en ligne'), history=card('Historique en ligne');
    for(const [code,room]of Object.entries(summary.rooms||{})){if(!room)continue;const target={...room,code},status={waiting:'En attente',playing:'En cours',finished:'Terminée',cancelled:'Annulée'}[room.status]||room.status;rooms.append(row(`Salle ${code} · ${status} · ${roomPlayers(room).map(p=>p.name).join(', ')}`,room.status==='finished'?'Supprimer':'Annuler',()=>confirmAction('Confirmer la suppression de cette salle ?',`Salle ${code}. Son chat et ses interactions seront retirés. Une salle terminée perdra également son résultat ; les scores en ligne seront recalculés.`,()=>admin.removeRoom(roomDeletionTarget(target)))));}
    if(!rooms.querySelector('button'))rooms.append(el('p','portal-muted','Aucune salle.'));
    for(const match of summary.history)history.append(row(`${formatMatchDate(match.endedAt)} · ${historyDescription(match).title}`,'Supprimer le résultat',()=>confirmAction('Supprimer ce résultat en ligne ?',`Salle ${match.roomCode}. Le classement en ligne sera recalculé, sans toucher aux parties physiques.`,()=>admin.removeHistory(match.matchId))));
    if(!summary.history.length)history.append(el('p','portal-muted','Aucun résultat.'));slot.append(rooms,history);
  }
  return {activate,open,showTable,update,get isScene(){return inScene;},get page(){return page;},get authenticated(){return authenticated;},dispose(){clearInterval(activityTimer);stopData?.();stopStats?.();generalChat?.dispose();roomChat?.dispose();root.remove();}};
}
