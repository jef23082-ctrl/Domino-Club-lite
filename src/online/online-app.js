import { handPoints, hasPlayableTile, playerKey, validSides } from '../game/engine.js?v=20260924T185554830';
import { normalizeTurnTimerSeconds, roomPlayers, TURN_TIMER_OPTIONS } from '../game/room-state.js?v=20260924T185554830';
import { ROOM_STYLES, roomStyle } from '../config/room-styles.js?v=20260924T185554830';
import { applyRoomStyle } from '../ui/room-style.js?v=20260924T185554830';
import { PLAYER_ASSETS } from '../config/player-assets.js?v=20260924T185554830';
import { OPPONENT_REACTIONS, SELF_EMOTIONS } from '../config/reactions.js?v=20260924T185554830';
import { createPremiumDomino, renderBoard, renderHand, renderOpponentRack, renderPlayerPlaque, renderPlayerWorkStatus } from '../ui/domino-renderer.js?v=20260924T185554830';
import { renderCharacterPlate } from '../ui/scene-renderer.js?v=20260924T185554830';
import { playSound, unlockSound } from '../ui/sound-player.js?v=20260924T185554830';
import { createBoudeVerdict, verdictReadyToStart } from '../ui/boude-verdict.js?v=20260924T185554830';
import { createReactionTrailParticle, createReactionVisual, isPremiumReaction } from '../ui/reaction-visual.js?v=20260924T185554830';
import { HandOrderStore, handOrderKey, moveHandTile } from '../ui/hand-order.js?v=20260924T185554830';
import { bindHandInteractions } from '../ui/hand-interactions.js?v=20260924T185554830';
import { ChatRepository } from '../services/chat-repository.js?v=20260924T185554830';
import { ClubChatSession, CLUB_CHAT_CHANNEL } from '../services/club-chat-session.js?v=20260924T185554830';
import { createFirebaseRuntime } from '../services/firebase-runtime.js?v=20260924T185554830';
import { InvitationRepository } from '../services/invitation-repository.js?v=20260924T185554830';
import { randomId } from '../services/ids.js?v=20260924T185554830';
import { authenticateProfile } from '../services/profile-auth.js?v=20260924T185554830';
import { PresenceService } from '../services/presence-service.js?v=20260924T185554830';
import { ProfileRepository } from '../services/profile-repository.js?v=20260924T185554830';
import { REACTION_COOLDOWN, REACTION_DURATION, ReactionRepository } from '../services/reaction-repository.js?v=20260924T185554830';
import { RoomRepository } from '../services/room-repository.js?v=20260924T185554830';
import { SessionStore } from '../services/session-store.js?v=20260924T185554830';
import { SpectatorService } from '../services/spectator-service.js?v=20260924T185554830';
import { ServerClock } from '../services/server-clock.js?v=20260924T185554830';
import { StatsRepository } from '../services/stats-repository.js?v=20260924T185554830';
import { AdminAccess } from '../services/admin-access.js?v=20260924T185554830';
import { AdminRepository } from '../services/admin-repository.js?v=20260924T185554830';
import { createClubPortal } from '../ui/club-portal.js?v=20260924T185554830';
import { createPokerApp } from '../poker/poker-app.js?v=20260924T185554830';
import { PhysicalClubRepository } from '../services/physical-club-repository.js?v=20260924T185554830';
import { renderChatMessage } from '../ui/chat-renderer.js?v=20260924T185554830';
import { ConnectionService } from '../services/connection-service.js?v=20260924T185554830';
import { characterIdForProfile } from './profile-map.js?v=20260924T185554830';
import { tileIntent } from './play-intent.js?v=20260924T185554830';
import { CLOCKWISE_SEATS as SEATS, seatedPlayers } from './seat-order.js?v=20260924T185554830';
import { displayName } from './display-name.js?v=20260924T185554830';
import { avatar } from '../ui/club-elements.js?v=20260924T185554830';
import { reactionPicker } from '../ui/reaction-picker.js?v=20260924T185554830';
import { premiumConfirm } from '../ui/premium-confirm.js?v=20260924T185554830';
import { requestAppFullscreen } from '../ui/app-shell.js?v=20260924T185554830';
import { createUniversalPlacementEngine, placeSeatOverlay, placeUniversalOverlay } from '../ui/overlay-layout.js?v=20260924T185554830';
import { preloadRoomResources, warmPremiumResources } from '../ui/resource-loader.js?v=20260924T185554830';
import { applyEventLighting, clearBoudeLighting, pulseBoudeLighting } from '../ui/event-lighting.js?v=20260924T185554830';
import { applyInteractionFormat } from '../ui/interaction-format.js?v=20260924T185554830';
import { muteLoungeMusic, primeLoungeMusic, selectLoungeTrack, setLoungeTrackAuthority, synchronizeLoungeMusic } from '../ui/lounge-music.js?v=20260924T185554830';
import { createPremiumCrown, createPremiumPig } from '../ui/premium-symbols.js?v=20260924T185554830';
import { createOpeningMascot } from '../ui/opening-mascot.js?v=20260924T185554830';
import { createLeaderTrophy } from '../ui/leader-trophy.js?v=20260924T185554830';
import { loungeTitle } from './lounge-name.js?v=20260924T185554830';
import {
  actionKey,
  celebrationState,
  freshReaction,
  remainingTileCount,
  resultPresentation,
  shouldShowSpectatorPanel
} from './presentation.js?v=20260924T185554830';

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
    name: displayName(profile.name),
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
  const reconnect = node('div', 'online-reconnect');
  reconnect.id = 'online-reconnect'; reconnect.hidden = true; reconnect.setAttribute('role', 'status');
  reconnect.append(node('span', 'online-reconnect__spinner'), node('strong', '', 'Reconnexion à la table…'), node('small', '', 'Les actions sont suspendues pour protéger la partie.'));
  document.querySelector('#game-shell').append(network, reconnect);
  return { hub, content, status, menu, toast, network, reconnect, reactionLayer, resultLayer, actionLayer };
}

export async function initOnlineApp({ runtime: suppliedRuntime = null, session: suppliedSession = null, adminAccess: suppliedAdminAccess = null } = {}) {
  const ui = createShell();
  const openingMascot = createOpeningMascot({ stage: document.querySelector('#casino-stage'), shell: document.querySelector('#game-shell'), notify: message => toast(message) });
  const leaderTrophy = createLeaderTrophy({ stage: document.querySelector('#casino-stage'), onSound: playSound });
  const state = {
    view: 'loading', profiles: [], profile: null, networkProfile: null, enterSceneOnStart: false,
    clientToken: '', roomCode: '', role: 'player', room: null,
    rooms: {}, presences: {}, invitations: {}, selectedTileId: '',
    openReactionPlayerId: '', activeReaction: null, reactionCooldownUntil: 0,
    renderedReactionId: '', renderedActionKey: '', renderedCelebrationKey: '', lastTurnId: null, leaderPlayerId: '',
    lastCountdownSoundKey: '', pendingTurnTimeoutKey: '', pendingClockPauseKey: '',
    recordedMatchIds: new Set(), chatBoundAt: 0, recoveringConnection: false,
    stopRoom: null, stopRooms: null, stopPresence: null, stopInvitations: null,
    stopChat: null, stopTyping: null, typingTimer: null, stopReactions: null, reactionTimer: null, celebrationTimer: null, turnClockTimer: null
  };
  let repositories;
  let serverClock = { now: () => Date.now() };
  let toastTimer;
  let handOrder;
  let handInteractions;
  let handContextKey = '';
  let portal;
  const boudeVerdict = createBoudeVerdict({ stage: document.querySelector('#casino-stage'), onSound: playSound, isVisible: () => Boolean(portal?.isScene), now: () => serverClock.now() });
  const placementEngine = createUniversalPlacementEngine(document.querySelector('#casino-stage'));
  let connection;
  let pendingPlay = false;
  let invitePending = false;
  let loginPending = false;
  let pendingRoomStyleCode = '';
  let pendingRoomTimerCode = '';
  let connectionWasEstablished = false;
  let reconnectSequence = 0;

  function canWrite(showError = true) {
    try {
      connection.require();
      if (state.recoveringConnection) throw new Error('Reconnexion à la table en cours.');
      return true;
    }
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

  function ensureClientToken(session, fresh = true) {
    // A token identifies one running page, not a browser profile. Reusing it
    // across tabs lets a lobby heartbeat overwrite the presence of a table.
    if (fresh || !session.clientToken) session.clientToken = randomId(20);
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
      const previous=seen.get(key),priority=value=>value?.roomCode?2:1;
      if (!previous || priority(item)>priority(previous) || priority(item)===priority(previous)&&Number(item.lastSeen)>Number(previous.lastSeen)) seen.set(key, item);
    }
    return [...seen.values()];
  }

  function stopRoomBindings() {
    boudeVerdict.reset();
    clearBoudeLighting(document.querySelector('#casino-stage'));
    state.renderedActionKey = '';
    openingMascot.reset();
    leaderTrophy.reset();
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
    clearInterval(state.turnClockTimer); state.turnClockTimer = null;
    state.pendingTurnTimeoutKey = '';
    state.pendingClockPauseKey = '';
    state.lastCountdownSoundKey = '';
    state.recoveringConnection = false;
    ui.reconnect.hidden = true;
    document.querySelector('#game-shell')?.classList.remove('is-reconnecting');
    state.activeReaction = null;
    state.openReactionPlayerId = '';
    state.renderedReactionId = '';
    ui.reactionLayer.replaceChildren();
    ui.resultLayer.replaceChildren();
    ui.actionLayer.replaceChildren();
    const spectatorPanel = document.querySelector('#spectator-panel');
    if (spectatorPanel) spectatorPanel.hidden = true;
    document.querySelector('#spectator-list')?.replaceChildren();
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
    input.placeholder = 'Votre mot de passe';
    input.autocomplete = 'current-password';
    label.append(input);
    const error = node('p', 'online-error');
    error.hidden = true;
    const submit = actionButton('Entrer dans le club', 'online-action online-action--primary');
    submit.type = 'submit';
    form.append(label, error, submit);
    const attemptLogin = async showError => {
      if (loginPending) return;
      if (!canWrite()) return;
      const profile = authenticateProfile(state.profiles, input.value);
      if (!profile) {
        if (showError) {
          error.textContent = 'Accès non reconnu.';
          error.hidden = false;
        }
        return;
      }
      loginPending = true;
      input.disabled = true;
      submit.disabled = true;
      error.hidden = true;
      try { await completeLogin(profile); }
      catch (failure) {
        loginPending = false;
        input.disabled = false;
        submit.disabled = false;
        error.textContent=failure.message;error.hidden=false;
      }
    };
    input.addEventListener('input', () => {
      error.hidden = true;
      if (authenticateProfile(state.profiles, input.value)) attemptLogin(false);
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      attemptLogin(true);
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
      if (state.view === 'playing') {
        renderWorkingIndicators();
        synchronizeTurnPause();
        updateTurnCountdown();
        renderLiveHand(state.room);
      }
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
    requestAppFullscreen();
    primeLoungeMusic();
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
    setStatus('');
    clearContent();
    const controls = node('div', 'online-controls online-waiting-controls');
    const styleField = node('label', 'room-style-picker');
    styleField.append(node('small', '', 'Style de salle'));
    const styleSelect = node('select', 'room-style-picker__select');
    styleSelect.setAttribute('aria-label', 'Choisir le style de salle');
    for (const [value, entry] of Object.entries(ROOM_STYLES)) {
      const option = node('option', '', entry.label);
      option.value = value;
      styleSelect.append(option);
    }
    styleSelect.value = roomStyle(state.room.style);
    styleSelect.disabled = !isHost() || pendingRoomStyleCode === state.roomCode;
    styleSelect.title = isHost() ? 'Ce décor sera partagé par toute la salle' : 'Le style est choisi par l’hôte';
    styleField.append(styleSelect);
    const timerField = node('label', 'room-style-picker room-timer-picker');
    timerField.append(node('small', '', 'Temps par tour'));
    const timerSelect = node('select', 'room-style-picker__select room-timer-picker__select');
    timerSelect.setAttribute('aria-label', 'Régler le compte à rebours par tour');
    for (const seconds of TURN_TIMER_OPTIONS) {
      const option = node('option', '', seconds ? `${seconds} secondes` : 'Désactivé');
      option.value = String(seconds);
      timerSelect.append(option);
    }
    timerSelect.value = String(normalizeTurnTimerSeconds(state.room.turnTimerSeconds));
    timerSelect.disabled = !isHost() || pendingRoomTimerCode === state.roomCode;
    timerSelect.title = isHost() ? 'Ce temps sera partagé par toute la salle' : 'Le temps est choisi par l’hôte';
    timerField.append(timerSelect);
    controls.append(styleField, timerField);
    if (isHost()) {
      const start = actionButton('Lancer la partie', 'online-action online-action--primary online-start-action');
      start.disabled = players.length !== 3 || pendingRoomStyleCode === state.roomCode || pendingRoomTimerCode === state.roomCode;
      styleSelect.addEventListener('change', async () => {
        if (!canWrite()) { styleSelect.value = roomStyle(state.room.style); return; }
        const code = state.roomCode;
        pendingRoomStyleCode = code;
        styleSelect.disabled = true;
        start.disabled = true;
        try {
          await repositories.rooms.selectStyle(code, { clientToken: state.clientToken, style: styleSelect.value });
        } catch (error) { toast(error.message, 'error'); }
        finally {
          if (pendingRoomStyleCode === code) pendingRoomStyleCode = '';
          if (state.roomCode === code && state.room?.status === 'waiting' && portal?.page === 'online') renderWaitingRoom();
        }
      });
      timerSelect.addEventListener('change', async () => {
        if (!canWrite()) { timerSelect.value = String(normalizeTurnTimerSeconds(state.room.turnTimerSeconds)); return; }
        const code = state.roomCode;
        pendingRoomTimerCode = code;
        timerSelect.disabled = true;
        start.disabled = true;
        try {
          await repositories.rooms.selectTurnTimer(code, {
            clientToken: state.clientToken,
            seconds: Number(timerSelect.value)
          });
        } catch (error) { toast(error.message, 'error'); }
        finally {
          if (pendingRoomTimerCode === code) pendingRoomTimerCode = '';
          if (state.roomCode === code && state.room?.status === 'waiting' && portal?.page === 'online') renderWaitingRoom();
        }
      });
      start.addEventListener('click', async () => {
      if (!canWrite() || pendingRoomStyleCode === state.roomCode || pendingRoomTimerCode === state.roomCode) return;
        requestAppFullscreen();
        primeLoungeMusic();
        try {
          await repositories.rooms.start(state.roomCode, {
            clientToken: state.clientToken, matchId: randomId(16), musicTrackIndex: Number(state.room.music?.trackIndex || 0)
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
          container.dispatchEvent(new CustomEvent('scene-chat-message', { bubbles: true }));
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
    const index = seatedPlayers(room, state.leaderPlayerId).findIndex(player => String(player.playerId) === String(playerId));
    return index >= 0 ? SEATS[index] : '';
  }

  function playerIsWorking(playerId) {
    const now = Date.now();
    return Object.values(state.presences || {}).some(item => item
      && String(item.playerId) === String(playerId)
      && String(item.roomCode || '').toUpperCase() === state.roomCode
      && now - Number(item.lastSeen || 0) < 120000
      && item.working === true);
  }

  function renderWorkingIndicators() {
    if (state.view !== 'playing' || !state.room) return;
    seatedPlayers(state.room, state.leaderPlayerId).forEach((player, index) => {
      const seat = document.querySelector(`#seat-${SEATS[index]}`);
      if (seat) renderPlayerWorkStatus(seat, { name: player.name, working: playerIsWorking(player.playerId) });
    });
  }

  function hasWorkingPlayer(room = state.room) {
    return roomPlayers(room).some(player => playerIsWorking(player.playerId));
  }

  function allPlayersPresent(room = state.room) {
    const now = Date.now();
    const live = Object.values(state.presences || {}).filter(item => item
      && String(item.roomCode || '').toUpperCase() === state.roomCode
      && item.role === 'player'
      && now - Number(item.lastSeen || 0) < 120000);
    const me = myRoomPlayer(room);
    return roomPlayers(room).every(player => (
      connection?.connected && me && String(me.playerId) === String(player.playerId)
    ) || live.some(item => String(item.playerId) === String(player.playerId)));
  }

  function turnShouldPause(room = state.room) {
    return hasWorkingPlayer(room) || !allPlayersPresent(room);
  }

  function turnIsPaused(room = state.room) {
    return Boolean(room?.game?.turnClock?.paused || turnShouldPause(room));
  }

  function synchronizeTurnPause() {
    const room = state.room;
    const me = myRoomPlayer(room);
    const clock = room?.game?.turnClock;
    if (!me || state.role !== 'player' || room?.status !== 'playing' || room.game?.roundStatus !== 'playing' || !clock || !canWrite(false)) return;
    const paused = turnShouldPause(room);
    if (Boolean(clock.paused) === paused) return;
    const key = `${room.matchId || room.code}:${room.game.roundNumber}:${clock.turnId}:${paused}`;
    if (state.pendingClockPauseKey === key) return;
    state.pendingClockPauseKey = key;
    repositories.rooms.setTurnClockPaused(state.roomCode, {
      clientToken: state.clientToken,
      paused,
      expectedTurnId: clock.turnId
    }).catch(error => {
      if (!['round-inactive', 'player-only', 'stale-turn'].includes(error?.code)) toast(error.message || 'Pause impossible à synchroniser.', 'error');
    }).finally(() => {
      if (state.pendingClockPauseKey === key) state.pendingClockPauseKey = '';
    });
  }

  function countdownRemainingMs(room = state.room) {
    const clock = room?.game?.turnClock;
    if (!clock) return 0;
    return clock.paused
      ? Math.max(0, Number(clock.remainingMs || 0))
      : Math.max(0, Number(clock.deadlineAt || 0) - serverClock.now());
  }

  function triggerTurnTimeout(room = state.room) {
    const clock = room?.game?.turnClock;
    if (!clock || clock.paused || turnShouldPause(room) || state.role !== 'player' || !myRoomPlayer(room) || !canWrite(false)) return;
    const key = `${room.matchId || room.code}:${room.game?.roundNumber}:${clock.turnId}:${clock.revision}`;
    if (state.pendingTurnTimeoutKey === key) return;
    state.pendingTurnTimeoutKey = key;
    repositories.rooms.timeoutTurn(state.roomCode, { expectedTurnId: clock.turnId }).catch(error => {
      if (!['stale-turn', 'turn-timer-active', 'round-inactive', 'game-paused'].includes(error?.code)) toast(error.message || 'Action automatique impossible.', 'error');
    }).finally(() => {
      setTimeout(() => {
        if (state.pendingTurnTimeoutKey === key) state.pendingTurnTimeoutKey = '';
      }, 450);
    });
  }

  function updateTurnCountdown() {
    const display = document.querySelector('.turn-countdown');
    const room = state.room;
    const clock = room?.game?.turnClock;
    if (!display || !clock || room?.status !== 'playing' || room.game?.roundStatus !== 'playing') return;
    const paused = turnIsPaused(room);
    const remainingMs = countdownRemainingMs(room);
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    applyEventLighting(document.querySelector('#casino-stage'), room, { seconds });
    const duration = Math.max(1, Number(clock.durationMs || normalizeTurnTimerSeconds(room.turnTimerSeconds) * 1000));
    display.style.setProperty('--clock-progress', String(Math.max(0, Math.min(1, remainingMs / duration))));
    display.classList.toggle('is-paused', paused);
    display.classList.toggle('is-warning', !paused && seconds > 3 && seconds <= 5);
    display.classList.toggle('is-danger', !paused && seconds > 0 && seconds <= 3);
    display.querySelector('strong').textContent = String(seconds);
    display.querySelector('.turn-countdown__pause').hidden = !paused;
    display.setAttribute('aria-label', paused ? `Compte à rebours en pause à ${seconds} secondes` : `${seconds} secondes restantes`);
    const soundKey = `${room.matchId || room.code}:${room.game.roundNumber}:${clock.turnId}:${clock.revision}:${seconds}`;
    if (!paused && seconds >= 1 && seconds <= 5 && state.lastCountdownSoundKey !== soundKey) {
      state.lastCountdownSoundKey = soundKey;
      playSound(seconds <= 3 ? 'countdown-danger' : 'countdown-warning');
    }
    if (!paused && remainingMs <= 0) triggerTurnTimeout(room);
  }

  function renderTurnCountdown(room, players) {
    clearInterval(state.turnClockTimer); state.turnClockTimer = null;
    document.querySelectorAll('.turn-countdown').forEach(item => item.remove());
    const clock = room?.game?.turnClock;
    if (!clock || normalizeTurnTimerSeconds(room.turnTimerSeconds) === 0 || room.status !== 'playing' || room.game?.roundStatus !== 'playing') return;
    const player = players.find(item => String(item.playerId) === String(room.game.currentTurnId));
    const seatName = player ? seatForPlayer(player.playerId, room) : '';
    const seat = seatName && document.querySelector(`#seat-${seatName}`);
    if (!seat) return;
    const countdown = node('div', 'turn-countdown');
    countdown.dataset.overlayRole = 'timer';
    countdown.setAttribute('role', 'timer');
    countdown.setAttribute('aria-live', 'off');
    const face = node('span', 'turn-countdown__face');
    face.append(node('strong', '', ''), node('small', '', 's'), node('em', 'turn-countdown__pause', 'PAUSE'));
    countdown.append(face);
    seat.append(countdown);
    updateTurnCountdown();
    state.turnClockTimer = setInterval(updateTurnCountdown, 100);
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
    const spectator = state.role === 'spectator';
    const sender = spectator ? state.networkProfile : me;
    if (!sender || !target || state.room?.status !== 'playing' || state.room.game?.roundStatus !== 'playing') return;
    const allowed = kind === 'emotion' ? SELF_EMOTIONS : OPPONENT_REACTIONS;
    if (!allowed[effect]) return;
    if (spectator && kind !== 'opponent') return;
    if (kind === 'emotion' && String(target.playerId) !== String(me.playerId)) return;
    if (!spectator && kind === 'opponent' && String(target.playerId) === String(me.playerId)) return;
    if (kind === 'emotion' && effect === 'working') {
      const next = !playerIsWorking(me.playerId);
      closeReactionMenu();
      try {
        await repositories.presence.setWorking(next);
        playSound(next ? 'reaction-working' : 'reaction-return');
        toast(next ? 'Statut activé : tu travailles et reviens bientôt.' : 'Bon retour à la table !');
      } catch (error) { toast(error.message || 'Statut impossible à modifier.', 'error'); }
      return;
    }
    if (Date.now() < state.reactionCooldownUntil) {
      toast('Attends un instant avant une nouvelle réaction.', 'error');
      return;
    }
    state.reactionCooldownUntil = Date.now() + (spectator ? 8000 : REACTION_COOLDOWN);
    closeReactionMenu();
    try {
      await repositories.reactions.send(state.roomCode, {
        kind, effect, sender, target, clientToken: state.clientToken, senderRole: state.role
      });
    } catch (error) {
      state.reactionCooldownUntil = 0;
      toast(error.message || 'Réaction impossible.', 'error');
    }
  }

  function reactionName(reaction, key, fallback) {
    const id = reaction?.[`${key}Id`];
    return reaction?.[`${key}Name`] || roomPlayers(state.room).find(player => String(player.playerId) === String(id))?.name || fallback;
  }

  function reactionSenderLabel(reaction) {
    const name = reactionName(reaction, 'sender', 'Un joueur');
    return reaction?.senderRole === 'spectator' ? `Spectateur ${name}` : name;
  }

  function premiumReactionBadge(reaction, meta, targetSeat) {
    const badge = node('div', `seat-interaction effect-${reaction.effect}`);
    badge.dataset.overlayRole = reaction.kind === 'emotion' ? 'emotion' : 'interaction';
    badge.dataset.kind = reaction.kind === 'opponent' ? 'opponent' : 'self';
    applyInteractionFormat(badge, { kind: reaction.kind, seat: targetSeat.dataset.seat, stage: document.querySelector('#casino-stage') });
    const visual = createReactionVisual(reaction.effect);
    const copy = node('div', 'seat-interaction__copy');
    if (reaction.kind === 'opponent') {
      copy.append(node('small', 'seat-interaction__sender', `${reactionSenderLabel(reaction)} → ${reactionName(reaction, 'target', 'toi')}`));
    }
    copy.append(node('strong', '', meta.label));
    if (visual) badge.append(visual);
    badge.append(copy);
    if (playerIsWorking(reaction.targetId)) badge.classList.add('beside-work-status');
    targetSeat.append(badge);
    if (reaction.kind === 'opponent') placeSeatOverlay(badge, targetSeat);
    else placeUniversalOverlay(badge);
    return badge;
  }

  function smoothPath(points) {
    if (points.length < 2) return '';
    let path = `M ${points[0][0]} ${points[0][1]}`;
    for (let index = 1; index < points.length - 1; index += 1) {
      const point = points[index], next = points[index + 1];
      path += ` Q ${point[0]} ${point[1]} ${(point[0] + next[0]) / 2} ${(point[1] + next[1]) / 2}`;
    }
    const last = points.at(-1); return `${path} L ${last[0]} ${last[1]}`;
  }

  function premiumReactionTrail(reaction, sourceSeat, targetSeat, targetBadge) {
    const stage = document.querySelector('#casino-stage');
    if (!stage || !targetSeat || !targetBadge) return;
    const stageRect = stage.getBoundingClientRect();
    const spectatorSource = reaction?.senderRole === 'spectator';
    const sourceElement = spectatorSource ? document.querySelector('#spectator-panel') : sourceSeat;
    if (!sourceElement) return;
    const sourcePlaque = sourceElement.querySelector?.('.player-plaque') || sourceElement;
    const sourceRect = sourcePlaque.getBoundingClientRect();
    const targetRect = targetBadge.getBoundingClientRect();
    const fromX = sourceRect.left + sourceRect.width / 2 - stageRect.left;
    const fromY = sourceRect.top + sourceRect.height / 2 - stageRect.top;
    const toX = targetRect.left + targetRect.width / 2 - stageRect.left;
    const toY = targetRect.top + targetRect.height / 2 - stageRect.top;
    const sourceName = spectatorSource ? 'spectator' : sourceSeat?.dataset.seat;
    const targetName = targetSeat.dataset.seat;
    const w=stageRect.width,h=stageRect.height;
    const luxe = roomStyle(state.room?.style) === 'luxe';
    const anchors=luxe
      ? {top:[w*.5,h*.328],left:[w*.075,h*.60],right:[w*.925,h*.60],spectator:[w*.075,h*.946]}
      : {top:[w*.5,h*.205],left:[w*.115,h*.59],right:[w*.885,h*.59],spectator:[w*.105,h*.835]};
    const routes=luxe ? {
      'top-left':[[w*.30,h*.34],[w*.115,h*.45]],'left-top':[[w*.115,h*.45],[w*.30,h*.34]],
      'top-right':[[w*.70,h*.34],[w*.885,h*.45]],'right-top':[[w*.885,h*.45],[w*.70,h*.34]],
      'left-right':[[w*.09,h*.75],[w*.29,h*.886],[w*.71,h*.886],[w*.91,h*.75]],
      'right-left':[[w*.91,h*.75],[w*.71,h*.886],[w*.29,h*.886],[w*.09,h*.75]],
      'spectator-left':[[w*.065,h*.76]],
      'spectator-top':[[w*.055,h*.73],[w*.08,h*.47],[w*.29,h*.34]],
      'spectator-right':[[w*.2,h*.9],[w*.4,h*.925],[w*.74,h*.886],[w*.91,h*.75]]
    } : {
      'top-left':[[w*.34,h*.21],[w*.2,h*.33]],'left-top':[[w*.2,h*.33],[w*.34,h*.21]],
      'top-right':[[w*.66,h*.21],[w*.8,h*.33]],'right-top':[[w*.8,h*.33],[w*.66,h*.21]],
      'left-right':[[w*.14,h*.75],[w*.34,h*.875],[w*.66,h*.875],[w*.86,h*.75]],
      'right-left':[[w*.86,h*.75],[w*.66,h*.875],[w*.34,h*.875],[w*.14,h*.75]],
      'spectator-left':[[w*.11,h*.72]],
      'spectator-top':[[w*.12,h*.68],[w*.19,h*.36],[w*.34,h*.215]],
      'spectator-right':[[w*.16,h*.86],[w*.36,h*.9],[w*.68,h*.88],[w*.86,h*.73]]
    };
    const points=[[fromX,fromY],anchors[sourceName]||[fromX,fromY],...(routes[`${sourceName}-${targetName}`]||[]),anchors[targetName]||[toX,toY],[toX,toY]];
    const d=smoothPath(points),path=`path("${d}")`;
    const travel = node('div', `reaction-travel effect-${reaction.effect}`);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('reaction-gold-path');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('aria-hidden','true');
    for(const className of ['reaction-gold-path__aura','reaction-gold-path__glow','reaction-gold-path__core']){const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.classList.add(className);line.setAttribute('d',d);line.setAttribute('pathLength','1');line.style.animationDelay=`${-Math.min(reaction.elapsed||0,650)/1000}s`;svg.append(line);}travel.append(svg);
    const pulse = node('span', 'reaction-source-pulse');
    pulse.style.left = `${fromX}px`;
    pulse.style.top = `${fromY}px`;
    travel.append(pulse);
    for (let index = 0; index < 12; index += 1) {
      const particle = createReactionTrailParticle(index, index === 0 ? 'reaction-comet' : 'reaction-particle');
      particle.style.offsetPath = path;
      particle.style.animationDelay = `${index * .034 - Math.min(reaction.elapsed || 0, 650) / 1000}s`;
      travel.append(particle);
    }
    const arrival=node('span','reaction-arrival-ring');arrival.style.left=`${toX}px`;arrival.style.top=`${toY}px`;travel.append(arrival);
    ui.reactionLayer.append(travel);
  }

  function renderReactionMenu(player) {
    ui.actionLayer.replaceChildren();
    if (!player || state.room?.status !== 'playing' || state.room?.game?.roundStatus !== 'playing') return;
    const me = myRoomPlayer();
    const sender = state.role === 'spectator' ? state.networkProfile : me;
    if (!sender) return;
    const mine = state.role === 'player' && String(me.playerId) === String(player.playerId);
    const actions = mine ? SELF_EMOTIONS : OPPONENT_REACTIONS;
    const menu=reactionPicker({mine,player,sender,actions,working:mine&&playerIsWorking(me.playerId),onClose:closeReactionMenu,onSend:effect=>sendReaction(mine?'emotion':'opponent',effect,player)});
    if(state.role==='spectator')menu.classList.add('is-spectator');
    ui.actionLayer.append(menu);
    menu.querySelector('button').focus({preventScroll:true});
  }

  function renderReaction(reaction = state.activeReaction) {
    clearTimeout(state.reactionTimer);
    ui.reactionLayer.replaceChildren();
    document.querySelectorAll('.seat-emotion').forEach(badge => badge.remove());
    document.querySelectorAll('.seat-interaction').forEach(badge => badge.remove());
    document.querySelectorAll('.player-seat').forEach(seat => seat.classList.remove('has-emotion'));
    const fresh = freshReaction(reaction, serverClock.now(), REACTION_DURATION);
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

    if (isPremiumReaction(fresh.effect) && fresh.effect !== 'working') {
      targetSeat.classList.add('has-emotion');
      const badge = premiumReactionBadge(fresh, meta, targetSeat);
      if (fresh.kind === 'opponent') {
        premiumReactionTrail(fresh, document.querySelector(`#seat-${seatForPlayer(fresh.senderId)}`), targetSeat, badge);
      }
    } else if (fresh.kind === 'emotion') {
      targetSeat.classList.add('has-emotion');
      const badge = node('div', `seat-emotion effect-${fresh.effect}`);
      badge.dataset.overlayRole = 'emotion';
      applyInteractionFormat(badge, { kind: 'emotion', seat: targetSeat.dataset.seat, stage: document.querySelector('#casino-stage') });
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
        const sender = reactionSenderLabel(fresh);
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
    if (serverClock.now() - Number(action.at || 0) > 5000) return;
    if (action.type === 'play') {
      boudeVerdict.reset();
      clearBoudeLighting(document.querySelector('#casino-stage'));
      const tile = [...document.querySelectorAll('.board-domino')].find(item => item.dataset.tileId === action.tileId);
      tile?.classList.add('is-just-played');
      playSound('placement');
    } else if (action.type === 'pass') {
      if (!verdictReadyToStart(action.at, serverClock.now())) return;
      const seatName = seatForPlayer(action.playerId);
      pulseBoudeLighting(document.querySelector('#casino-stage'));
      boudeVerdict.play({ seat: seatName, at: action.at });
    }
  }

  function renderOutcomeBadges(room) {
    document.querySelectorAll('.seat-crown, .seat-pig').forEach(badge => badge.remove());
    const result = room.game?.matchResult;
    if (result?.type === 'victory') {
      (result.cochonIds || []).forEach(playerId => {
        document.querySelector(`#seat-${seatForPlayer(playerId, room)}`)?.append(createPremiumPig('seat-pig'));
      });
    }
  }

  function scoreText(room, scores) {
    return roomPlayers(room).map(player => `${player.name} ${Number(scores?.[playerKey(player.playerId)] || 0)}`).join(' · ');
  }

  function renderRoundHands(room, winner) {
    const result = room.game?.roundResult || {};
    const remainingHands = result.remainingHands || room.game?.hands || {};
    const totals = result.handPoints || {};
    const summary = node('section', 'online-result-hands');
    summary.append(node('h3', '', 'Dominos restants'));
    for (const player of roomPlayers(room)) {
      const key = playerKey(player.playerId);
      const hand = remainingHands[key] || [];
      const row = node('article', 'online-result-hand');
      const heading = node('header', '');
      heading.append(node('strong', '', player.name), node('span', '', `${Number(totals[key] ?? handPoints(hand))} point${Number(totals[key] ?? handPoints(hand)) > 1 ? 's' : ''}`));
      const tiles = node('div', 'online-result-hand__tiles');
      hand.forEach(tileId => tiles.append(createPremiumDomino(tileId)));
      const showLastTile = (
        String(winner?.playerId) === String(player.playerId) &&
        result.cause === 'empty' && result.lastTileId
      );
      if (!hand.length && !showLastTile) tiles.append(node('span', 'online-result-hand__empty', 'Main vide'));
      if (showLastTile) {
        const last = node('div', 'online-result-last-tile');
        last.append(node('span', '', 'Dernier domino posé'), createPremiumDomino(result.lastTileId, 'is-last-played'));
        tiles.append(last);
      }
      row.append(heading, tiles);
      summary.append(row);
    }
    return summary;
  }

  function renderResult(room) {
    clearTimeout(state.celebrationTimer);
    ui.resultLayer.replaceChildren();
    const presentation = resultPresentation(room);
    if (!presentation) return;
    const celebration = celebrationState(room, serverClock.now());
    const card = node('section', `online-result-card ${presentation.kind}`);
    const icon = node('span', 'online-result-card__icon', presentation.icon);
    const winner=roomPlayers(room).find(p=>String(p.playerId)===String(celebration?.winnerId));
    if(winner){icon.replaceChildren(avatar(winner),createPremiumCrown('result-crown'));}
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
    card.classList.add('has-round-summary');
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
    const overview = node('div', 'online-result-overview');
    overview.append(icon, copy);
    card.append(overview, renderRoundHands(room, winner));
    const controls=node('div','online-result-controls');
    if (state.role === 'player') controls.append(action);
    const back=actionButton('Retour au salon','online-result-card__action online-result-card__back');back.addEventListener('click',()=>portal.open('online'));controls.append(back);card.append(controls);
    ui.resultLayer.append(card);
    renderOutcomeBadges(room);

    if (celebration && remaining > 0 && state.renderedCelebrationKey !== celebration.key) {
      state.renderedCelebrationKey = celebration.key;
      const topPlayer = seatedPlayers(room, state.leaderPlayerId)[0];
      if (topPlayer && String(topPlayer.playerId) === String(state.leaderPlayerId) && String(celebration.winnerId) === String(topPlayer.playerId)) leaderTrophy.celebrate(celebration.key);
      playSound('victory');
      if (celebration.type === 'match' && celebration.cochonIds.length) {
        setTimeout(() => { if (state.room?.matchId === room.matchId) playSound('pig'); }, 720);
      }
    }
    if (remaining > 0) {
      const updateCountdown = () => {
        if (!card.isConnected || !state.room) return;
        const current = celebrationState(state.room, serverClock.now());
        if (current?.key !== celebration.key) return;
        if (current.remaining <= 0) {
          action.disabled = false;
          action.textContent = presentation.actionLabel;
          card.classList.remove('is-ceremony');
          return;
        }
        action.textContent = `Cérémonie · ${Math.max(1, Math.ceil(current.remaining / 1000))} s`;
        state.celebrationTimer = setTimeout(updateCountdown, Math.min(250, current.remaining + 20));
      };
      state.celebrationTimer = setTimeout(updateCountdown, Math.min(250, remaining + 20));
    }
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
    document.querySelector('.hand-dock').setAttribute('aria-label', me ? `Main de ${displayName(me.name)}` : 'Vue spectateur');
    const canAct = Boolean(connection?.connected && !state.recoveringConnection && !pendingPlay && !turnIsPaused(room) && me && room?.status === 'playing' && game.roundStatus === 'playing' && String(game.currentTurnId) === String(me.playerId));
    const openingAllowed = Boolean(game.board?.placements?.length || !game.forcedOpeningTileId || state.selectedTileId === game.forcedOpeningTileId);
    const sides = canAct && state.selectedTileId && openingAllowed ? validSides(state.selectedTileId, game.board) : [];
    const dualChoice = sides.includes('left') && sides.includes('right');
    document.querySelector('#play-left').disabled = !sides.includes('left');
    document.querySelector('#play-right').disabled = !sides.includes('right');
    document.querySelector('#play-left').classList.toggle('is-dual-choice', dualChoice);
    document.querySelector('#play-right').classList.toggle('is-dual-choice', dualChoice);
    document.querySelector('#pass-button').disabled = !canAct || hasPlayableTile(game, me?.playerId);
    document.querySelector('#pass-button').hidden = room?.status !== 'playing' || game.roundStatus !== 'playing';
    openingMascot.select({tileId: state.selectedTileId, playable: Boolean(state.selectedTileId && tileIntent(game, state.selectedTileId).playable), active: canAct});
    return canAct;
  }

  function renderSpectators(room) {
    const panel = document.querySelector('#spectator-panel');
    const list = document.querySelector('#spectator-list');
    if (!panel || !list) return;
    const seated = new Set(roomPlayers(room).map(player => String(player.playerId)));
    const unique = new Map();
    for (const spectator of Object.values(room?.spectators || {}).filter(Boolean)) {
      const id = String(spectator.playerId ?? spectator.name ?? '');
      if (!id || seated.has(id)) continue;
      const previous = unique.get(id);
      if (!previous || Number(spectator.joinedAt || 0) < Number(previous.joinedAt || 0)) unique.set(id, spectator);
    }
    const spectators = [...unique.values()].sort((left, right) => Number(left.joinedAt || 0) - Number(right.joinedAt || 0));
    list.replaceChildren(...spectators.map(spectator => node('li', '', spectator.name || 'Spectateur')));
    panel.hidden = !shouldShowSpectatorPanel(room, spectators.length);
    panel.setAttribute('aria-label', `Spectateurs : ${spectators.map(spectator => displayName(spectator.name || 'Spectateur')).join(', ')}`);
  }

  function renderLiveScene(room) {
    const players = seatedPlayers(room, state.leaderPlayerId);
    preloadRoomResources({
      style: room.style,
      seats: players.map((player, index) => ({ seat: SEATS[index], characterId: characterIdForProfile(player) }))
    });
    applyRoomStyle(room.style);
    const game = room.game || {};
    applyEventLighting(document.querySelector('#casino-stage'), room);
    const leader = players.find(player => state.leaderPlayerId && String(player.playerId) === String(state.leaderPlayerId));
    leaderTrophy.update({ player: leader || null, matchKey: room.matchId || room.code || '', style: roomStyle(room.style) });
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
      seat.dataset.leader = String(Boolean(leader && String(player.playerId) === String(leader.playerId)));
      seat.tabIndex = ['player','spectator'].includes(state.role) ? 0 : -1;
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
        active,
        working: playerIsWorking(player.playerId)
      });
      seat.classList.toggle('is-active', active);
      renderOpponentRack(seat, count);
    });

    renderTurnCountdown(room, players);
    synchronizeTurnPause();

    renderBoard(document.querySelector('#domino-board'), game.board || { placements: [] });
    openingMascot.update(room);
    renderSpectators(room);
    const canAct = renderLiveHand(room);

    const turn = players.find(player => String(player.playerId) === String(game.currentTurnId));
    document.querySelector('.turn-banner span').textContent = room.status === 'finished'
      ? 'Partie terminée'
      : game.roundStatus === 'ended' ? 'Fin de la manche' : turnIsPaused(room) ? (hasWorkingPlayer(room) ? 'Partie en pause · un joueur travaille' : 'Partie en pause · attente du retour des joueurs') : turn ? `Tour de ${displayName(turn.name)}` : 'En attente';
    if (canAct && state.lastTurnId !== String(game.currentTurnId)) playSound('turn');
    state.lastTurnId = String(game.currentTurnId ?? '');
    if (room.status !== 'playing' || game.roundStatus !== 'playing') closeReactionMenu();
    renderLastAction(game);
    renderResult(room);
    renderReaction(state.activeReaction);
    ensureResultRecorded(room);
    warmPremiumResources();
  }

  async function attachRoom(code, role = 'player', restored = false) {
    if (!canWrite()) return;
    if (state.room && ['playing', 'waiting'].includes(state.room.status) && state.role === 'player' && String(code).toUpperCase() !== state.roomCode) {
      return toast('Termine ta partie actuelle avant de changer de salle.', 'error');
    }
    const normalizedCode = String(code || '').toUpperCase();
    if (role === 'player' && state.networkProfile) {
      try {
        await repositories.rooms.reattach(normalizedCode, { profile: state.networkProfile, clientToken: state.clientToken });
      } catch (error) {
        if (restored && error?.code === 'room-not-found') {
          repositories.session.clearRoom();
          renderLobby();
          toast('L’ancienne salle n’existe plus.');
          return;
        }
        if (restored && error?.code === 'player-not-seated') {
          repositories.session.clearRoom();
          renderLobby();
          toast('Cette salle appartient à un autre profil ou n’est plus accessible.');
          return;
        }
        if (error?.code !== 'player-not-seated') throw error;
      }
    }
    muteLoungeMusic();
    state.enterSceneOnStart = !restored;
    stopRoomBindings();
    await repositories.spectators.clear();
    state.roomCode = normalizedCode;
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
      synchronizeLoungeMusic(room.music || {});
      setLoungeTrackAuthority(state.role === 'player' && isHost(room));
      portal.update(state);
      if (state.role === 'player' && !myRoomPlayer(room)) {
        state.role = 'spectator';
        repositories.session.setRoom(state.roomCode, 'spectator');
        repositories.spectators.register(state.roomCode, state.clientToken, state.networkProfile).catch(error => toast(error.message, 'error'));
        toast('Cette session rejoint la table comme spectateur.');
      }
      if (room.status === 'waiting') {
        const waitingPlayers = seatedPlayers(room, state.leaderPlayerId);
        preloadRoomResources({
          style: room.style,
          seats: waitingPlayers.map((player, index) => ({ seat: SEATS[index], characterId: characterIdForProfile(player) }))
        });
        renderWaitingRoom();
      }
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
      if (playerIsWorking(me.playerId)) await repositories.presence.setWorking(false);
      if (state.roomCode === roomCode && state.selectedTileId === tileId) state.selectedTileId = '';
    });
  }

  function bindGameActions() {
    document.addEventListener('pointerdown', () => { unlockSound(); primeLoungeMusic(); }, { once: true });
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
      if (!seat?.dataset.playerId || !['player','spectator'].includes(state.role)) return;
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
      await playAction(async () => {
        await repositories.rooms.pass(state.roomCode, { playerId: me.playerId });
        if (playerIsWorking(me.playerId)) await repositories.presence.setWorking(false);
      });
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
    document.querySelector('#music-track')?.addEventListener('change', async event => {
      if (!state.roomCode || state.room?.status !== 'playing' || !isHost() || !canWrite(false)) return;
      const trackIndex = selectLoungeTrack(event.currentTarget.value);
      try { await repositories.rooms.selectMusic(state.roomCode, { clientToken: state.clientToken, trackIndex }); }
      catch (error) { toast(error.message, 'error'); synchronizeLoungeMusic(state.room?.music || {}); }
    });
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
    serverClock = new ServerClock(runtime.database).start();
    const session = suppliedSession || new SessionStore();
    handOrder = new HandOrderStore(session.storage);
    state.clientToken = ensureClientToken(session, !suppliedSession);
    connection = new ConnectionService(runtime.database);
    connection.watch(async connected => {
      const shell = document.querySelector('#game-shell');
      if (!connected) {
        if (connectionWasEstablished && state.roomCode) state.recoveringConnection = true;
        ui.network.hidden = false;
        ui.network.textContent = 'Connexion interrompue · Reconnexion automatique…';
        ui.reconnect.hidden = !state.roomCode;
        shell?.classList.toggle('is-reconnecting', Boolean(state.roomCode));
        if (state.room?.game) renderLiveHand();
        return;
      }
      const mustRecover = Boolean(state.recoveringConnection && state.roomCode && repositories);
      connectionWasEstablished = true;
      ui.network.hidden = !mustRecover;
      ui.network.textContent = mustRecover ? 'Synchronisation de la table…' : 'Connexion rétablie.';
      if (mustRecover) {
        const sequence = ++reconnectSequence;
        try {
          if (state.role === 'player' && state.networkProfile) {
            await repositories.rooms.reattach(state.roomCode, { profile: state.networkProfile, clientToken: state.clientToken });
          } else if (state.role === 'spectator' && state.networkProfile) {
            await repositories.spectators.register(state.roomCode, state.clientToken, state.networkProfile);
          }
          if (sequence === reconnectSequence) toast('Table resynchronisée.');
        } catch (error) {
          if (sequence === reconnectSequence) toast(error.message || 'La table ne peut pas être resynchronisée.', 'error');
        } finally {
          if (sequence === reconnectSequence) {
            state.recoveringConnection = false;
            ui.reconnect.hidden = true;
            ui.network.hidden = true;
            shell?.classList.remove('is-reconnecting');
            if (state.room?.game) { renderLiveScene(state.room); ensureResultRecorded(state.room); }
          }
        }
      } else if (state.room?.game) {
        renderLiveHand();
        ensureResultRecorded(state.room);
      }
    });
    const chatSession = new ClubChatSession(runtime.database,{serverTimestamp:runtime.serverTimestamp});
    repositories = {
      session,
      profiles: new ProfileRepository(runtime.database),
      rooms: new RoomRepository(runtime.database, { now: () => serverClock.now() }),
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
    const poker = createPokerApp({ database: runtime.database, identity: () => ({ profile: state.networkProfile, clientToken: state.clientToken }),
      getLeaderId: () => state.leaderPlayerId, getProfiles: () => state.profiles, access: adminAccess,
      canWrite, notify: toast, now: () => serverClock.now() });
    portal = createClubPortal({ ui, physical, access: adminAccess, stats: repositories.stats, admin, chat: repositories.chat, poker,
      identity: () => ({ profile: state.networkProfile, clientToken: state.clientToken, role: state.role }), canWrite, notify: toast,
      onData: value => { state.profiles = value.players; },
      onLeader: leader => {
        const nextLeaderId = String(leader?.id ?? leader?.playerId ?? '');
        if (nextLeaderId === state.leaderPlayerId) return;
        state.leaderPlayerId = nextLeaderId;
        if (state.room?.game) renderLiveScene(state.room);
      },
      actions: { renderOnline: renderCurrentPanel, acceptInvite,
        watchRoom:(code,role)=>{requestAppFullscreen();muteLoungeMusic();primeLoungeMusic();return attachRoom(code,role);},
        joinRoom:async code=>{if(!canWrite())return;try{if(state.room&&['waiting','playing'].includes(state.room.status)&&state.role==='player'&&state.roomCode!==code)throw new Error('Quitte ta salle d’attente ou termine ta partie avant de rejoindre une autre salle.');requestAppFullscreen();primeLoungeMusic();await repositories.rooms.join(code,{profile:state.networkProfile,clientToken:state.clientToken});await attachRoom(code,'player');}catch(error){toast(error.message,'error');}},
        inviteProfile:async profile=>{if(!canWrite()||invitePending)return;invitePending=true;try{if(state.room&&(state.room.status!=='waiting'||!isHost()))throw new Error('Crée un salon libre ou retourne dans ton salon d’attente pour inviter.');if(!state.room){const code=await repositories.rooms.create({profile:state.networkProfile,clientToken:state.clientToken});await attachRoom(code,'player');}await repositories.invitations.send({roomCode:state.roomCode,fromProfile:state.networkProfile,toPlayerId:profile.id,roomTitle:state.room?loungeTitle(state.room):''});portal.open('online');toast(`Invitation envoyée à ${profile.name}`);}catch(error){toast(error.message,'error');}finally{invitePending=false;}},
        declineInvite: async id => { if (!canWrite()) return; try { await repositories.invitations.remove(state.profile.id, id); } catch (error) { toast(error.message, 'error'); } } }
    });
    state.profiles = await repositories.profiles.list();
    bindGameActions();
    window.addEventListener('resize', placementEngine.schedule, { passive: true });
    const restored = state.profiles.find(profile => String(profile.id) === String(session.playerId));
    if (restored) await completeLogin(restored, true);
    else renderLogin();
  } catch (error) {
    setStatus('Connexion indisponible.');
    clearContent();
    ui.content.append(node('p', 'online-error', error.message));
  }
}
