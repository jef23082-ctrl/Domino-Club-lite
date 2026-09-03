import { hasPlayableTile, playerKey, validSides } from '../game/engine.js';
import { roomPlayers } from '../game/room-state.js';
import { PLAYER_ASSETS } from '../config/player-assets.js?v=20260903T071755351';
import { OPPONENT_REACTIONS, SELF_EMOTIONS } from '../config/reactions.js';
import { renderBoard, renderHand, renderOpponentRack, renderPlayerPlaque } from '../ui/domino-renderer.js?v=20260903T071755351';
import { renderCharacterPlate } from '../ui/scene-renderer.js?v=20260903T071755351';
import { playSound, unlockSound } from '../ui/sound-player.js';
import { HandOrderStore, handOrderKey, moveHandTile } from '../ui/hand-order.js';
import { bindHandInteractions } from '../ui/hand-interactions.js';
import { ChatRepository } from '../services/chat-repository.js';
import { ClubChatSession, CLUB_CHAT_CHANNEL } from '../services/club-chat-session.js';
import { createFirebaseRuntime } from '../services/firebase-runtime.js';
import { InvitationRepository } from '../services/invitation-repository.js';
import { randomId } from '../services/ids.js';
import { authenticateProfile } from '../services/profile-auth.js';
import { PresenceService } from '../services/presence-service.js';
import { ProfileRepository } from '../services/profile-repository.js';
import { REACTION_COOLDOWN, REACTION_DURATION, ReactionRepository } from '../services/reaction-repository.js';
import { RoomRepository } from '../services/room-repository.js?v=20260903T071755351';
import { SessionStore } from '../services/session-store.js';
import { SpectatorService } from '../services/spectator-service.js?v=20260903T071755351';
import { StatsRepository } from '../services/stats-repository.js';
import { AdminAccess } from '../services/admin-access.js';
import { AdminRepository } from '../services/admin-repository.js?v=20260903T071755351';
import { createClubPortal } from '../ui/club-portal.js?v=20260903T071755351';
import { PhysicalClubRepository } from '../services/physical-club-repository.js?v=20260903T071755351';
import { renderChatMessage } from '../ui/chat-renderer.js';
import { ConnectionService } from '../services/connection-service.js';
import { characterIdForProfile } from './profile-map.js';
import { tileIntent } from './play-intent.js';
import { CLOCKWISE_SEATS as SEATS, seatedPlayers } from './seat-order.js';
import { displayName } from './display-name.js';
import { avatar } from '../ui/club-elements.js';
import { reactionPicker } from '../ui/reaction-picker.js';
import { premiumConfirm } from '../ui/premium-confirm.js';
import { loungeTitle } from './lounge-name.js';
import {
  actionKey,
  celebrationState,
  freshReaction,
  remainingTileCount,
  resultPresentation
} from './presentation.js?v=20260903T071755351';

const FIREBASE_SCRIPTS = Object.freeze([
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js'
]);

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = displayName(text);
  return element;
}

function loadScript(source) {
  if ([...document.scripts].some(script => script.src === source)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Impossible de charger Firebase.'));
    document.head.append(script);
  });
}

async function loadFirebase() {
  for (const source of FIREBASE_SCRIPTS) await loadScript(source);
}

function compactProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    avatar: String(profile.name || '?').trim().charAt(0).toUpperCase() || '?'
  };
}

function createShell() {
  const hub = node('aside', 'online-hub');
  hub.id = 'online-hub';
  hub.setAttribute('aria-label', 'Connexion et salons en ligne');
  const frame = node('div', 'online-hub__frame');
  const eyebrow = node('p', 'online-hub__eyebrow', 'Domino Club · Casino privé');
  const title = node('h1', 'online-hub__title', 'Partie en ligne');
  const status = node('p', 'online-hub__status', 'Connexion à Firebase…');
  status.id = 'online-status';
  const content = node('div', 'online-hub__content');
  content.id = 'online-content';
  frame.append(eyebrow, title, status, content);
  hub.append(frame);

  const menu = node('button', 'online-menu-button', '← Retour au menu');
  menu.id = 'online-menu-button';
  menu.type = 'button';
  menu.hidden = true;

  const toast = node('div', 'online-toast');
  toast.id = 'online-toast';
  toast.setAttribute('role', 'status');
  toast.hidden = true;

  const stage = document.querySelector('#casino-stage');
  const reactionLayer = node('div', 'online-reaction-layer');
  reactionLayer.id = 'online-reaction-layer';
  reactionLayer.setAttribute('aria-live', 'polite');
  const resultLayer = node('div', 'online-result-layer');
  resultLayer.id = 'online-result-layer';
  resultLayer.setAttribute('aria-live', 'polite');
  const actionLayer = node('div', 'online-action-layer');
  actionLayer.id = 'online-action-layer';
  stage.append(reactionLayer, resultLayer, actionLayer);

  document.querySelector('#game-shell').append(hub, menu, toast);
  const network = node('div', 'online-network', 'Connexion au serveur…');
  network.id = 'network-status'; network.setAttribute('role', 'status');
  document.querySelector('#game-shell').append(network);
  return { hub, content, status, menu, toast, network, reactionLayer, resultLayer, actionLayer };
}

export async function initOnlineApp({ runtime: suppliedRuntime = null, session: suppliedSession = null, adminAccess: suppliedAdminAccess = null } = {}) {
  const ui = createShell();
  const state = {
    view: 'loading', profiles: [], profile: null, networkProfile: null, enterSceneOnStart: false,
    clientToken: '', roomCode: '', role: 'player', room: null,
    rooms: {}, presences: {}, invitations: {}, selectedTileId: '',
    openReactionPlayerId: '', activeReaction: null, reactionCooldownUntil: 0,
    renderedReactionId: '', renderedActionKey: '', renderedCelebrationKey: '', lastTurnId: null,
    recordedMatchIds: new Set(), chatBoundAt: 0,
    stopRoom: null, stopRooms: null, stopPresence: null, stopInvitations: null,
    stopChat: null, stopTyping: null, typingTimer: null, stopReactions: null, reactionTimer: null, celebrationTimer: null
  };
  let repositories;
  let toastTimer;
  let handOrder;
  let handInteractions;
  let handContextKey = '';
  let portal;
  let connection;
  let pendingPlay = false;
  let invitePending = false;

  function canWrite(showError = true) {
    try { connection.require(); return true; }
    catch (error) { if (showError) toast(error.message, 'error'); return false; }
  }

  async function playAction(action) {
    if (!canWrite() || pendingPlay) return;
    pendingPlay = true;
    renderLiveHand();
    try { await action(); }
    catch (error) { toast(error.message, 'error'); }
    finally { pendingPlay = false; renderLiveHand(); }
  }



  function setStatus(message) {
    ui.status.textContent = displayName(message);
  }

  function toast(message, tone = 'gold') {
    clearTimeout(toastTimer);
    ui.toast.textContent = displayName(message);
    ui.toast.dataset.tone = tone;
    ui.toast.hidden = false;
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 3600);
  }

  function showHub(show = true) {
    ui.hub.hidden = !show;
    document.querySelector('#casino-stage')?.classList.toggle('is-online-dimmed', show && !portal?.authenticated);
  }

  function clearContent() {
    ui.content.replaceChildren();
  }

  function actionButton(label, className = 'online-action') {
    const button = node('button', className, label);
    button.type = 'button';
    return button;
  }

  function ensureClientToken(session) {
    if (!session.clientToken) session.clientToken = randomId(20);
    return session.clientToken;
  }

  function myRoomPlayer(room = state.room) {
    if (state.role === 'spectator') return null;
    return roomPlayers(room).find(player => player.token === state.clientToken) || null;
  }

  function isHost(room = state.room) {
    return Boolean(room && room.hostToken === state.clientToken);
  }

  function isCreator(room = state.room) {
    return Boolean(room && (room.creatorToken || room.hostToken) === state.clientToken);
  }

  function livePresences() {
    const seen = new Map();
    for (const item of Object.values(state.presences || {}).filter(item => item && Date.now() - Number(item.lastSeen || 0) < 120000)) {
      const key = String(item.playerId);
      if (!seen.has(key) || Number(item.lastSeen) > Number(seen.get(key).lastSeen)) seen.set(key, item);
    }
    return [...seen.values()];
  }

  function stopRoomBindings() {
    handInteractions?.cancel();
    handContextKey = '';
    state.selectedTileId = '';
    state.stopRoom?.();
    state.stopRoom = null;
    state.stopChat?.();
    state.stopChat = null;
    state.stopTyping?.(); state.stopTyping = null;
    clearInterval(state.typingTimer); state.typingTimer = null;
    document.querySelector('#scene-typing').textContent = '';
    state.stopReactions?.();
    state.stopReactions = null;
    clearTimeout(state.reactionTimer);
    clearTimeout(state.celebrationTimer);
    state.activeReaction = null;
    state.openReactionPlayerId = '';
    state.renderedReactionId = '';
    ui.reactionLayer.replaceChildren();
    ui.resultLayer.replaceChildren();
    ui.actionLayer.replaceChildren();
  }

  async function returnToLobby(message) {
    stopRoomBindings();
    await repositories.spectators.clear();
    state.roomCode = '';
    state.room = null;
    state.role = 'player';
    repositories.session.clearRoom();
    await repositories.presence.updateRoom('', 'lobby');
    ui.menu.hidden = true;
    if (message) toast(message);
    renderLobby();
    portal?.update(state);
    portal?.open('online');
  }

  function renderLogin() {
    state.view = 'login';
    showHub(true);
    ui.menu.hidden = true;
    setStatus('Identifie-toi avec ton accès habituel de la V2.');
    clearContent();
    const form = node('form', 'online-form');
    const label = node('label', 'online-label', 'Mot de passe joueur');
    const input = node('input', 'online-input');
    input.type = 'password';
    input.placeholder = 'prénom++';
    input.autocomplete = 'current-password';
    label.append(input);
    const error = node('p', 'online-error');
    error.hidden = true;
    const submit = actionButton('Entrer dans le club', 'online-action online-action--primary');
    submit.type = 'submit';
    form.append(label, error, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!canWrite()) return;
      const profile = authenticateProfile(state.profiles, input.value);
      if (!profile) {
        error.textContent = 'Accès non reconnu.';
        error.hidden = false;
        return;
      }
      try { await completeLogin(profile); } catch (failure) {error.textContent=failure.message;error.hidden=false;}
    });
    ui.content.append(form);
    input.focus();
  }

  async function completeLogin(profile, restored = false) {
    state.profile = profile;
    state.networkProfile = compactProfile(profile);
    repositories.session.playerId = profile.id;
    await repositories.presence.connect({
      clientToken: state.clientToken,
      profile: state.networkProfile,
      role: 'lobby'
    });
    bindLobbyFeeds();
    portal.activate(profile);
    portal.update(state);
    if (!restored) toast(`Bienvenue ${profile.name}`);
    const savedRoom = repositories.session.room;
    if (savedRoom.code) attachRoom(savedRoom.code, savedRoom.role, true);
    else renderLobby();
  }

  function bindLobbyFeeds() {
    if (!state.stopRooms) state.stopRooms = repositories.rooms.watchAll(value => {
      state.rooms = value; portal?.update(state);
    }, error => toast(error.message, 'error'));
    if (!state.stopPresence) state.stopPresence = repositories.presence.watch(value => {
      state.presences = value; portal?.update(state);
      if (state.view === 'lobby') setStatus(`${state.profile.name} · ${livePresences().length} joueur(s) connecté(s)`);
      if (state.view === 'waiting' && portal?.page === 'online') renderWaitingRoom();
    }, error => toast(error.message, 'error'));
    state.stopInvitations?.();
    let initialized = false;
    state.stopInvitations = repositories.invitations.watch(state.profile.id, value => {
      const previous = new Set(Object.keys(state.invitations || {}));
      if (initialized && Object.entries(value).some(([id,item]) => !previous.has(id) && (!item.createdAt || Date.now()-Number(item.createdAt)<3600000))) {
        toast('Tu as reçu une invitation. Retrouve-la dans En ligne.'); playSound('message');
      }
      initialized = true; state.invitations = value; portal?.update(state);
    }, error => toast(error.message, 'error'));
  }

  async function acceptInvite(id, invitation) {
    if (!canWrite()) return;
    if (state.room && ['playing', 'waiting'].includes(state.room.status) && state.role === 'player' && state.roomCode !== invitation.roomCode) return toast('Quitte ta salle d’attente ou termine ta partie avant de rejoindre une autre salle.', 'error');
    try {
      await repositories.rooms.join(invitation.roomCode, { profile: state.networkProfile, clientToken: state.clientToken });
      await repositories.invitations.remove(state.profile.id, id);
      await attachRoom(invitation.roomCode, 'player');
      return true;
    } catch (error) { toast(error.message, 'error'); return false; }
  }

  function renderLobby() {
    state.view = 'lobby';
    ui.hub.dataset.view = 'lobby';
    showHub(true);
    ui.menu.hidden = true;
    setStatus(`${state.profile.name} · ${livePresences().length} joueur(s) connecté(s)`);
    clearContent();

    const actions = node('div', 'online-lobby-actions');
    const create = actionButton('Créer une salle', 'online-action online-action--primary');
    create.addEventListener('click', async () => {
      if (!canWrite()) return;
      create.disabled = true;
      try {
        const code = await repositories.rooms.create({
          profile: state.networkProfile, clientToken: state.clientToken
        });
        await attachRoom(code, 'player');
      } catch (error) {
        toast(error.message, 'error');
        create.disabled = false;
      }
    });

    const identityCard = node('section', 'portal-lobby-card');
    identityCard.append(node('h2', 'online-section__title', 'Ton identité'), node('p', 'online-summary', state.profile.name), create);
    actions.append(identityCard);
    ui.content.append(actions);

  }

  function renderCurrentPanel() {
    if (!state.room) renderLobby();
    else if (state.room?.status === 'waiting') renderWaitingRoom();
    else if (state.room) renderPlayingPanel();
  }

  function renderWaitingRoom() {
    state.view = 'waiting';
    ui.hub.dataset.view = 'waiting';
    showHub(true);
    ui.menu.hidden = true;
    const players = roomPlayers(state.room);
    setStatus(`${loungeTitle(state.room)} · ${players.length}/3 joueurs`);
    clearContent();
    const name = node('div', 'online-room-name', loungeTitle(state.room));
    const list = node('ol', 'online-player-list');
    for (const player of players) {
      const seat=node('li','');seat.append(avatar(player),node('strong','',`${player.name}${player.isHost ? ' · hôte' : ''}`));list.append(seat);
    }
    for (let index = players.length; index < 3; index++) list.append(node('li', 'portal-muted', 'Place disponible'));
    ui.content.append(node('h2', 'online-section__title', 'En attente des joueurs'), name, list);

    const controls = node('div', 'online-controls');
    if (isHost()) {
      const start = actionButton('Lancer la partie', 'online-action online-action--primary');
      start.disabled = players.length !== 3;
      start.addEventListener('click', async () => {
      if (!canWrite()) return;
        try {
          await repositories.rooms.start(state.roomCode, {
            clientToken: state.clientToken, matchId: randomId(16)
          });
        } catch (error) { toast(error.message, 'error'); }
      });
      controls.append(start);
    }
    const leave = actionButton('Quitter la salle');
    leave.addEventListener('click', async () => {
      if (!canWrite()) return;
      try {
        await repositories.rooms.leaveWaiting(state.roomCode, {
          playerId: state.profile.id, clientToken: state.clientToken
        });
        await returnToLobby();
      } catch (error) { toast(error.message, 'error'); }
    });
    controls.append(leave);
    if (isCreator()) {
      const cancel = actionButton('Annuler la partie', 'online-action online-action--danger');
      cancel.addEventListener('click', async () => {
        const code=state.roomCode;
        if (!canWrite() || !await premiumConfirm('Annuler ce salon ?', 'Cette annulation concerne tous les joueurs présents.')) return;
        if(code!==state.roomCode||state.room?.status!=='waiting')return toast('Le salon a changé. Vérifie son état avant de réessayer.','error');
        try { await repositories.rooms.cancel(code, { clientToken: state.clientToken, creatorName: state.profile.name }); }
        catch (error) { toast(error.message, 'error'); }
      });
      controls.append(cancel);
    }
    ui.content.append(controls);

    if (isHost()) {
      const currentIds = new Set(players.map(player => String(player.playerId)));
      const targets = livePresences().filter(item => !item.roomCode && !currentIds.has(String(item.playerId)));
      if (targets.length) {
        const inviteSection = node('details', 'online-section online-invite-chooser');
        inviteSection.append(node('summary', 'online-action', 'Inviter un joueur connecté'));
        const inviteOptions = node('div', 'online-invite-options');inviteSection.append(inviteOptions);
        for (const target of targets) {
          const row = node('div', 'online-row');
          row.append(avatar(target),node('span', '', target.name));
          const invite = actionButton('Inviter', 'online-action online-action--small');
          invite.addEventListener('click', async () => {
      if (!canWrite()) return;
            try {
              await repositories.invitations.send({
                roomCode: state.roomCode, fromProfile: state.networkProfile, toPlayerId: target.playerId, roomTitle: loungeTitle(state.room)
              });
              toast(`Invitation envoyée à ${target.name}`);
            } catch (error) { toast(error.message, 'error'); }
          });
          row.append(invite);
          inviteOptions.append(row);
        }
        ui.content.append(inviteSection);
      } else ui.content.append(node('p', 'portal-muted', 'Aucun autre joueur disponible à inviter.'));
    }
  }

  function renderPlayingPanel() {
    ui.hub.dataset.view = 'playing';
    showHub(true);
    clearContent();
    setStatus(`${state.role === 'spectator' ? 'Spectateur' : 'Joueur'} · ${loungeTitle(state.room)}`);
    const players = node('p', 'online-summary', roomPlayers(state.room).map(player => player.name).join(' · '));
    const close = actionButton('Revenir à la table', 'online-action online-action--primary');
    close.addEventListener('click', () => portal.showTable());
    ui.content.append(players, close);
    const leave = actionButton('Quitter');
    leave.addEventListener('click', () => {
      if (state.role === 'spectator' || state.room?.status === 'finished') returnToLobby('Salle quittée.');
      else { portal.open('home'); toast('La partie reste en cours et pourra être reprise depuis En ligne.'); }
    });
    ui.content.append(leave);
    if (state.room?.status === 'playing' && isCreator()) {
      const cancel = actionButton('Annuler la partie', 'online-action online-action--danger');
      cancel.addEventListener('click', async () => {
        const code=state.roomCode,matchId=state.room?.matchId;
        if (!canWrite() || !await premiumConfirm('Annuler cette partie ?', 'La partie sera arrêtée pour tous les joueurs. Pour revenir au menu en conservant ta place, ferme cette fenêtre.')) return;
        if(code!==state.roomCode||matchId!==state.room?.matchId||state.room?.status!=='playing')return toast('La partie a changé. Vérifie son état avant de réessayer.','error');
        try { await repositories.rooms.cancel(code, { clientToken: state.clientToken, creatorName: state.profile.name }); }
        catch (error) { toast(error.message, 'error'); }
      });
      ui.content.append(cancel);
    }
  }

  function bindChat() {
    const roomCode=CLUB_CHAT_CHANNEL;
    state.stopChat?.();
    const messages = new Map();
    const container = document.querySelector('.chat-messages');
    container.replaceChildren();
    state.chatBoundAt = Date.now();
    const render = () => {
      container.replaceChildren();
      for (const message of [...messages.values()].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))) {
        container.append(renderChatMessage(message));
      }
      container.scrollTop = container.scrollHeight;
    };
    state.stopChat = repositories.chat.watch(roomCode, {
      added: message => {
        messages.set(message.id, message);
        render();
        if (!document.querySelector('#game-shell').hidden && Number(message.createdAt || 0) >= state.chatBoundAt - 800 && message.senderToken !== state.clientToken) {
          playSound('message');
        }
      },
      changed: message => { messages.set(message.id, message); render(); },
      removed: id => { messages.delete(id); render(); },
      error: error => toast(error.message, 'error')
    });
    state.stopTyping?.(); clearInterval(state.typingTimer);
    let typingEntries = {};
    const renderTyping = () => {
      const names = Object.entries(typingEntries).filter(([token,item]) => item && token !== state.clientToken && Date.now()-Number(item.at)<6000).map(([,item]) => item.name);
      document.querySelector('#scene-typing').textContent = names.length ? `${names.join(', ')} écrit…` : '';
    };
    state.stopTyping = repositories.chat.watchTyping(roomCode, value => { typingEntries = value; renderTyping(); });
    state.typingTimer = setInterval(renderTyping, 1000);
  }

  function seatForPlayer(playerId, room = state.room) {
    const index = seatedPlayers(room).findIndex(player => String(player.playerId) === String(playerId));
    return index >= 0 ? SEATS[index] : '';
  }

  function reactionMeta(reaction) {
    return reaction?.kind === 'emotion'
      ? SELF_EMOTIONS[reaction.effect]
      : OPPONENT_REACTIONS[reaction?.effect];
  }

  function closeReactionMenu() {
    const playerId=state.openReactionPlayerId;
    const focused=ui.actionLayer.contains(document.activeElement);
    state.openReactionPlayerId = '';
    ui.actionLayer.replaceChildren();
    if(focused)document.querySelector(`#seat-${seatForPlayer(playerId)}`)?.focus({preventScroll:true});
  }

  async function sendReaction(kind, effect, target) {
    if (!canWrite()) return;
    const me = myRoomPlayer();
    if (!me || !target || state.role !== 'player' || state.room?.status !== 'playing' || state.room.game?.roundStatus !== 'playing') return;
    const allowed = kind === 'emotion' ? SELF_EMOTIONS : OPPONENT_REACTIONS;
    if (!allowed[effect]) return;
    if (kind === 'emotion' && String(target.playerId) !== String(me.playerId)) return;
    if (kind === 'opponent' && String(target.playerId) === String(me.playerId)) return;
    if (Date.now() < state.reactionCooldownUntil) {
      toast('Attends un instant avant une nouvelle réaction.', 'error');
      return;
    }
    state.reactionCooldownUntil = Date.now() + REACTION_COOLDOWN;
    closeReactionMenu();
    try {
      await repositories.reactions.send(state.roomCode, {
        kind, effect, sender: me, target, clientToken: state.clientToken
      });
    } catch (error) {
      state.reactionCooldownUntil = 0;
      toast(error.message || 'Réaction impossible.', 'error');
    }
  }

  function renderReactionMenu(player) {
    ui.actionLayer.replaceChildren();
    if (!player || state.role !== 'player' || state.room?.status !== 'playing' || state.room?.game?.roundStatus !== 'playing') return;
    const me = myRoomPlayer();
    if (!me) return;
    const mine = String(me.playerId) === String(player.playerId);
    const actions = mine ? SELF_EMOTIONS : OPPONENT_REACTIONS;
    const menu=reactionPicker({mine,player,sender:me,actions,onClose:closeReactionMenu,onSend:effect=>sendReaction(mine?'emotion':'opponent',effect,player)});
    ui.actionLayer.append(menu);
    menu.querySelector('button').focus({preventScroll:true});
  }

  function renderReaction(reaction = state.activeReaction) {
    clearTimeout(state.reactionTimer);
    ui.reactionLayer.replaceChildren();
    document.querySelectorAll('.seat-emotion').forEach(badge => badge.remove());
    document.querySelectorAll('.player-seat').forEach(seat => seat.classList.remove('has-emotion'));
    const fresh = freshReaction(reaction, Date.now(), REACTION_DURATION);
    if (!fresh) {
      state.activeReaction = null;
      state.renderedReactionId = '';
      return;
    }
    state.activeReaction = fresh;
    const meta = reactionMeta(fresh);
    if (!meta) return;
    const targetSeatName = seatForPlayer(fresh.targetId);
    const targetSeat = document.querySelector(`#seat-${targetSeatName}`);
    if (!targetSeat) return;

    if (fresh.kind === 'emotion') {
      targetSeat.classList.add('has-emotion');
      const badge = node('div', `seat-emotion effect-${fresh.effect}`);
      badge.append(node('span', 'seat-emotion__icon', meta.icon), node('strong', '', meta.label));
      targetSeat.append(badge);
    } else {
      const sourceSeatName = seatForPlayer(fresh.senderId);
      const sourceSeat = document.querySelector(`#seat-${sourceSeatName}`);
      const stage = document.querySelector('#casino-stage');
      if (sourceSeat && stage) {
        const stageRect = stage.getBoundingClientRect();
        const sourceRect = sourceSeat.getBoundingClientRect();
        const targetRect = targetSeat.getBoundingClientRect();
        const fromX = sourceRect.left + sourceRect.width / 2 - stageRect.left;
        const fromY = sourceRect.top + sourceRect.height * .34 - stageRect.top;
        const toX = targetRect.left + targetRect.width / 2 - stageRect.left;
        const toY = targetRect.top + targetRect.height * .36 - stageRect.top;
        const projectile = node('div', `reaction-projectile effect-${fresh.effect}`, meta.icon);
        projectile.style.setProperty('--from-x', `${fromX}px`);
        projectile.style.setProperty('--from-y', `${fromY}px`);
        projectile.style.setProperty('--travel-x', `${toX - fromX}px`);
        projectile.style.setProperty('--travel-y', `${toY - fromY}px`);
        projectile.style.animationDelay = `${-fresh.elapsed / 1000}s`;
        const impact = node('div', `reaction-impact effect-${fresh.effect}`);
        impact.style.left = `${toX}px`;
        impact.style.top = `${toY}px`;
        impact.style.animationDelay = `${.76 - fresh.elapsed / 1000}s`;
        const copy = node('div', 'reaction-impact__copy');
        const sender = fresh.senderName || roomPlayers(state.room).find(p => String(p.playerId) === String(fresh.senderId))?.name || 'Un joueur';
        copy.append(node('small', 'reaction-impact__sender', `${sender} → ${fresh.targetName || roomPlayers(state.room).find(p => String(p.playerId) === String(fresh.targetId))?.name || 'toi'}`), node('strong', '', meta.label));
        impact.append(node('span', 'reaction-impact__icon', meta.icon), copy);
        ui.reactionLayer.append(projectile, impact);
      }
    }
    const reactionId = String(fresh.id || `${fresh.at}_${fresh.effect}_${fresh.targetId}`);
    if (state.renderedReactionId !== reactionId) {
      state.renderedReactionId = reactionId;
      playSound(`reaction-${fresh.effect}`);
    }
    state.reactionTimer = setTimeout(() => renderReaction(null), fresh.remaining + 40);
  }

  function bindReactions(roomCode) {
    state.stopReactions?.();
    state.stopReactions = repositories.reactions.watch(roomCode, reaction => {
      state.activeReaction = reaction;
      renderReaction(reaction);
    }, error => toast(error.message, 'error'));
  }

  function renderLastAction(game) {
    const currentKey = actionKey(game?.lastAction);
    if (!currentKey || currentKey === state.renderedActionKey) return;
    state.renderedActionKey = currentKey;
    const action = game.lastAction;
    if (Date.now() - Number(action.at || 0) > 5000) return;
    if (action.type === 'play') {
      const tile = [...document.querySelectorAll('.board-domino')].find(item => item.dataset.tileId === action.tileId);
      tile?.classList.add('is-just-played');
      playSound('placement');
    } else if (action.type === 'pass') {
      const seatName = seatForPlayer(action.playerId);
      const seat = document.querySelector(`#seat-${seatName}`);
      const bubble = node('div', 'pass-bubble', 'BOUDÉÉÉ !');
      seat?.append(bubble);
      setTimeout(() => bubble.remove(), 2300);
      playSound('pass');
    }
  }

  function renderOutcomeBadges(room) {
    document.querySelectorAll('.seat-crown, .seat-pig').forEach(badge => badge.remove());
    const result = room.game?.matchResult;
    const celebration = celebrationState(room);
    if (celebration?.winnerId !== null && celebration?.winnerId !== undefined) {
      const seat = document.querySelector(`#seat-${seatForPlayer(celebration.winnerId, room)}`);
      seat?.append(node('span', result?.type === 'victory' ? 'seat-crown is-final' : 'seat-crown', '♛'));
    }
    if (result?.type === 'victory') {
      (result.cochonIds || []).forEach(playerId => {
        document.querySelector(`#seat-${seatForPlayer(playerId, room)}`)?.append(node('span', 'seat-pig', '🐷'));
      });
    }
  }

  function scoreText(room, scores) {
    return roomPlayers(room).map(player => `${player.name} ${Number(scores?.[playerKey(player.playerId)] || 0)}`).join(' · ');
  }

  function renderResult(room) {
    clearTimeout(state.celebrationTimer);
    ui.resultLayer.replaceChildren();
    const presentation = resultPresentation(room);
    if (!presentation) return;
    const celebration = celebrationState(room);
    const card = node('section', `online-result-card ${presentation.kind}`);
    const icon = node('span', 'online-result-card__icon', presentation.icon);
    const winner=roomPlayers(room).find(p=>String(p.playerId)===String(celebration?.winnerId));
    if(winner){icon.replaceChildren(avatar(winner),node('span','result-crown',presentation.icon));}
    const copy = node('div', 'online-result-card__copy');
    copy.append(node('strong', '', presentation.title), node('span', '', presentation.detail));
    copy.append(node('small', '', scoreText(room, room.game?.matchResult?.scores || room.game?.roundWins)));
    const action = actionButton(presentation.actionLabel, 'online-result-card__action');
    const remaining = Number(celebration?.remaining || 0);
    if(remaining>0&&winner&&state.dismissedCelebrationKey!==celebration.key){
      card.classList.add('is-ceremony');
      const dismiss=actionButton('×','online-result-dismiss');dismiss.setAttribute('aria-label','Revoir la table');
      dismiss.addEventListener('click',()=>{state.dismissedCelebrationKey=celebration.key;renderResult(state.room);});card.append(dismiss);
    }
    const scores=node('div','online-result-scores');
    for(const player of roomPlayers(room)){
      const row=node('div','');row.append(node('span','',player.name),node('strong','',Number((room.game.matchResult?.scores||room.game.roundWins)?.[playerKey(player.playerId)]||0)));
      if((room.game.matchResult?.cochonIds||[]).some(id=>String(id)===String(player.playerId)))row.append(node('span','', '🐷'));
      scores.append(row);
    }
    copy.append(scores);
    action.disabled = remaining > 0;
    action.textContent = remaining > 0 ? `Cérémonie · ${Math.max(1, Math.ceil(remaining / 1000))} s` : presentation.actionLabel;
    action.addEventListener('click', async () => {
      if (!canWrite()) return;
      action.disabled = true;
      try {
        if (presentation.action === 'rematch') {
          await repositories.stats.record(room);
          await repositories.rooms.rematch(state.roomCode, {
            clientToken: state.clientToken, matchId: randomId(16)
          });
        } else {
          await repositories.rooms.nextRound(state.roomCode, {});
        }
      } catch (error) {
        toast(error.message, 'error');
        action.disabled = false;
      }
    });
    card.append(icon, copy);
    const controls=node('div','online-result-controls');
    if (state.role === 'player') controls.append(action);
    const back=actionButton('Retour au salon','online-result-card__action online-result-card__back');back.addEventListener('click',()=>portal.open('online'));controls.append(back);card.append(controls);
    ui.resultLayer.append(card);
    renderOutcomeBadges(room);

    if (celebration && remaining > 0 && state.renderedCelebrationKey !== celebration.key) {
      state.renderedCelebrationKey = celebration.key;
      playSound('victory');
      if (celebration.type === 'match' && celebration.cochonIds.length) {
        setTimeout(() => { if (state.room?.matchId === room.matchId) playSound('pig'); }, 720);
      }
    }
    if (remaining > 0) state.celebrationTimer = setTimeout(() => renderResult(state.room), remaining + 70);
  }

  function ensureResultRecorded(room) {
    const matchId = room?.matchId;
    if (!connection?.connected || room?.status !== 'finished' || !room.game?.matchResult || !matchId || state.recordedMatchIds.has(matchId)) return;
    state.recordedMatchIds.add(matchId);
    repositories.stats.record(room).catch(error => {
      state.recordedMatchIds.delete(matchId);
      toast(`Historique non enregistré : ${error.message}`, 'error');
    });
  }

  function handSnapshot(room = state.room) {
    const me = myRoomPlayer(room);
    const key = me ? handOrderKey(room, me.playerId) : '';
    const hand = key ? handOrder.ordered(key, room?.game?.hands?.[playerKey(me.playerId)] || []) : [];
    return { key, hand, enabled: Boolean(me && room?.status === 'playing' && room?.game?.roundStatus === 'playing' && hand.length > 1) };
  }

  function renderLiveHand(room = state.room) {
    const game = room?.game || {};
    const me = myRoomPlayer(room);
    const snapshot = handSnapshot(room);
    handInteractions?.reconcile(snapshot);
    if (handContextKey !== snapshot.key || !snapshot.hand.includes(state.selectedTileId)) state.selectedTileId = '';
    handContextKey = snapshot.key;
    const container = document.querySelector('#player-hand');
    container.title = 'Glissez un domino pour ranger la main · Alt + flèches au clavier';
    renderHand(container, snapshot.hand);
    container.querySelectorAll('.hand-domino').forEach(tile => {
      const selected = tile.dataset.tileId === state.selectedTileId;
      tile.classList.toggle('is-selected', selected);
      tile.setAttribute('aria-pressed', String(selected));
      tile.setAttribute('aria-describedby', 'hand-reorder-hint');
      tile.setAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight');
      const intent = tileIntent(game, tile.dataset.tileId);
      tile.classList.toggle('is-unplayable', room?.status === 'playing' && game.roundStatus === 'playing' && !intent.playable);
      tile.title = !intent.playable ? 'Non jouable — peut être rangé' : intent.automaticSide ? 'Un clic pour jouer — glisser pour ranger' : 'Sélectionner puis choisir gauche ou droite — glisser pour ranger';
    });
    document.querySelector('.hand-dock').setAttribute('aria-label', me ? `Main de ${me.name}` : 'Vue spectateur');
    const canAct = Boolean(connection?.connected && !pendingPlay && me && room?.status === 'playing' && game.roundStatus === 'playing' && String(game.currentTurnId) === String(me.playerId));
    const openingAllowed = Boolean(game.board?.placements?.length || !game.forcedOpeningTileId || state.selectedTileId === game.forcedOpeningTileId);
    const sides = canAct && state.selectedTileId && openingAllowed ? validSides(state.selectedTileId, game.board) : [];
    document.querySelector('#play-left').disabled = !sides.includes('left');
    document.querySelector('#play-right').disabled = !sides.includes('right');
    document.querySelector('#pass-button').disabled = !canAct || hasPlayableTile(game, me?.playerId);
    document.querySelector('#pass-button').hidden = room?.status !== 'playing' || game.roundStatus !== 'playing';
    return canAct;
  }

  function renderLiveScene(room) {
    const players = seatedPlayers(room);
    const game = room.game || {};
    SEATS.forEach((seatName, index) => {
      const seat = document.querySelector(`#seat-${seatName}`);
      const image = document.querySelector(`#character-${seatName}`);
      seat.replaceChildren();
      const player = players[index];
      if (!player) {
        image.style.opacity = '0';
        delete seat.dataset.playerId;
        return;
      }
      seat.dataset.playerId = String(player.playerId);
      seat.tabIndex = state.role === 'player' ? 0 : -1;
      seat.setAttribute('aria-label', `${displayName(player.name)} · ouvrir les interactions`);
      image.style.opacity = '1';
      const characterId = characterIdForProfile(player);
      renderCharacterPlate(seatName, characterId);
      const count = remainingTileCount(room, playerKey(player.playerId));
      const active = room.status === 'playing' && game.roundStatus === 'playing' && String(game.currentTurnId) === String(player.playerId);
      renderPlayerPlaque(seat, {
        name: player.name || PLAYER_ASSETS[characterId].displayName,
        rounds: Number(game.roundWins?.[playerKey(player.playerId)] || 0),
        tiles: count,
        active
      });
      seat.classList.toggle('is-active', active);
      renderOpponentRack(seat, count);
    });

    renderBoard(document.querySelector('#domino-board'), game.board || { placements: [] });
    const canAct = renderLiveHand(room);

    const turn = players.find(player => String(player.playerId) === String(game.currentTurnId));
    document.querySelector('.turn-banner span').textContent = room.status === 'finished'
      ? 'Partie terminée'
      : game.roundStatus === 'ended' ? 'Fin de la manche' : turn ? `Tour de ${displayName(turn.name)}` : 'En attente';
    if (canAct && state.lastTurnId !== String(game.currentTurnId)) playSound('turn');
    state.lastTurnId = String(game.currentTurnId ?? '');
    if (room.status !== 'playing' || game.roundStatus !== 'playing') closeReactionMenu();
    renderLastAction(game);
    renderResult(room);
    renderReaction(state.activeReaction);
    ensureResultRecorded(room);
  }

  async function attachRoom(code, role = 'player', restored = false) {
    if (!canWrite()) return;
    if (state.room && ['playing', 'waiting'].includes(state.room.status) && state.role === 'player' && String(code).toUpperCase() !== state.roomCode) {
      return toast('Termine ta partie actuelle avant de changer de salle.', 'error');
    }
    state.enterSceneOnStart = !restored;
    stopRoomBindings();
    await repositories.spectators.clear();
    state.roomCode = String(code || '').toUpperCase();
    state.role = role;
    state.room = null;
    repositories.session.setRoom(state.roomCode, role);
    await repositories.presence.updateRoom(state.roomCode, role);
    if (role === 'spectator') await repositories.spectators.register(state.roomCode, state.clientToken, state.networkProfile);
    state.view = 'loading-room';
    showHub(true);
    setStatus('Connexion à la salle…');
    clearContent();
    if (!restored) portal.open('online');
    state.stopRoom = repositories.rooms.watch(state.roomCode, room => {
      if (!room || room.status === 'cancelled') {
        returnToLobby(room?.cancelledBy?.name ? `Partie annulée par ${room.cancelledBy.name}.` : 'Salle introuvable.');
        return;
      }
      state.room = room;
      portal.update(state);
      if (state.role === 'player' && !myRoomPlayer(room)) {
        state.role = 'spectator';
        repositories.session.setRoom(state.roomCode, 'spectator');
        repositories.spectators.register(state.roomCode, state.clientToken, state.networkProfile).catch(error => toast(error.message, 'error'));
        toast('Cette session rejoint la table comme spectateur.');
      }
      if (room.status === 'waiting') renderWaitingRoom();
      else {
        state.view = 'playing';
        renderLiveScene(room);
        if (!state.stopChat) bindChat(state.roomCode);
        if (!state.stopReactions) bindReactions(state.roomCode);
        if (state.enterSceneOnStart && portal.page === 'online') portal.showTable();
        state.enterSceneOnStart = false;
        if (!portal.isScene && portal.page === 'online') renderPlayingPanel();
      }
    }, error => {
      toast(error.message, 'error');
      if (restored) returnToLobby('Impossible de reprendre cette salle.');
    });
  }

  async function submitTile(tileId, side) {
    const me = myRoomPlayer();
    if (!me || !renderLiveHand() || !handSnapshot().hand.includes(tileId)) return;
    const roomCode = state.roomCode;
    await playAction(async () => {
      await repositories.rooms.play(roomCode, { playerId: me.playerId, tileId, side });
      if (state.roomCode === roomCode && state.selectedTileId === tileId) state.selectedTileId = '';
    });
  }

  function bindGameActions() {
    document.addEventListener('pointerdown', unlockSound, { once: true });
    const announce = message => { document.querySelector('#hand-reorder-status').textContent = message; };
    handInteractions = bindHandInteractions(document.querySelector('#player-hand'), {
      getSnapshot: () => handSnapshot(),
      onAnnounce: announce,
      onSelect(tileId) {
        if (!handSnapshot().hand.includes(tileId)) return;
        state.selectedTileId = tileId;
        const canAct = renderLiveHand();
        const intent = tileIntent(state.room?.game, tileId);
        if (canAct && intent.automaticSide) submitTile(tileId, intent.automaticSide);
      },
      onReorder({ key, tileId, targetId, after }) {
        const current = handSnapshot();
        if (!current.enabled || current.key !== key) return;
        const next = moveHandTile(current.hand, tileId, targetId, after);
        handOrder.save(key, next);
        renderLiveHand();
        announce(`Domino déplacé en position ${next.indexOf(tileId) + 1} sur ${next.length}.`);
      }
    });
    const toggleSeatMenu = seat => {
      if (!seat?.dataset.playerId || state.role !== 'player') return;
      const player = roomPlayers(state.room).find(item => String(item.playerId) === seat.dataset.playerId);
      if (!player) return;
      if (state.openReactionPlayerId === seat.dataset.playerId) closeReactionMenu();
      else {
        state.openReactionPlayerId = seat.dataset.playerId;
        renderReactionMenu(player);
      }
    };
    document.querySelector('#casino-stage').addEventListener('click', event => {
      const seat = event.target.closest('.player-seat');
      if (seat) toggleSeatMenu(seat);
    });
    document.querySelector('#casino-stage').addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const seat = event.target.closest('.player-seat');
      if (!seat) return;
      event.preventDefault();
      toggleSeatMenu(seat);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeReactionMenu();
    });
    for (const side of ['left', 'right']) {
      document.querySelector(`#play-${side}`).addEventListener('click', async () => {
      if (!canWrite()) return;
        const me = myRoomPlayer();
        if (!me || !state.selectedTileId) return toast('Sélectionne d’abord un domino.', 'error');
        const tileId = state.selectedTileId;
        await submitTile(tileId, side);
      });
    }
    document.querySelector('#pass-button').addEventListener('click', async () => {
      if (!canWrite()) return;
      const me = myRoomPlayer();
      if (!me) return;
      await playAction(() => repositories.rooms.pass(state.roomCode, { playerId: me.playerId }));
    });
    const sceneForm = document.querySelector('.chat-form');
    sceneForm.classList.add('has-emojis');
    const emojiButton = actionButton('😊', 'scene-chat-emoji');
    emojiButton.setAttribute('aria-label', 'Ajouter un emoji à la discussion');
    const emojiPicker = node('div', 'scene-emoji-picker'); emojiPicker.hidden = true;
    for (const emoji of ['😊', '😂', '👏', '🐷', '👑', '🔥', '🤝', '😎']) {
      const choice = actionButton(emoji, 'scene-emoji-choice');
      choice.addEventListener('click', () => { const input = document.querySelector('#chat-input'); input.value += emoji; input.focus(); emojiPicker.hidden = true; });
      emojiPicker.append(choice);
    }
    emojiButton.addEventListener('click', () => { emojiPicker.hidden = !emojiPicker.hidden; });
    document.querySelector('#chat-panel').append(emojiPicker); sceneForm.prepend(emojiButton);
    let lastTyping = 0, clearTypingTimer;
    document.querySelector('#chat-input').addEventListener('input', () => {
      if (!state.roomCode || !canWrite(false)) return;
      const code = CLUB_CHAT_CHANNEL;
      clearTimeout(clearTypingTimer);
      clearTypingTimer = setTimeout(() => { if (canWrite(false)) repositories.chat.clearTyping(code, state.clientToken).catch(() => {}); }, 1800);
      if (Date.now()-lastTyping<1200) return; lastTyping=Date.now();
      repositories.chat.markTyping(code, {clientToken:state.clientToken,profile:state.networkProfile}).catch(() => {});
    });
    let chatSending = false;
    sceneForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!canWrite()) return;
      const input = document.querySelector('#chat-input');
      const text = input.value.trim();
      if (!text || !state.roomCode || chatSending) return;
      const channel = CLUB_CHAT_CHANNEL;
      chatSending = true;
      try {
        await repositories.chat.send(channel, {
          profile: state.networkProfile,
          clientToken: state.clientToken,
          role: state.role,
          text
        });
        if (input.value.trim() === text) input.value = '';
        emojiPicker.hidden = true;
        repositories.chat.clearTyping(channel, state.clientToken).catch(() => {});
      } catch (error) { toast(error.message, 'error'); }
      finally { chatSending = false; }
    });
    ui.menu.addEventListener('click', () => { state.enterSceneOnStart = false; portal.open('online'); });
  }

  try {
    if (!suppliedRuntime) await loadFirebase();
    const runtime = suppliedRuntime || createFirebaseRuntime();
    const session = suppliedSession || new SessionStore();
    handOrder = new HandOrderStore(session.storage);
    state.clientToken = ensureClientToken(session);
    connection = new ConnectionService(runtime.database);
    connection.watch(connected => {
      ui.network.hidden = connected;
      ui.network.textContent = connected ? 'Connexion rétablie.' : 'Connexion interrompue · Reconnexion automatique…';
      if (state.room?.game) {
        renderLiveHand();
        if (connected) ensureResultRecorded(state.room);
      }
    });
    const chatSession = new ClubChatSession(runtime.database,{serverTimestamp:runtime.serverTimestamp});
    repositories = {
      session,
      profiles: new ProfileRepository(runtime.database),
      rooms: new RoomRepository(runtime.database),
      presence: new PresenceService(runtime.database, { serverTimestamp: runtime.serverTimestamp, publishPresence:(token,presence)=>chatSession.enter(token,presence),onHeartbeat:()=>chatSession.heartbeat() }),
      invitations: new InvitationRepository(runtime.database, { serverTimestamp: runtime.serverTimestamp }),
      spectators: new SpectatorService(runtime.database, { serverTimestamp: runtime.serverTimestamp }),
      chat: new ChatRepository(runtime.database, { serverTimestamp: runtime.serverTimestamp }),
      reactions: new ReactionRepository(runtime.database, { serverTimestamp: runtime.serverTimestamp }),
      stats: new StatsRepository(runtime.database)
    };
    const adminAccess = suppliedAdminAccess || new AdminAccess();
    const requirePlayer = () => { connection.require(); if (!state.profile) throw new Error('Connecte-toi au club.'); };
    const admin = new AdminRepository(runtime.database, { require() { requirePlayer(); adminAccess.require(); } });
    const physical = new PhysicalClubRepository(runtime.database, { requirePlayer, requireAdmin: () => adminAccess.require() });
    portal = createClubPortal({ ui, physical, access: adminAccess, stats: repositories.stats, admin, chat: repositories.chat,
      identity: () => ({ profile: state.networkProfile, clientToken: state.clientToken, role: state.role }), canWrite, notify: toast,
      onData: value => { state.profiles = value.players; },
      actions: { renderOnline: renderCurrentPanel, acceptInvite, watchRoom: attachRoom,
        joinRoom:async code=>{if(!canWrite())return;try{if(state.room&&['waiting','playing'].includes(state.room.status)&&state.role==='player'&&state.roomCode!==code)throw new Error('Quitte ta salle d’attente ou termine ta partie avant de rejoindre une autre salle.');await repositories.rooms.join(code,{profile:state.networkProfile,clientToken:state.clientToken});await attachRoom(code,'player');}catch(error){toast(error.message,'error');}},
        inviteProfile:async profile=>{if(!canWrite()||invitePending)return;invitePending=true;try{if(state.room&&(state.room.status!=='waiting'||!isHost()))throw new Error('Crée un salon libre ou retourne dans ton salon d’attente pour inviter.');if(!state.room){const code=await repositories.rooms.create({profile:state.networkProfile,clientToken:state.clientToken});await attachRoom(code,'player');}await repositories.invitations.send({roomCode:state.roomCode,fromProfile:state.networkProfile,toPlayerId:profile.id,roomTitle:state.room?loungeTitle(state.room):''});portal.open('online');toast(`Invitation envoyée à ${profile.name}`);}catch(error){toast(error.message,'error');}finally{invitePending=false;}},
        declineInvite: async id => { if (!canWrite()) return; try { await repositories.invitations.remove(state.profile.id, id); } catch (error) { toast(error.message, 'error'); } } }
    });
    state.profiles = await repositories.profiles.list();
    bindGameActions();
    const restored = state.profiles.find(profile => String(profile.id) === String(session.playerId));
    if (restored) await completeLogin(restored, true);
    else renderLogin();
  } catch (error) {
    setStatus('Connexion indisponible.');
    clearContent();
    ui.content.append(node('p', 'online-error', error.message));
  }
}
