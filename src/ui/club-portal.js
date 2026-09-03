import { element as el, button, card, avatar, select, rankingTable } from './club-elements.js';
import { profileDetails } from '../game/club-state.js';
import { historyDescription, formatMatchDate, formatMatchDuration, roomDeletionTarget } from '../online/club-presentation.js';
import { roomPlayers } from '../game/room-state.js';
import { createChatComposer } from './chat-composer.js?v=20260903T071755351';
import { navigationIcon } from './navigation-icon.js';
import { activeRooms, connectedRoomPlayers } from '../online/room-activity.js';
import { displayName } from '../online/display-name.js';
import { clubRankings } from '../online/combined-ranking.js';
import { paginate } from './pagination.js';
import { loungeTitle, loungeIdentity } from '../online/lounge-name.js';
import { CLUB_CHAT_CHANNEL } from '../services/club-chat-session.js';

const SECTIONS=[['home','Accueil','⌂'],['online','En ligne','◎'],['ranking','Classement','☷'],['profiles','Profils','♙'],['history','Historique','◷'],['admin','Admin','⚙']];
export function createClubPortal({ ui, physical, access, stats, admin, chat, identity, canWrite, notify, actions, onData }) {
  const app=document.querySelector('#app'), game=document.querySelector('#game-shell');
  const root=el('section','club-portal');root.id='club-portal';root.hidden=true;
  const scroll=el('div','portal-scroll'), header=el('header','portal-header');
  header.append(el('p','portal-kicker','LE SALON PRIVÉ'),el('h1','','DOMINO CLUB'),el('p','portal-subtitle','Le Roi du Cochon'));
  const dataStatus=el('p','portal-data-status','Chargement des données du club…');header.append(dataStatus);scroll.append(header);
  const pages=new Map(), nav=el('nav','portal-nav');nav.setAttribute('aria-label','Navigation principale');
  const buttons=new Map();
  for(const [id,label,icon] of SECTIONS){const page=el('section','portal-page');page.id=`page-${id}`;page.hidden=true;page.setAttribute('aria-label',label);pages.set(id,page);scroll.append(page);
    const item=button('',()=>open(id),'portal-nav-item');item.id=`nav-btn-${id}`;const glyph=el('span','portal-nav-icon');glyph.append(navigationIcon(id));item.append(glyph,el('span','',label));nav.append(item);buttons.set(id,item);}
  root.append(scroll,nav);app.append(root);
  const online=pages.get('online');
  const presenceCard=card('Joueurs connectés'), inviteCard=card('Tes invitations'), gamesCard=card('Tables du club');
  const presences=el('div','portal-live-list'), invites=el('div','portal-live-list'), games=el('div','portal-live-list');
  presenceCard.append(presences);inviteCard.append(invites);games.classList.add('portal-room-grid');
  const columns=el('div','portal-online-columns'),chatDock=el('aside','portal-live-chat'),chatSlot=el('div','portal-chat-slot');chatDock.setAttribute('aria-label','Discussion commune à tout le club');chatDock.append(chatSlot);columns.append(games,chatDock);gamesCard.append(columns);
  const lobbyHost=el('div','portal-lobby-host');online.append(presenceCard,lobbyHost,gamesCard,inviteCard);
  gamesCard.classList.add('portal-tables');inviteCard.classList.add('portal-invites-card');presenceCard.classList.add('portal-presence-card');
  let data=null, snapshot=null, summary={history:[],stats:{},rooms:{}}, page='home', authenticated=false, inScene=false, profileId=null, editorId='new', generalChat=null, stopData, stopStats;
  let physicalFingerprint='', summaryFingerprint='', profilePresenceFingerprint='', dialogBusy=false, rankingMode='general', adminMode='players';
  const pageNumbers={};
  function paged(target,items,key,size,render){const result=paginate(items,pageNumbers[key],size);pageNumbers[key]=result.page;const list=el('div','portal-paged-list');result.items.forEach((item,i)=>list.append(render(item,result.start+i)));target.append(list);if(result.pages>1){const controls=el('nav','portal-pagination');controls.setAttribute('aria-label',`Pages ${key}`);const prev=button('‹',()=>{pageNumbers[key]--;refresh();}),next=button('›',()=>{pageNumbers[key]++;refresh();});prev.setAttribute('aria-label',`Page précédente ${key}`);next.setAttribute('aria-label',`Page suivante ${key}`);prev.disabled=!result.page;next.disabled=result.page===result.pages-1;controls.append(prev,el('span','',`${result.page+1} / ${result.pages} · ${result.total} résultats`),next);target.append(controls);}function refresh(){if(page==='online')renderOnlineExtras();else renderPage();}}
  const activityTimer=setInterval(()=>{if(authenticated&&!inScene){if(page==='online')renderOnlineExtras();if(page==='profiles')refreshProfilePresence();}},15000);
  function updateCounts(){if(!data)return;dataStatus.textContent=`${data.players.length} joueurs · ${data.history.length} manche${data.history.length===1?'':'s'} physique${data.history.length===1?'':'s'} · ${summary.history.length} partie${summary.history.length===1?'':'s'} en ligne`;}
  function invitationTitle(invitation){const room=snapshot?.rooms?.[invitation.roomCode]||(snapshot?.roomCode===invitation.roomCode?snapshot.room:null);return room?loungeTitle(room):invitation.roomTitle||loungeTitle({code:invitation.roomCode},{id:invitation.fromPlayerId,name:invitation.fromName});}

  function reparentNotices(parent){parent.append(ui.toast,ui.network);}
  function open(next='home') {
    if(!authenticated)return;
    if(page==='admin' && next!=='admin')access.lock();
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    page=next;inScene=false;root.hidden=false;game.hidden=true;ui.menu.hidden=true;reparentNotices(app);
    root.dataset.page=next;header.querySelector('h1').textContent=next==='home'?'DOMINO CLUB':SECTIONS.find(([id])=>id===next)?.[1]||'DOMINO CLUB';
    header.querySelector('.portal-kicker').textContent={home:'ACCUEIL DU CLUB',online:'SALONS EN LIGNE',ranking:'CLASSEMENT DU CLUB',profiles:'CARTES DE MEMBRE',history:'LES ARCHIVES DU CLUB',admin:'GESTION DU CLUB'}[next]||'LE SALON PRIVÉ';
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
    presences.replaceChildren(...[...unique.values()].map(item=>{const line=row(`${item.name} · ${item.roomCode ? item.role==='spectator'?'Spectateur':'En salle' : 'Disponible'}`);line.prepend(avatar(item));line.classList.add('portal-member-row');return line;}));
    if(!unique.size)presences.append(el('p','portal-muted','Aucun joueur connecté.'));
    const valid=Object.entries(snapshot.invitations||{}).filter(([,item])=>item&&(!item.createdAt||now-Number(item.createdAt)<3600000));
    invites.replaceChildren();paged(invites,valid,'invitations',1,([id,v])=>invitationCard(id,v));
    if(!valid.length)invites.append(el('p','portal-muted','Aucune invitation.'));
    const active=activeRooms(snapshot.rooms,snapshot.presences,now);games.replaceChildren();
    const waiting=Object.entries(snapshot.rooms||{}).map(([code,room])=>({...room,code})).filter(room=>room.status==='waiting'&&connectedRoomPlayers(room,snapshot.presences,now).length>0);
    paged(games,[...active,...waiting],'salons',2,room=>{const mine=roomPlayers(room).some(p=>p.token===snapshot.clientToken);return roomCard(room,room.status==='waiting'?(mine?'Mon salon':'Rejoindre'):(mine?'Reprendre':'Regarder'),()=>room.status==='waiting'&&!mine?actions.joinRoom(room.code):actions.watchRoom(room.code,mine?'player':'spectator'));});
    if(!active.length&&!waiting.length)games.append(el('p','portal-muted','Aucune partie en cours. Crée un salon pour inviter tes partenaires.'));
  }
  function update(value){
    snapshot=value;renderOnlineExtras();
    const presenceKey=JSON.stringify(Object.values(value.presences||{}).filter(p=>p&&Date.now()-Number(p.lastSeen)<120000).map(p=>[p.playerId,p.roomCode,p.role]));
    const presenceChanged=presenceKey!==profilePresenceFingerprint;profilePresenceFingerprint=presenceKey;
    if(authenticated&&data&&!inScene&&(page==='home'||page==='profiles'&&presenceChanged))renderPage();
  }
  function refreshProfilePresence(){const key=JSON.stringify(Object.values(snapshot?.presences||{}).filter(p=>p&&Date.now()-Number(p.lastSeen)<120000).map(p=>[p.playerId,p.roomCode,p.role]));if(key!==profilePresenceFingerprint){profilePresenceFingerprint=key;renderPage();}}
  function onlineDot(){const dot=el('span','portal-profile-online-dot');dot.setAttribute('role','img');dot.setAttribute('aria-label','Connecté');dot.title='Connecté';return dot;}
  function activate(profile){
    if(authenticated)return;authenticated=true;profileId=profile.id;
    ui.hub.classList.add('portal-online-panel');lobbyHost.append(ui.hub);
    generalChat=createChatComposer({repository:chat,channel:CLUB_CHAT_CHANNEL,identity:()=>({...identity(),role:'lobby'}),canWrite,notify,audible:()=>!inScene});chatSlot.append(generalChat.root);
    stopData=physical.watch(value=>{const fingerprint=JSON.stringify(value);if(fingerprint===physicalFingerprint)return;physicalFingerprint=fingerprint;data=value;onData?.(value);updateCounts();
      if(page!=='online' && page!=='admin')renderPage();},error=>{dataStatus.textContent=`Chargement impossible : ${error.message}`;});
    stopStats=stats.watchSummary(value=>{summary=value;updateCounts();const fingerprint=JSON.stringify([value.history,value.stats]);if(fingerprint!==summaryFingerprint){summaryFingerprint=fingerprint;if(['home','ranking','profiles','history'].includes(page)&&!inScene)renderPage();}if(page==='admin'&&access.unlocked)renderOnlineAdmin();},error=>notify(error.message,'error'));
    open('home');
  }
  function renderPage(){
    if(page==='online')return;
    const target=pages.get(page);target.replaceChildren();if(!data){target.append(el('p','portal-muted','Chargement des données…'));return;}
    if(page==='home')renderHome(target);
    if(page==='ranking')renderRanking(target);
    if(page==='profiles')renderProfiles(target);
    if(page==='history')renderHistory(target);
    if(page==='admin')renderAdmin(target);
  }
  function rankings(){return clubRankings(data.players,data.history,summary.history,summary.stats);}
  function invitationCard(id, invitation){
    const line=el('article','portal-invitation');
    line.append(avatar({name:invitation.fromName,avatar:invitation.fromAvatar}));
    const copy=el('div');copy.append(el('strong','',`${invitation.fromName} t’invite`),el('p','portal-muted',invitationTitle(invitation)));
    const controls=el('div','portal-invitation-actions');
    controls.append(button('Voir l’invitation',()=>{
      const {dialog,cancel,show}=modal('Une place t’attend');
      dialog.classList.add('portal-invitation-dialog');cancel.textContent='Plus tard';
      dialog.append(avatar({name:invitation.fromName}),el('h3','',`${invitation.fromName} t’invite à sa table`),el('p','portal-muted',`${invitationTitle(invitation)} · Trois joueurs, une table privée.`));
      const accept=button('Accepter l’invitation',async()=>{accept.disabled=true;try{if(await actions.acceptInvite(id,invitation))dialog.close();}finally{accept.disabled=false;}},'online-action--primary');
      dialog.append(accept,cancel);show();
    },'online-action--small'),button('Accepter',()=>actions.acceptInvite(id,invitation),'online-action--primary online-action--small'),button('Refuser',()=>actions.declineInvite(id),'online-action--small'));
    line.append(copy,controls);return line;
  }
  function roomCard(room,label,action){
    const node=el('article','portal-room-card'),players=roomPlayers(room),strip=el('div','portal-room-portraits');
    for(const p of players){const seat=el('div');seat.append(avatar(p),el('span','',p.name));strip.append(seat);}
    for(let i=players.length;i<3;i++){const seat=el('div');seat.append(el('span','portal-empty-seat','+'),el('span','','Place libre'));strip.append(seat);}
    const enter=button(label,action,label==='Regarder'?'':'online-action--primary');if(label==='Rejoindre'&&players.length>=3)enter.disabled=true;
    node.append(el('span',`portal-status-pill ${room.status==='waiting'?'is-waiting':''}`,room.status==='waiting'?'En attente':label==='Reprendre'?'Ta partie · À reprendre':'Partie en cours'),el('h3','',loungeTitle(room)),el('p','portal-room-origin',loungeIdentity(room).territory),strip,el('p','portal-muted',`${players.length} / 3 joueurs · ${Object.keys(room.spectators||{}).length} spectateur(s)`),enter);
    return node;
  }
  function renderHome(target){
    const selfId=identity().profile?.id,me=data.players.find(p=>String(p.id)===String(selfId)),mine=rankings().general.find(p=>String(p.id)===String(selfId));
    const layout=el('div','portal-home-layout'),main=el('div','portal-home-main'),side=el('div','portal-home-side');
    const room=snapshot?.room,resumable=Boolean(room?.game),resume=card(resumable?'Retrouver ma partie':'Bienvenue au club');resume.classList.add('portal-resume-card');
    resume.append(el('p','portal-muted',resumable?`${loungeTitle(room)} · ${room.status==='finished'?'Partie terminée':'Partie en cours'}`:'Une table privée. Des partenaires familiers. À toi de jouer.'));
    const portraits=el('div','portal-hero-portraits');
    for(const player of (resumable?roomPlayers(room):[me,...data.players.filter(p=>String(p.id)!==String(selfId))].filter(Boolean).slice(0,3))){const seat=el('div');seat.append(avatar(player),el('strong','',player.name));portraits.append(seat);}
    resume.append(portraits,button(resumable?'Revenir à la table':'Rejoindre les salons',()=>resumable?showTable():open('online'),'online-action--primary'));
    const shortcuts=el('div','portal-home-shortcuts');
    for(const[id,label,detail]of [['online','Jouer en ligne','Retrouve les membres et les invitations.'],['ranking','Voir le classement','Tous les résultats du club.']]){const b=button('',()=>open(id),'portal-shortcut');b.append(navigationIcon(id),el('strong','',label),el('span','portal-muted',detail));shortcuts.append(b);}
    main.append(resume,shortcuts);
    const member=card(new Date().getHours()<18?'Bonjour':'Bonsoir');member.classList.add('portal-member-card');if(me)member.append(avatar(me),el('h3','',me.name),el('p','',`${mine?.vic||0} crédits de victoire · ${mine?.totalGames||0} résultat${mine?.totalGames===1?'':'s'}`),button('Voir mon profil',()=>{profileId=selfId;open('profiles');}));
    const invitations=card('Invitations'),valid=Object.entries(snapshot?.invitations||{}).filter(([,v])=>v&&(!v.createdAt||Date.now()-Number(v.createdAt)<3600000));
    paged(invitations,valid,'accueil invitations',1,([id,v])=>invitationCard(id,v));if(!valid.length)invitations.append(el('p','portal-muted','Aucune invitation pour le moment.'),button('Voir les salons',()=>open('online')));
    side.append(member,invitations);layout.append(main,side);target.append(layout);
    const connected=el('div','portal-connected-strip');connected.append(el('span','','En ligne :'));
    const live=new Map(Object.values(snapshot?.presences||{}).filter(p=>p&&Date.now()-Number(p.lastSeen)<120000).map(p=>[String(p.playerId),p]));
    for(const p of live.values()){const item=el('span','portal-connected-member');item.append(avatar(p),el('span','',p.name),el('i','portal-presence-dot'));connected.append(item);}if(!live.size)connected.append(el('span','portal-muted','Aucun autre membre connecté.'));target.append(connected);
    const table=el('div','portal-physical-strip'), seats=el('div','portal-current-table');
    for(const id of data.currentTable){const player=data.players.find(p=>String(p.id)===String(id));if(!player)continue;const place=el('div');place.append(avatar(player),el('strong','',player.name));seats.append(place);}
    if(!seats.children.length)seats.append(el('p','portal-muted','Aucune partie physique en cours.'));
    const controls=el('div','portal-actions'),cancel=button('Annuler',openCancelPhysical,'online-action--danger');cancel.disabled=!data.currentTable.length;controls.append(button('▶ Nouvelle Partie',openNewGame),button('✓ Fin de Manche',openRound),cancel);table.append(el('strong','','Club physique'),seats,controls);target.append(table);
  }
  function renderRanking(target){
    const section=card('Classement'),tabs=el('div','portal-ranking-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Type de classement');
    for(const[id,label]of [['general','Général'],['online','En ligne'],['physical','Club physique']]){const b=button(label,()=>{rankingMode=id;renderPage();pages.get('ranking').querySelector('[aria-selected="true"]').focus();});b.setAttribute('role','tab');b.id=`ranking-tab-${id}`;b.setAttribute('aria-controls','ranking-results');b.setAttribute('aria-selected',String(rankingMode===id));b.tabIndex=rankingMode===id?0:-1;b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const ids=['general','online','physical'],i=ids.indexOf(rankingMode);rankingMode=e.key==='Home'?ids[0]:e.key==='End'?ids[2]:ids[(i+(e.key==='ArrowRight'?1:2))%3];renderPage();pages.get('ranking').querySelector('[aria-selected="true"]').focus();});tabs.append(b);}
    const rows=rankings()[rankingMode],panel=el('div','portal-ranking-results');panel.id='ranking-results';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`ranking-tab-${rankingMode}`);
    const note=rankingMode==='general'?'Général = manches du club physique + parties complètes en ligne. Une victoire avec deux cochons vaut deux crédits, comme dans la V2. Les manches intermédiaires en ligne ne sont pas ajoutées.':rankingMode==='online'?'Parties complètes en ligne · Barème V2 conservé.':'Manches du club physique · Barème V2 conservé.';
    const podium=el('div','portal-podium');for(const index of [1,0,2]){const p=rows[index];if(!p||!p.totalGames)continue;const step=el('article',`portal-podium-place place-${index+1}`);step.append(el('span','portal-podium-rank',`#${index+1}`));if(!index)step.append(el('span','portal-podium-crown','♛'));step.append(avatar(p),el('h3','',p.name),el('p','',`${p.vic} crédit${p.vic>1?'s':''} de victoire`));podium.append(step);}panel.append(podium);
    panel.append(rows.length?rankingTable(rows,true,{selfId:identity().profile?.id,onDetails:p=>{profileId=p.id;open('profiles');}}):el('p','portal-muted','Aucun résultat enregistré.'));
    const help=button('ⓘ Comprendre le classement',()=>{const {dialog,cancel,show}=modal('Le barème du club');cancel.textContent='Fermer';dialog.append(el('p','',note),el('p','','Le classement conserve le tri V2 : taux de crédits de victoire, puis score (victoires moins cochons). Série : victoires consécutives par date. « — » indique un historique incomplet. Le taux peut dépasser 100 %.'),cancel);show();},'portal-ranking-help');panel.append(help);
    section.append(tabs,panel);target.append(section);
  }
  function renderProfiles(target){
    const section=el('section','portal-card portal-profile-detail');if(!data.players.length){section.append(el('p','','Aucun joueur.'));target.append(section);return;}
    const player=data.players.find(p=>String(p.id)===String(profileId))||data.players[0];profileId=player.id;
    const members=el('div','portal-players');members.setAttribute('aria-label','Les membres du club');for(const p of data.players){const tile=button('',()=>{profileId=p.id;renderPage();},'portal-player-card');tile.classList.toggle('is-chosen',String(p.id)===String(profileId));tile.setAttribute('aria-pressed',String(String(p.id)===String(profileId)));const available=Object.values(snapshot?.presences||{}).some(v=>v&&String(v.playerId)===String(p.id)&&Date.now()-Number(v.lastSeen)<120000),name=el('strong','',p.name);if(available)name.append(onlineDot());tile.append(avatar(p),name,el('span','portal-card-arrow','›'));members.append(tile);}target.append(members);
    const portrait=el('div','portal-profile-portrait');portrait.append(avatar(player));const heading=el('div','portal-profile-heading');heading.append(el('h2','',player.name),el('p','portal-profile-membership','Membre du club'));
    const presence=Object.values(snapshot?.presences||{}).find(p=>p&&String(p.playerId)===String(player.id)&&Date.now()-Number(p.lastSeen)<120000);
    if(presence)heading.querySelector('h2').append(onlineDot());
    const all=rankings(),general=all.general.find(p=>String(p.id)===String(player.id)),online=all.online.find(p=>String(p.id)===String(player.id)),details=profileDetails(player,data),metrics=el('div','portal-profile-metrics');
    for(const [icon,value,label]of [['domino',general?.totalGames||0,'résultats'],['trophy',general?.vic||0,'victoires'],['flame',general?.currentStreak??'—','de suite']]){const metric=el('div'),glyph=el('span','portal-metric-icon');glyph.append(navigationIcon(icon));metric.append(glyph,el('strong','',value),el('span','',label));metrics.append(metric);}
    const content=el('div','portal-profile-content');content.append(heading,metrics);
    const badges=el('div','portal-profile-badges');badges.append(el('span','',`☆ Record physique : ${details.record}`),el('span','','♙ Esprit du club'));content.append(badges);
    const isSelf=String(player.id)===String(identity().profile?.id);const invite=button(isSelf?'Voir mon classement':'Inviter à ma table',()=>isSelf?open('ranking'):actions.inviteProfile(player),'online-action--primary');invite.disabled=!isSelf&&(!presence||Boolean(presence.roomCode));invite.title=invite.disabled?'Le joueur doit être connecté et disponible.':'';content.append(invite);
    const facts=el('div','portal-profile-facts');facts.append(el('p','',`Club physique · ${player.totalGames||0} manches · ${player.vic||0} victoires · ${player.coch||0} cochons · ${player.saved||0} sauvé(s)`),el('p','',`En ligne · ${online?.totalGames||0} parties · ${online?.vic||0} victoires · ${online?.coch||0} cochons · ${online?.saved||0} sauvé(s)`),el('p','',`Taux physique : ${player.totalGames?Math.round(player.vic/player.totalGames*100):0}% · Score : ${(player.vic||0)-(player.coch||0)} · Cochon préféré : ${details.favoriteVictim} · Victime de : ${details.favoriteGiver}`));
    section.append(portrait,content,facts);target.append(section);
  }
  function renderHistory(target){
    const online=card('Historique des manches en ligne'),physical=card('Historique des manches physiques');online.classList.add('portal-history-column');physical.classList.add('portal-history-column');
    if(!summary.history.length)online.append(el('p','portal-muted','Aucune partie en ligne enregistrée.'));
    paged(online,summary.history,'historique en ligne',4,match=>{const node=el('article','portal-history-row'),description=historyDescription(match);node.append(el('p','portal-muted',`${formatMatchDate(match.endedAt)} · ${formatMatchDuration(match)}`),el('h3','',description.title),el('p','',description.detail));return node;});
    if(!data.history.length)physical.append(el('p','portal-muted','Aucune manche physique enregistrée.'));
    paged(physical,data.history,'historique physique',4,(match,index)=>physicalHistoryRow(match,index));target.append(online,physical);
  }
  function physicalHistoryRow(match,index){const node=el('article','portal-history-row'),names=(match.table||[]).map(id=>data.players.find(p=>String(p.id)===String(id))?.name||'Joueur supprimé');node.append(el('p','portal-muted',`${match.date||''} ${match.duration||''} · #${data.history.length-index}`),el('h3','',`${match.winner}`),el('p','',`${names.join(' · ')} — Cochons : ${match.cochon||'Aucun'}`));return node;}
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
  function openCancelPhysical(){if(!data.currentTable.length)return;const table=[...data.currentTable],version={head:data.history[0]||null,startedAt:data.matchStartTime};const {dialog,cancel,show}=modal('Annuler la partie physique ?');cancel.textContent='Conserver la partie';dialog.append(el('p','','Seule la table physique en cours sera fermée. Les manches enregistrées, les scores et les parties en ligne seront conservés.'));const commit=button('Confirmer l’annulation',()=>saveDialog(dialog,commit,()=>physical.cancel(table,version)),'online-action--danger');dialog.append(cancel,commit);show();}
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
    const adminTabs=el('nav','portal-admin-tabs');adminTabs.setAttribute('aria-label','Gestion du club');for(const [id,label]of [['players','Joueurs'],['physical','Manches physiques'],['online','Parties en ligne']]){const b=button(label,()=>{adminMode=id;renderPage();});b.setAttribute('aria-pressed',String(adminMode===id));adminTabs.append(b);}adminTabs.append(button('Reverrouiller',()=>{access.lock();renderPage();},'online-action--small'));target.append(adminTabs);
    if(adminMode==='physical'){const history=card('Corriger l’Historique (Suppression)');history.classList.add('portal-history-column');paged(history,data.history,'administration physique',4,(match,index)=>{const row=physicalHistoryRow(match,index);row.append(button('Supprimer cette manche',()=>confirmAction('Supprimer cette manche ?',`${match.date} · ${match.winner}. Les scores, séries et cochons seront recalculés. Une sauvegarde préalable est conservée.`,()=>physical.deleteHistory(match)),'online-action--danger online-action--small'));return row;});if(!data.history.length)history.append(el('p','portal-muted','Aucune manche.'));target.append(history);return;}
    if(adminMode==='online'){const slot=el('div','portal-admin-online');slot.id='portal-admin-online';target.append(slot);renderOnlineAdmin();return;}
    const editor=card('Ajouter / Modifier un Joueur');editor.classList.add('portal-player-editor');const picker=select('Sélectionner un joueur',[['new','— CRÉER UN NOUVEAU JOUEUR —'],...data.players.map(p=>[p.id,p.name])],editorId,id=>{editorId=id;renderPage();});editor.append(picker.field);
    const existing=data.players.find(p=>String(p.id)===String(editorId));let imageData=existing?.avatar||'❓';
    const nameLabel=el('label','online-label','Nom du Joueur'), name=el('input','online-input');name.value=displayName(existing?.name||'');name.maxLength=60;nameLabel.append(name);
    const avatarLabel=el('label','online-label','Avatar / Image / Émoji'), text=el('input','online-input');text.value=imageData.startsWith('data:image')?'':imageData;avatarLabel.append(text);const preview=el('div','portal-avatar-preview');const updatePreview=()=>preview.replaceChildren(avatar({name:name.value,avatar:imageData},{portrait:false}));updatePreview();text.addEventListener('input',()=>{imageData=text.value;updatePreview();});
    const fileLabel=el('label','online-label','Fichier'), file=el('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';fileLabel.append(file);
    file.addEventListener('change',async()=>{const selected=file.files[0];if(!selected)return;try{if(selected.size>10*1024*1024)throw new Error('Image limitée à 10 Mo.');const image=await createImageBitmap(selected);const factor=Math.min(1,120/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();imageData=canvas.toDataURL('image/jpeg',.7);text.value='';updatePreview();}catch(error){notify(error.message,'error');}});
    const save=button('Enregistrer le Joueur',async()=>{save.disabled=true;try{await physical.savePlayer({id:existing?.id??null,name:name.value,avatar:imageData,expected:existing});notify('Joueur enregistré.');editorId='new';renderPage();}catch(e){notify(e.message,'error');}finally{save.disabled=false;}},'online-action--primary');editor.append(nameLabel,avatarLabel,preview,fileLabel,save);
    if(existing)editor.append(button('Supprimer le joueur',()=>confirmAction('Supprimer ce joueur ?',`${existing.name} sera retiré des profils et de la table actuelle. Les anciennes manches restent conservées.`,async()=>{await physical.deletePlayer(existing);editorId='new';}),'online-action--danger'));
    target.append(editor);
  }
  function renderOnlineAdmin(){const slot=pages.get('admin').querySelector('#portal-admin-online');if(!slot||!access.unlocked)return;slot.replaceChildren();const rooms=card('Gérer les parties en ligne'), history=card('Historique en ligne');
    const entries=Object.entries(summary.rooms||{}).filter(([,r])=>r);paged(rooms,entries,'administration salons',4,([code,room])=>{const target={...room,code},title=loungeTitle(target),status={waiting:'En attente',playing:'En cours',finished:'Terminée',cancelled:'Annulée'}[room.status]||room.status;return row(`${title} · ${status} · ${roomPlayers(room).map(p=>p.name).join(', ')}`,room.status==='finished'?'Supprimer':'Annuler',()=>confirmAction('Confirmer la suppression de cette salle ?',`${title}. Son chat et ses interactions seront retirés. Une salle terminée perdra également son résultat ; les scores en ligne seront recalculés.`,()=>admin.removeRoom(roomDeletionTarget(target))));});
    if(!entries.length)rooms.append(el('p','portal-muted','Aucune salle.'));
    paged(history,summary.history,'administration résultats',4,match=>row(`${formatMatchDate(match.endedAt)} · ${historyDescription(match).title}`,'Supprimer le résultat',()=>confirmAction('Supprimer ce résultat en ligne ?','Le classement en ligne sera recalculé, sans toucher aux parties physiques.',()=>admin.removeHistory(match.matchId))));
    if(!summary.history.length)history.append(el('p','portal-muted','Aucun résultat.'));slot.append(rooms,history);
  }
  return {activate,open,showTable,update,get isScene(){return inScene;},get page(){return page;},get authenticated(){return authenticated;},dispose(){clearInterval(activityTimer);stopData?.();stopStats?.();generalChat?.dispose();chatDock.remove();root.remove();}};
}
