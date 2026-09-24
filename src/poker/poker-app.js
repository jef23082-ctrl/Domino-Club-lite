import { PokerRepository } from './poker-repository.js?v=20260924T185554830';
import { pokerRanking, POKER_STARTING_STACK } from './poker-engine.js?v=20260924T185554830';
import { createPokerCard, createChipStack } from './poker-cards.js?v=20260924T185554830';
import { element as el, button, card, avatar } from '../ui/club-elements.js?v=20260924T185554830';
import { characterIdForProfile } from '../online/profile-map.js?v=20260924T185554830';
import { playerAsset, playerCutoutAsset, hasPlayerCutout } from '../config/player-assets.js?v=20260924T185554830';
import { ROOM_STYLES } from '../config/room-styles.js?v=20260924T185554830';
import { setOptimizedImage } from '../ui/image-source.js?v=20260924T185554830';
import { requestAppFullscreen } from '../ui/app-shell.js?v=20260924T185554830';
import { muteLoungeMusic, startLoungeMusic, stopLoungeMusic, toggleLoungeMusic } from '../ui/lounge-music.js?v=20260924T185554830';
import { navigationIcon } from '../ui/navigation-icon.js?v=20260924T185554830';
import { homeOrnament } from '../ui/home-ornaments.js?v=20260924T185554830';

const number = value => Number(value || 0).toLocaleString('fr-FR');
const same = (left, right) => String(left) === String(right);
const STAGES = Object.freeze({ waiting: 'En attente', playing: 'En cours', finished: 'Terminée', cancelled: 'Annulée' });
const POKER_SCENE = './assets/poker-v27/room.png';
const SEATS = Object.freeze(['top', 'left', 'right']);

function line(text, className = '') { return el('p', className, text); }
function title(text) { return el('h2', '', text); }
function hint(text) { return line(text, 'portal-muted'); }
function enabledConnection(canWrite) { return canWrite?.() !== false; }

export function createPokerApp({ database, identity, getLeaderId, getProfiles, access, canWrite, notify, now = () => Date.now() }) {
  const repo = new PokerRepository(database, { now });
  let rooms = {}, history = {}, currentCode = '', currentRoom = null, chat = {}, role = 'spectator';
  let presences = {}, lobbyChat = {}, lobbyDraft = '', historyPage = 0;
  let chosenProfileId = '', sceneVisible = false, busy = false, callbacks = {};
  let stopRoom = null, stopChat = null, stopRooms = null, stopHistory = null, toastTimer = null;
  const app = document.querySelector('#app');
  const shell = el('section', 'game-shell poker-shell');
  shell.id = 'poker-shell'; shell.hidden = true; shell.dataset.roomStyle = 'luxe'; shell.dataset.tableLayout = 'club';
  shell.setAttribute('aria-label', 'Partie de poker en ligne');
  const stage = el('div', 'casino-stage poker-stage');
  const sceneBase = el('img', 'scene-base');
  sceneBase.alt = 'Salon privé et table de poker';
  sceneBase.src = POKER_SCENE;
  stage.append(sceneBase);
  const portraits = Object.fromEntries(SEATS.map(seat => {
    const image = el('img', `scene-player-plate scene-player-plate--${seat}`);
    image.alt = ''; image.hidden = true; stage.append(image); return [seat, image];
  }));
  stage.append(el('div', 'scene-vignette'));
  const menuPanel = el('div', 'poker-menu-panel'); menuPanel.hidden = true;
  const menu = button('☰', () => { menuPanel.hidden = !menuPanel.hidden; }, 'poker-menu');
  menu.setAttribute('aria-label', 'Menu de la partie');
  const cancelGame = button('Annuler la partie', () => { menuPanel.hidden = true; requestCancel(currentRoom); }, 'online-action--danger');
  menuPanel.append(button('Retour au salon', () => { menuPanel.hidden = true; callbacks.open?.('online'); }), cancelGame);
  stage.append(menuPanel);
  const music = button('♫', () => { const active = toggleLoungeMusic(); music.classList.toggle('is-muted', !active); music.setAttribute('aria-pressed', String(active)); }, 'poker-music is-muted');
  music.setAttribute('aria-label', 'Activer ou couper la musique'); music.setAttribute('aria-pressed', 'false');
  const fullscreen = button('⛶', async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await requestAppFullscreen(); }, 'poker-fullscreen');
  fullscreen.setAttribute('aria-label', 'Plein écran');
  stage.append(menu, music, fullscreen);
  const seats = Object.fromEntries(SEATS.map(seat => {
    const slot = el('div', `poker-seat poker-seat--${seat}`);
    const cards = el('div', 'poker-seat__cards');
    const chips = el('div', 'poker-seat__chips');
    const plaque = el('div', 'poker-seat__plaque');
    slot.append(cards, chips, plaque); stage.append(slot);
    return [seat, { slot, cards, chips, plaque }];
  }));
  const board = el('div', 'poker-board');
  const boardCards = el('div', 'poker-board__cards');
  const pot = el('div', 'poker-board__pot');
  const potChips = el('div', 'poker-board__chips');
  board.append(boardCards, potChips, pot); stage.append(board);
  const local = el('div', 'poker-local');
  const turn = el('p', 'poker-local__turn');
  const stack = el('div', 'poker-local__stack');
  const hand = el('div', 'poker-local__hand');
  const controls = el('div', 'poker-local__controls');
  const raiseBox = el('div', 'poker-raise');
  const raiseValue = el('output', 'poker-raise__value', '0');
  const raiseSlider = el('input', 'poker-raise__slider');
  raiseSlider.type = 'range'; raiseSlider.step = '1'; raiseSlider.min = '0'; raiseSlider.max = '0';
  const raiseMinus = button('−', () => changeRaise(-1), 'poker-raise__step');
  const raisePlus = button('+', () => changeRaise(1), 'poker-raise__step');
  raiseSlider.addEventListener('input', () => { raiseValue.value = number(raiseSlider.value); raiseValue.textContent = number(raiseSlider.value); });
  const potRaise = button('Pot', () => { const me = currentRoom?.players.find(p => same(p.id, currentProfile()?.id)); if (!me) return; const game = currentRoom.game, owed = Math.max(0, game.currentBet - game.bets[String(me.id)]); raiseSlider.value = String(Math.min(Number(raiseSlider.max), Math.max(Number(raiseSlider.min), game.currentBet + game.pot + owed))); raiseSlider.dispatchEvent(new Event('input')); }, 'poker-raise__pot');
  raiseBox.append(raiseValue, raiseMinus, raiseSlider, raisePlus, potRaise);
  local.append(turn, stack, hand, raiseBox, controls); stage.append(local);
  const waiting = el('div', 'poker-waiting');
  const result = el('div', 'poker-result');
  stage.append(waiting, result);
  const chatPanel = el('aside', 'poker-chat');
  const chatHeading = el('h2', '', 'Discussion');
  const chatToggle = button('›', () => { const closed = chatPanel.classList.toggle('is-collapsed'); chatToggle.setAttribute('aria-expanded', String(!closed)); }, 'poker-chat__toggle');
  chatToggle.setAttribute('aria-label', 'Ouvrir ou fermer la discussion'); chatToggle.setAttribute('aria-expanded', 'true');
  const chatList = el('div', 'poker-chat__messages');
  chatList.setAttribute('aria-live', 'polite');
  const chatForm = el('form', 'poker-chat__form');
  const chatInput = el('input', 'poker-chat__input');
  chatInput.maxLength = 300; chatInput.placeholder = 'Écrivez un message…'; chatInput.setAttribute('aria-label', 'Écrire un message');
  const chatSend = button('➜', null, 'poker-chat__send'); chatSend.type = 'submit'; chatSend.setAttribute('aria-label', 'Envoyer');
  chatForm.append(chatInput, chatSend);
  chatForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message || !currentCode || !identity()?.profile) return;
    chatInput.value = '';
    try { await repo.sendChat(currentCode, identity().profile, message); }
    catch (error) { chatInput.value = message; flash(error.message, true); }
  });
  chatPanel.append(chatHeading, chatToggle, chatList, chatForm); stage.append(chatPanel);
  const toast = el('p', 'poker-toast'); toast.hidden = true; toast.setAttribute('role', 'status'); stage.append(toast);
  shell.append(stage); app.append(shell);

  function flash(message, error = false) {
    clearTimeout(toastTimer);
    toast.textContent = message; toast.dataset.error = String(error); toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
    if (!sceneVisible) notify?.(message, error ? 'error' : 'gold');
  }
  function refresh() { callbacks.refresh?.(); if (sceneVisible) renderScene(); }
  function setCallbacks(next) { callbacks = next || {}; }
  function setProfileList(profiles) { if (Array.isArray(profiles)) cachedProfiles = profiles; }
  let cachedProfiles = [];
  const currentProfile = () => identity()?.profile || null;
  const allProfiles = () => getProfiles?.() || cachedProfiles;
  const records = () => Object.values(history).filter(row => row && !row.deleted).sort((a, b) => Number(b.endedAt) - Number(a.endedAt));
  const ranking = () => pokerRanking(records(), allProfiles());
  const personal = () => ranking().find(row => same(row.id, currentProfile()?.id));

  async function submit(operation) {
    if (busy || !enabledConnection(canWrite)) return;
    busy = true;
    try { await operation(); }
    catch (error) { flash(error.message || 'Action impossible.', true); }
    finally { busy = false; renderScene(); }
  }
  function requestCancel(room) {
    if (!room || !['waiting', 'playing'].includes(room.status)) return;
    const dialog = el('dialog', 'portal-dialog poker-confirm');
    dialog.append(title('Annuler cette partie ?'), line('Les joueurs retourneront au salon. Aucun point de prestige ne sera attribué.'));
    const keep = button('Continuer à jouer', () => dialog.close());
    const confirm = button('Confirmer l’annulation', async () => {
      confirm.disabled = true;
      try { await repo.cancel(room.code, access.unlocked ? room.hostId : currentProfile()?.id); dialog.close(); }
      catch (error) { flash(error.message, true); confirm.disabled = false; }
    }, 'online-action--danger');
    dialog.append(keep, confirm); dialog.addEventListener('close', () => dialog.remove());
    (sceneVisible ? shell : app).append(dialog); dialog.showModal();
  }
  function stopCurrent() { stopRoom?.(); stopChat?.(); stopRoom = null; stopChat = null; }
  function enterRoom(code) {
    const normalized = String(code || '').toUpperCase();
    if (!normalized) return;
    stopCurrent(); currentCode = normalized; currentRoom = rooms[normalized] || null;
    role = currentRoom?.players?.some(player => same(player.id, currentProfile()?.id)) ? 'player' : 'spectator';
    chat = {};
    stopRoom = repo.watchRoom(normalized, room => {
      if (!room || room.status === 'cancelled') {
        currentRoom = null; currentCode = ''; stopCurrent(); hideScene(); callbacks.open?.('online'); flash('Cette table n’est plus disponible.'); return;
      }
      currentRoom = room; rooms[normalized] = room;
      role = room.players.some(player => same(player.id, currentProfile()?.id)) ? 'player' : 'spectator';
      if (room.status === 'finished') repo.recordFinished(room).catch(error => flash(error.message, true));
      renderScene(); refresh();
    }, error => flash(error.message, true));
    stopChat = repo.watchChat(normalized, value => { chat = value; renderChat(); }, error => flash(error.message, true));
    callbacks.showScene?.();
  }
  async function createRoom(style = 'luxe') {
    if (!currentProfile()) return flash('Connecte-toi pour jouer.', true);
    await submit(async () => { const code = await repo.create(currentProfile(), style); enterRoom(code); });
  }
  async function joinRoom(code) {
    if (!currentProfile()) return flash('Connecte-toi pour jouer.', true);
    await submit(async () => { await repo.join(code, currentProfile()); enterRoom(code); });
  }
  function resumeRoom(code) { enterRoom(code); }
  async function leaveRoom() {
    if (!currentRoom) return;
    const wasWaiting = currentRoom.status === 'waiting';
    const code = currentCode;
    await submit(async () => {
      if (wasWaiting && role === 'player') await repo.leave(code, currentProfile().id);
      stopCurrent(); currentCode = ''; currentRoom = null; hideScene(); callbacks.open?.('online');
    });
  }
  function showScene() {
    if (!currentCode) return;
    sceneVisible = true; shell.hidden = false;
    muteLoungeMusic(); startLoungeMusic();
    renderScene();
    requestAppFullscreen();
  }
  function hideScene() { sceneVisible = false; shell.hidden = true; stopLoungeMusic(); }
  function roomList() { return Object.values(rooms).filter(room => room && ['waiting', 'playing'].includes(room.status)).sort((a, b) => Number(b.createdAt) - Number(a.createdAt)); }

  function seatMap(room) {
    const players = [...room.players];
    const leader = players.find(player => same(player.id, getLeaderId?.()));
    const top = leader || players[0];
    const others = players.filter(player => !same(player.id, top?.id));
    return { top, left: others[0] || null, right: others[1] || null };
  }
  function renderSeats(room) {
    const map = seatMap(room), game = room.game;
    for (const seat of SEATS) {
      const player = map[seat], image = portraits[seat], view = seats[seat];
      view.slot.hidden = !player; image.hidden = !player;
      if (!player) continue;
      const characterId = characterIdForProfile(player);
      const cutout = room.style === 'luxe' && hasPlayerCutout(characterId, seat);
      const asset = cutout ? playerCutoutAsset(characterId, seat) : playerAsset(characterId, seat);
      if (image.dataset.asset !== asset.src) { setOptimizedImage(image, asset.src); image.dataset.asset = asset.src; }
      image.dataset.characterId = characterId; image.dataset.renderMode = cutout ? 'cutout' : 'scene';
      image.alt = `${player.name} assis à la table de poker`;
      const active = room.status === 'playing' && game?.status === 'betting' && same(game.turnId, player.id);
      view.slot.classList.toggle('is-turn', active);
      view.slot.classList.toggle('is-folded', Boolean(game?.folded?.[String(player.id)]));
      view.slot.classList.toggle('is-all-in', Boolean(game?.allIn?.[String(player.id)]));
      view.cards.replaceChildren();
      if (game && player.stack + Number(game.committed?.[String(player.id)] || 0) > 0 && !game.folded?.[String(player.id)]) {
        const reveal = game.status === 'showdown' && game.lastResult?.type === 'showdown';
        for (const card of game.holeCards?.[String(player.id)] || []) view.cards.append(createPokerCard(card, { hidden: !reveal, small: true }));
      }
      view.chips.replaceChildren();
      if (room.status !== 'waiting' && player.stack > 0) view.chips.append(createChipStack(player.stack, seat === 'right' ? 'red' : seat === 'left' ? 'green' : 'black'));
      view.plaque.replaceChildren(el('span', 'poker-seat__symbol', '⚜'), el('strong', '', player.name), el('span', 'poker-seat__balance', `Jetons : ${number(room.status === 'waiting' ? POKER_STARTING_STACK : player.stack)}`));
      if (game?.folded?.[String(player.id)]) view.plaque.append(el('em', '', 'Couché'));
      else if (game?.allIn?.[String(player.id)]) view.plaque.append(el('em', '', 'Tapis'));
    }
  }
  function renderBoard(room) {
    const game = room.game;
    boardCards.replaceChildren(); potChips.replaceChildren();
    for (const card of game?.board || []) boardCards.append(createPokerCard(card));
    if (game?.pot) {
      potChips.append(createChipStack(game.pot, 'red', { compact: true }));
    }
    pot.textContent = game ? `Pot : ${number(game.pot)}` : 'Pot : 0';
  }
  function raiseBounds(game, me) {
    const mine = Number(game.bets[String(me.id)] || 0), maximum = mine + Number(me.stack || 0);
    const minimum = Math.min(maximum, Number(game.currentBet || 0) + Number(game.minRaise || game.blinds.big));
    return { minimum, maximum };
  }
  function changeRaise(direction) {
    const step = 100;
    raiseSlider.value = String(Math.max(Number(raiseSlider.min), Math.min(Number(raiseSlider.max), Number(raiseSlider.value) + direction * step)));
    raiseSlider.dispatchEvent(new Event('input'));
  }
  function actionButton(label, action, className) {
    const node = button(label, action, `poker-action ${className}`);
    node.disabled = busy;
    return node;
  }
  function renderLocal(room) {
    const game = room.game, me = room.players.find(player => same(player.id, currentProfile()?.id));
    const canAct = role === 'player' && game?.status === 'betting' && me && same(game.turnId, me.id);
    local.hidden = !game;
    if (!game) return;
    const turnPlayer = room.players.find(player => same(player.id, game.turnId));
    turn.textContent = game.status === 'showdown' ? 'Fin de la main' : canAct ? 'À vous de jouer' : turnPlayer ? `Tour de ${turnPlayer.name}` : 'Distribution des cartes';
    stack.replaceChildren(); hand.replaceChildren(); controls.replaceChildren();
    if (me) {
      if (me.stack > 0) stack.append(createChipStack(me.stack, 'green', { compact: true }));
      stack.append(el('span', '', `Jetons : ${number(me.stack)}`));
      for (const card of game.holeCards?.[String(me.id)] || []) hand.append(createPokerCard(card));
    } else stack.append(el('span', '', 'Vous regardez la table'));
    const owed = canAct ? Math.max(0, game.currentBet - (game.bets[String(me.id)] || 0)) : 0;
    if (canAct) {
      controls.append(actionButton('Se coucher', () => submit(() => repo.action(currentCode, me.id, 'fold')), 'poker-action--fold'));
      controls.append(actionButton(owed ? `Suivre ${number(Math.min(owed, me.stack))}` : 'Parole', () => submit(() => repo.action(currentCode, me.id, owed ? 'call' : 'check')), 'poker-action--call'));
      const bounds = raiseBounds(game, me);
      const canRaise = bounds.maximum > game.currentBet && !game.acted[String(me.id)];
      raiseBox.hidden = !canRaise;
      if (canRaise) {
        raiseSlider.min = String(bounds.minimum); raiseSlider.max = String(bounds.maximum);
        raiseSlider.step = '1'; raiseSlider.value = String(bounds.minimum);
        raiseValue.value = number(bounds.minimum); raiseValue.textContent = number(bounds.minimum);
      }
      const raise = actionButton('Relancer', () => submit(() => repo.action(currentCode, me.id, 'raise', Number(raiseSlider.value))), 'poker-action--raise');
      raise.disabled = !canRaise || busy; controls.append(raise);
    } else {
      raiseBox.hidden = true;
      if (me && game.status === 'betting') {
        for (const [label, tone] of [['Se coucher','fold'],['Parole / Suivre','call'],['Relancer','raise']]) {
          const control = actionButton(label, null, `poker-action--${tone}`);
          control.disabled = true; controls.append(control);
        }
      }
    }
  }
  function renderOverlays(room) {
    waiting.replaceChildren(); result.replaceChildren();
    waiting.hidden = room.status !== 'waiting';
    result.hidden = room.status === 'waiting' || room.game?.status !== 'showdown';
    if (room.status === 'waiting') {
      waiting.append(title('Table de poker privée'), hint(`${room.players.length} / 3 joueurs · 20 000 jetons chacun · aucune mise réelle`));
      const members = el('div', 'poker-waiting__members');
      room.players.forEach(player => members.append(avatar(player), el('strong', '', player.name)));
      waiting.append(members);
      if (same(room.hostId, currentProfile()?.id)) {
        const style = el('label', 'poker-waiting__style', 'Style de la salle ');
        const select = el('select');
        for (const [id, option] of Object.entries(ROOM_STYLES)) { const choice = el('option', '', option.label); choice.value = id; select.append(choice); }
        select.value = room.style;
        select.addEventListener('change', () => submit(() => repo.style(currentCode, currentProfile().id, select.value)));
        style.append(select); waiting.append(style);
        const start = button('Lancer la partie', () => submit(() => repo.start(currentCode, currentProfile().id)), 'poker-action poker-action--raise');
        start.disabled = room.players.length !== 3 || busy;
        waiting.append(start);
      } else waiting.append(hint('L’hôte lancera la partie lorsque les trois joueurs seront présents.'));
      waiting.append(button(role === 'spectator' ? 'Retour aux tables' : 'Quitter la table', leaveRoom, 'poker-action poker-action--fold'));
    }
    const game = room.game;
    if (game?.status !== 'showdown') return;
    result.append(title(room.status === 'finished' ? 'Tournoi terminé' : 'Fin de la main'));
    result.append(line(game.lastResult?.handName || '', 'poker-result__hand'));
    const awardRows = el('div', 'poker-result__rows');
    room.players.forEach(player => {
      const award = Number(game.lastResult?.awards?.[String(player.id)] || 0);
      if (award > 0) awardRows.append(line(`${player.name} · +${number(award)} jetons`));
    });
    result.append(awardRows);
    if (room.status === 'finished') {
      const ranks = el('ol', 'poker-result__placements');
      room.result.placements.forEach((id, index) => {
        const player = room.players.find(item => same(item.id, id));
        const delta = room.result.points[String(id)];
        ranks.append(el('li', '', `${player?.name || 'Joueur'} · ${delta > 0 ? '+' : ''}${delta} prestige`));
      });
      result.append(ranks, button('Retour au salon Poker', () => callbacks.open?.('online'), 'poker-action poker-action--call'));
    } else if (same(room.hostId, currentProfile()?.id)) {
      result.append(button('Main suivante', () => submit(() => repo.nextHand(currentCode, currentProfile().id)), 'poker-action poker-action--raise'));
    } else result.append(hint('L’hôte lancera la main suivante.'));
  }
  function renderScene() {
    if (!currentRoom || !currentCode) return;
    const room = currentRoom;
    shell.dataset.roomStyle = room.style === 'classic' ? 'classic' : 'luxe';
    sceneBase.src = room.style === 'classic' ? ROOM_STYLES.classic.scene : POKER_SCENE;
    cancelGame.hidden = !['waiting', 'playing'].includes(room.status) || !same(room.hostId, currentProfile()?.id);
    renderSeats(room); renderBoard(room); renderLocal(room); renderOverlays(room);
  }
  function renderChat() {
    chatList.replaceChildren();
    const entries = Object.values(chat).filter(Boolean).sort((a, b) => Number(a.at) - Number(b.at)).slice(-80);
    for (const entry of entries) {
      const message = el('div', 'poker-chat__message');
      message.append(el('strong', '', entry.name || 'Joueur'), el('span', '', entry.text || ''));
      chatList.append(message);
    }
    chatList.scrollTop = chatList.scrollHeight;
  }

  function roomCard(room) {
    const section = card(`${room.players[0]?.name || 'Club'} — table ${room.code}`);
    section.classList.add('poker-lobby-room');
    section.append(hint(`${STAGES[room.status] || room.status} · ${room.players.length}/3 joueurs · ${room.style === 'classic' ? 'Classique' : 'Luxe'}`));
    const portraits = el('div', 'poker-lobby-room__portraits');
    room.players.forEach(player => { const one = el('div'); one.append(avatar(player), el('span', '', player.name)); portraits.append(one); });
    section.append(portraits);
    const mine = room.players.some(player => same(player.id, currentProfile()?.id));
    const enter = button(room.status === 'waiting' && !mine ? 'Rejoindre' : mine ? 'Entrer à la table' : 'Regarder', () => room.status === 'waiting' && !mine ? joinRoom(room.code) : resumeRoom(room.code), 'online-action--primary');
    enter.disabled = room.status === 'waiting' && !mine && room.players.length >= 3;
    section.append(enter);
    if (same(room.hostId, currentProfile()?.id)) section.append(button('Annuler la partie', () => requestCancel(room), 'poker-room-cancel'));
    return section;
  }
  function connected() { return [...new Map(Object.values(presences).filter(p => p && now() - Number(p.lastSeen) < 120000).map(p => [String(p.playerId), p])).values()]; }
  function pageHeading(icon, text, sub = '') {
    const head = el('div', 'portal-home-card-heading'), glyph = el('span', 'portal-home-heading-icon'); glyph.append(navigationIcon(icon));
    head.append(glyph, title(text)); if (sub) head.append(line(sub, 'portal-home-card-subtitle')); head.append(el('span', 'portal-home-heading-jewel', '◆')); return head;
  }
  function homeAction(icon, text, description, action, gold = false) {
    const node = button('', action, `portal-home-action${gold ? ' portal-home-action--gold' : ''}`);
    const glyph = el('span', 'portal-home-action-icon'); glyph.append(navigationIcon(icon));
    const copy = el('span', 'portal-home-action-copy'); copy.append(el('strong', '', text), el('small', '', description));
    node.append(glyph, copy, el('span', 'portal-home-action-arrow', '›')); return node;
  }
  function renderHome(target) {
    const layout = el('div', 'portal-home-showcase');
    const online = el('section', 'portal-card portal-home-card portal-home-online-card');
    online.append(pageHeading('poker', 'PARTIE EN LIGNE', 'JOUEZ · BLUFFEZ · PROGRESSEZ'));
    const actions = el('div', 'portal-home-action-list');
    actions.append(homeAction('create','Créer une salle','Invitez vos partenaires à la table',()=>createRoom()),homeAction('table','Tables du club','Rejoignez un tournoi ouvert',()=>callbacks.open?.('online')),homeAction('chat','Discussion commune','Retrouvez les joueurs du club',()=>callbacks.open?.('online')));
    const status = el('div','portal-home-room-status'); status.append(el('i','portal-home-live-dot'),el('span','',`${roomList().length} table${roomList().length===1?'':'s'} active${roomList().length===1?'':'s'}`)); online.append(actions,status);
    const mine=personal(), me=currentProfile() || allProfiles()[0];
    const member=el('section','portal-card portal-member-card portal-home-card portal-home-profile');
    member.append(el('span','portal-member-rank',mine?`#${ranking().indexOf(mine)+1}`:'—'),pageHeading('profiles',me?.name || 'Mon profil'));
    const frame=el('div','portal-home-portrait-frame'), laurels=el('span','portal-home-laurels');laurels.append(homeOrnament('laurels'));
    const portrait=avatar(me || {});portrait.classList.add('portal-home-profile-avatar');frame.append(laurels,portrait);
    const metrics=el('div','portal-member-metrics');
    for(const [icon,value,label] of [['poker',mine?.played||0,'tournois'],['trophy',mine?.wins||0,'victoires'],['percent',`${mine?.played?Math.round(mine.wins/mine.played*100):0}%`,'de victoire']]){const m=el('div'),g=el('span','portal-member-metric-icon');g.append(navigationIcon(icon));m.append(g,el('strong','',value),el('span','',label));metrics.append(m);}
    const profile=button('Voir mon profil ›',()=>{chosenProfileId=me?.id;callbacks.open?.('profiles');},'online-action--primary portal-home-profile-button');
    member.append(frame,metrics,el('blockquote','portal-home-quote','“Le talent joue les cartes,\nle sang-froid gagne la table.”'),el('span','portal-home-heading-jewel portal-home-quote-jewel','◆'),profile);
    const club=el('section','portal-card portal-home-card portal-home-physical-card');club.append(pageHeading('trophy','PRESTIGE DU CLUB','VOTRE PLACE SE GAGNE À LA TABLE'));
    const clubActions=el('div','portal-home-action-list portal-home-physical-actions');
    clubActions.append(homeAction('ranking','Classement Poker',`${number(mine?.points ?? 1000)} points de prestige`,()=>callbacks.open?.('ranking'),true),homeAction('history','Mes tournois','Revivez les dernières parties',()=>callbacks.open?.('history'),true));
    const active=roomList().find(r=>same(r.hostId,me?.id));const cancel=homeAction('cancel','Annuler ma partie','Fermer la table en cours',()=>requestCancel(active));cancel.disabled=!active;clubActions.append(cancel);
    club.append(clubActions,line('Même table, nouvelles histoires.','portal-home-signature'));layout.append(online,member,club);target.append(layout);
    const strip=el('div','portal-connected-strip');strip.append(el('span','','En ligne :'));for(const p of connected()){const item=el('span','portal-connected-member');item.append(avatar(p),el('span','',p.name),el('i','portal-presence-dot'));strip.append(item);}if(!connected().length)strip.append(el('span','portal-muted','Le club vous attend.'));target.append(strip);
  }
  function renderOnline(target) {
    const live=card('Joueurs connectés');live.classList.add('poker-live-band');const members=el('div','poker-live-members');
    for(const p of connected()){const item=el('span');item.append(avatar(p),el('i','portal-presence-dot'),el('strong','',p.name));members.append(item);}if(!connected().length)members.append(hint('Aucun autre joueur connecté.'));live.append(members);
    const create=el('div','poker-create-table');create.append(button('Créer une table Luxe',()=>createRoom('luxe'),'online-action--primary'),button('Créer une table Classique',()=>createRoom('classic')));
    const columns=el('div','poker-online-columns'),list=card('Tables du club');list.classList.add('poker-online-list');
    const active=roomList(), grid=el('div','poker-room-grid');if(!active.length){const empty=el('div','poker-empty');empty.append(navigationIcon('poker'),el('h3','','La prochaine partie vous attend'),line('Invitez deux partenaires et installez-vous à la table.'),button('Créer une salle',()=>createRoom(),'online-action--primary'));grid.append(empty);}else active.forEach(room=>grid.append(roomCard(room)));list.append(grid);
    const discussion=card('Discussion commune');discussion.classList.add('poker-common-chat');const messages=el('div','poker-common-messages');
    for(const entry of Object.values(lobbyChat).filter(Boolean).sort((a,b)=>a.at-b.at).slice(-40)){const row=el('p');row.append(el('strong','',entry.name),el('span','',entry.text));messages.append(row);}
    const form=el('form','poker-common-form'),input=el('input');input.placeholder='Écrire à tous les joueurs…';input.maxLength=300;input.value=lobbyDraft;input.setAttribute('aria-label','Message au club Poker');input.addEventListener('input',()=>{lobbyDraft=input.value;});const send=button('Envoyer');send.type='submit';
    form.append(input,send);form.addEventListener('submit',async event=>{event.preventDefault();if(!input.value.trim())return;send.disabled=true;try{await repo.sendChat('LOBBY',currentProfile(),input.value);lobbyDraft='';input.value='';}catch(error){flash(error.message,true);}finally{send.disabled=false;}});discussion.append(messages,form);columns.append(list,discussion);
    const note=el('div','poker-lobby-note');note.append(navigationIcon('poker'),el('span','','Texas Hold’em · 3 joueurs · 20 000 jetons · Blindes 100 / 200'));target.append(live,create,columns,note);messages.scrollTop=messages.scrollHeight;
  }
  function renderRanking(target) {
    const panel = card('Classement Prestige Poker');
    panel.classList.add('poker-ranking-panel');
    const podium=el('div','portal-podium');const rows=ranking();
    for(const index of [1,0,2]){const row=rows[index];if(!row)continue;const place=el('article',`portal-podium-place place-${index+1}`);place.append(el('span','portal-podium-rank',`#${index+1}`),avatar(row),el('h3','',row.name),line(`${number(row.points)} prestige · ${row.wins} victoire(s)`));podium.append(place);}panel.append(podium);
    const table = el('table', 'poker-ranking');
    const head = el('thead'), header = el('tr');
    for (const label of ['Rang', 'Joueur', 'Prestige', 'Tournois', 'Victoires']) header.append(el('th', '', label));
    head.append(header); table.append(head);
    const body = el('tbody');
    let position = 0;
    for (const row of ranking()) {
      position++;
      const item = el('tr');
      item.append(el('td', '', `#${position}`));
      const name = el('td', 'poker-ranking__name'); name.append(avatar(row), el('strong', '', row.name)); item.append(name);
      item.append(el('td', '', number(row.points)), el('td', '', String(row.played)), el('td', '', String(row.wins)));
      body.append(item);
    }
    table.append(body);const wrap=el('div','portal-table-wrap');wrap.append(table);panel.append(wrap,hint('Classement actif dès le premier tournoi · 1er +20 · 2e −5 · 3e −15'));target.append(panel);
  }
  function renderProfiles(target) {
    const roster = el('div', 'portal-players'), detail = el('section', 'portal-card portal-profile-detail');
    const rows = ranking();
    const selected = rows.find(row => same(row.id, chosenProfileId)) || rows.find(row => same(row.id, currentProfile()?.id)) || rows[0];
    rows.forEach(row => { const member = button('', () => { chosenProfileId = row.id; renderProfiles(target); }, 'portal-player-card'); member.replaceChildren(avatar(row), el('strong', '', row.name), el('span', 'portal-card-arrow', '›')); member.classList.toggle('is-chosen', same(row.id, selected?.id)); roster.append(member); });
    if (selected) {
      const portrait=el('div','portal-profile-portrait');portrait.append(avatar(selected));const content=el('div','portal-profile-content'),heading=el('div','portal-profile-heading');heading.append(title(selected.name),line('Membre du club Poker','portal-profile-membership'));
      const metrics=el('div','portal-profile-metrics');for(const [icon,value,label] of [['poker',selected.played,'tournois'],['trophy',selected.wins,'victoires'],['percent',`${selected.played?Math.round(selected.wins/selected.played*100):0}%`,'de victoire']]){const m=el('div'),g=el('span','portal-metric-icon');g.append(navigationIcon(icon));m.append(g,el('strong','',value),el('span','',label));metrics.append(m);}
      const badges=el('div','portal-profile-badges');badges.append(el('span','',`${number(selected.points)} points de prestige`),el('span','',`${selected.podiums} podium(s)`));
      content.append(el('span','portal-profile-rank',`#${rows.indexOf(selected)+1}`),heading,metrics,badges,button('Voir le classement',()=>callbacks.open?.('ranking'),'online-action--primary'));
      const facts=el('div','portal-profile-facts');facts.append(line(selected.played?'Membre classé · Texas Hold’em':'Classement actif dès le premier tournoi.'),line('20 000 jetons de départ · Une table, trois joueurs.'));detail.append(portrait,content,facts);
    }
    target.replaceChildren(roster, detail);
  }
  function renderHistory(target) {
    const matches = records(),panel=card('Tournois du club'),personalPanel=card('Mes dernières parties');panel.classList.add('portal-history-column');personalPanel.classList.add('portal-history-column');
    const rowFor=match=>{
      const winner = (match.players || []).find(player => same(player.id, match.placements?.[0]));
      const row=el('article','portal-history-row'),meta=line(`${new Date(match.endedAt).toLocaleString('fr-FR')} · ${match.hands} mains`,'portal-history-meta');
      row.append(meta,el('h3','',`${winner?.name || 'Joueur'} gagne le tournoi`),line((match.players || []).map(p=>p.name).join(' · ')),el('span','portal-history-arrow','›'));return row;
    };
    if(!matches.length)panel.append(hint('Les prochaines victoires s’écriront ici.'));matches.slice(historyPage*4,historyPage*4+4).forEach(m=>panel.append(rowFor(m)));
    if(matches.length>4){const pager=el('nav','portal-pagination'),prev=button('‹',()=>{historyPage--;target.replaceChildren();renderHistory(target);}),next=button('›',()=>{historyPage++;target.replaceChildren();renderHistory(target);});prev.disabled=!historyPage;next.disabled=(historyPage+1)*4>=matches.length;pager.append(prev,el('span','',`${historyPage+1} / ${Math.ceil(matches.length/4)}`),next);panel.append(pager);}
    const mine=matches.filter(m=>(m.players||[]).some(p=>same(p.id,currentProfile()?.id)));if(!mine.length)personalPanel.append(hint('Votre premier tournoi vous attend.'));mine.slice(0,4).forEach(m=>personalPanel.append(rowFor(m)));target.append(panel,personalPanel);
  }
  function renderAdmin(target) {
    if (!access.unlocked) {
      const panel = card('Administration Poker');
      panel.classList.add('poker-admin-login-card');
      panel.prepend(navigationIcon('admin'));
      const form = el('form', 'portal-admin-login');
      const label = el('label', 'online-label', 'Mot de passe administrateur');
      const input = el('input', 'online-input'); input.type = 'password'; input.autocomplete = 'off'; label.append(input);
      const submitButton = button('Déverrouiller'); submitButton.type = 'submit';
      form.append(label, submitButton);
      form.addEventListener('submit', async event => {
        event.preventDefault(); submitButton.disabled = true;
        try { if (await access.unlock(input.value)) { input.value = ''; target.replaceChildren(); renderAdmin(target); } else flash('Mot de passe incorrect.', true); }
        finally { submitButton.disabled = false; }
      });
      panel.append(form); target.append(panel); return;
    }
    const roomPanel = card('Tables Poker'), historyPanel = card('Résultats Poker');
    for (const room of Object.values(rooms).filter(Boolean)) {
      const item = el('div', 'poker-admin-row');
      item.append(el('span', '', `${room.code} · ${STAGES[room.status] || room.status} · ${room.players.map(player => player.name).join(', ')}`));
      if (['playing','waiting'].includes(room.status)) item.append(button('Annuler la partie',()=>requestCancel(room),'online-action--danger'));
      else item.append(button('Supprimer', () => submit(async () => { await repo.remove(room.code); flash('Table supprimée.'); }), 'online-action--danger'));
      roomPanel.append(item);
    }
    for (const match of records()) {
      const item = el('div', 'poker-admin-row');
      item.append(el('span', '', `${match.code} · ${new Date(match.endedAt).toLocaleString('fr-FR')}`));
      item.append(button('Retirer le résultat', () => submit(async () => { await repo.removeHistory(match.code); flash('Résultat retiré du classement Poker.'); }), 'online-action--danger'));
      historyPanel.append(item);
    }
    target.append(roomPanel, historyPanel);
  }
  function renderPage(page, target, { profiles = [] } = {}) {
    setProfileList(profiles);
    target.replaceChildren();
    if (page === 'home') renderHome(target);
    else if (page === 'online') renderOnline(target);
    else if (page === 'ranking') renderRanking(target);
    else if (page === 'profiles') renderProfiles(target);
    else if (page === 'history') renderHistory(target);
    else if (page === 'admin') renderAdmin(target);
  }

  stopRooms = repo.watchRooms(value => { rooms = value; refresh(); }, error => flash(error.message, true));
  stopHistory = repo.watchHistory(value => { history = value; refresh(); }, error => flash(error.message, true));
  const stopLobby = repo.watchChat('LOBBY', value => { lobbyChat = value; if(!sceneVisible)refresh(); }, error => flash(error.message,true));
  return {
    setCallbacks, renderPage, showScene, hideScene, createRoom, enterRoom,
    setPresences(value) { presences = value || {}; },
    get isScene() { return sceneVisible; }, get currentRoom() { return currentRoom; }, get currentCode() { return currentCode; },
    get counts() { return { players: allProfiles().length, tournaments: records().length, rooms: roomList().length }; },
    dispose() { stopCurrent(); stopRooms?.(); stopHistory?.(); stopLobby?.(); clearTimeout(toastTimer); shell.remove(); }
  };
}
