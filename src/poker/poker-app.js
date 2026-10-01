import { PokerRepository } from './poker-repository.js?v=20261001T003934265';
import { applyPokerPortalSkin } from './poker-portal-skin.js?v=20261001T003934265';
import { pokerRanking, pokerBlindStatus, pokerSettings, pokerSeatMap, pokerPotAward, POKER_STACK_CHOICES, POKER_LEVEL_MINUTES } from './poker-engine.js?v=20261001T003934265';
import { createPokerCard, createChipStack } from './poker-cards.js?v=20261001T003934265';
import { element as el, button, card, avatar } from '../ui/club-elements.js?v=20261001T003934265';
import { characterIdForProfile } from '../online/profile-map.js?v=20261001T003934265';
import { playerAsset, playerCutoutAsset, hasPlayerCutout } from '../config/player-assets.js?v=20261001T003934265';
import { POKER_TABLE_STYLES, pokerTableStyle } from './poker-table-styles.js?v=20261001T003934265';
import { setOptimizedImage } from '../ui/image-source.js?v=20261001T003934265';
import { requestAppFullscreen } from '../ui/app-shell.js?v=20261001T003934265';
import { muteLoungeMusic, startLoungeMusic, stopLoungeMusic, toggleLoungeMusic, loungeMusicState, setLoungeMusicVolume } from '../ui/lounge-music.js?v=20261001T003934265';
import { navigationIcon } from '../ui/navigation-icon.js?v=20261001T003934265';
import { homeOrnament } from '../ui/home-ornaments.js?v=20261001T003934265';
import { playSound, unlockSound, soundEffectState, setSoundEffectVolume, toggleSoundEffects } from '../ui/sound-player.js?v=20261001T003934265';
import { loungeTitle, loungeIdentity } from '../online/lounge-name.js?v=20261001T003934265';

const number = value => Number(value || 0).toLocaleString('fr-FR');
const same = (left, right) => String(left) === String(right);
const STAGES = Object.freeze({ waiting: 'En attente', playing: 'En cours', finished: 'Terminée', cancelled: 'Annulée' });
const POKER_SCENE = POKER_TABLE_STYLES.luxe.scene;
const SEATS = Object.freeze(['top', 'left', 'right']);

function line(text, className = '') { return el('p', className, text); }
function title(text) { return el('h2', '', text); }
function hint(text) { return line(text, 'portal-muted'); }
function enabledConnection(canWrite) { return canWrite?.() !== false; }

export function createPokerApp({ database, identity, getLeaderId, getProfiles, access, canWrite, notify, now = () => Date.now() }) {
  const repo = new PokerRepository(database, { now });
  let rooms = {}, history = {}, handsHistory = {}, currentCode = '', currentRoom = null, chat = {}, role = 'spectator';
  let presences = {}, lobbyChat = {}, lobbyDraft = '', historyPage = 0, handsPage = 0;
  let chosenProfileId = '', sceneVisible = false, busy = false, callbacks = {};
  let stopRoom = null, stopChat = null, stopRooms = null, stopHistory = null, stopHands = null, toastTimer = null;
  let timelineTimer = null, blindTimer = null, revealTimer = null, lastEventSeq = 0;
  const app = document.querySelector('#app');
  const shell = el('section', 'game-shell poker-shell');
  shell.id = 'poker-shell'; shell.hidden = true; shell.dataset.roomStyle = 'luxe'; shell.dataset.tableLayout = 'club';
  shell.setAttribute('aria-label', 'Partie de poker en ligne');
  const stage = el('div', 'casino-stage poker-stage');
  const sceneBase = el('img', 'scene-base');
  sceneBase.alt = 'Salon privé et table de poker';
  setOptimizedImage(sceneBase, POKER_SCENE);
  sceneBase.dataset.asset = POKER_SCENE;
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
  const soundPanel = el('aside', 'poker-sound-panel'); soundPanel.hidden = true;
  const music = button('♫', () => { soundPanel.hidden = !soundPanel.hidden; music.setAttribute('aria-expanded', String(!soundPanel.hidden)); if (!soundPanel.hidden) renderSoundPanel(); }, 'poker-music is-muted');
  music.setAttribute('aria-label', 'Son et volume'); music.setAttribute('aria-expanded', 'false');
  const fullscreen = button('⛶', async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await requestAppFullscreen(); }, 'poker-fullscreen');
  fullscreen.setAttribute('aria-label', 'Plein écran');
  stage.append(menu, music, fullscreen, soundPanel);
  stage.addEventListener('pointerdown', event => {
    if (!soundPanel.contains(event.target) && !music.contains(event.target)) { soundPanel.hidden = true; music.setAttribute('aria-expanded', 'false'); }
  });
  soundPanel.addEventListener('keydown', event => { if (event.key === 'Escape') { soundPanel.hidden = true; music.setAttribute('aria-expanded', 'false'); music.focus(); } });

  function renderSoundPanel() {
    const ambient = loungeMusicState(), effects = soundEffectState();
    music.classList.toggle('is-muted', ambient.muted);
    soundPanel.replaceChildren(title('Son de la table'));
    for (const [label, state, setVolume, toggle] of [
      ['Musique', ambient, setLoungeMusicVolume, toggleLoungeMusic],
      ['Effets', effects, setSoundEffectVolume, toggleSoundEffects]
    ]) {
      const row = el('div', 'poker-sound-row'), range = el('input'), output = el('output', '', `${Math.round(state.volume * 100)} %`);
      range.type = 'range'; range.min = '0'; range.max = '100'; range.step = '1'; range.value = String(Math.round(state.volume * 100));
      range.setAttribute('aria-label', `Volume ${label.toLowerCase()}`);
      range.addEventListener('input', () => { setVolume(Number(range.value) / 100); output.textContent = `${range.value} %`; });
      row.append(button(`${state.muted ? 'Activer' : 'Couper'} ${label.toLowerCase()}`, () => { unlockSound(); toggle(); renderSoundPanel(); }), range, output);
      soundPanel.append(row);
    }
    soundPanel.append(button('Écouter le son Tapis', () => { unlockSound(); playSound('poker-all-in'); }));
  }
  const seats = Object.fromEntries(SEATS.map(seat => {
    const slot = el('div', `poker-seat poker-seat--${seat}`);
    const cards = el('div', 'poker-seat__cards');
    const chips = el('div', 'poker-seat__chips');
    const wager = el('div', 'poker-seat__wager');
    const positions = el('div', 'poker-seat__positions');
    const plaque = el('div', 'poker-seat__plaque');
    slot.append(cards, chips, wager, positions, plaque); stage.append(slot);
    return [seat, { slot, cards, chips, wager, positions, plaque }];
  }));
  const board = el('div', 'poker-board');
  const boardCards = el('div', 'poker-board__cards');
  const pot = el('div', 'poker-board__pot');
  const potChips = el('div', 'poker-board__chips');
  const sidePots = el('div', 'poker-board__side-pots');
  board.append(boardCards, potChips, pot, sidePots); stage.append(board);
  const blindClock = el('aside', 'poker-blind-clock');
  blindClock.setAttribute('aria-live', 'off'); stage.append(blindClock);
  const local = el('div', 'poker-local');
  const turn = el('p', 'poker-local__turn');
  const stack = el('div', 'poker-local__stack');
  const hand = el('div', 'poker-local__hand');
  hand.tabIndex = 0; hand.setAttribute('aria-label', 'Maintenez appuyé pour regarder vos cartes');
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

  function setPeeking(active) {
    hand.classList.toggle('is-peeking', Boolean(active));
    hand.setAttribute('aria-pressed', String(Boolean(active)));
    hand.querySelectorAll('.poker-card--concealed').forEach(cardView => cardView.setAttribute('aria-label', active ? cardView.dataset.cardLabel : 'Carte personnelle face cachée'));
  }
  hand.addEventListener('pointerdown', event => {
    if (!hand.querySelector('.poker-card--concealed')) return;
    event.preventDefault(); hand.setPointerCapture?.(event.pointerId); setPeeking(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) hand.addEventListener(type, () => setPeeking(false));
  hand.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setPeeking(true); } });
  hand.addEventListener('keyup', event => { if (event.key === ' ' || event.key === 'Enter') setPeeking(false); });
  globalThis.addEventListener?.('blur', () => setPeeking(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPeeking(false); });

  function flash(message, error = false) {
    clearTimeout(toastTimer);
    toast.textContent = message; toast.dataset.error = String(error); toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
    if (!sceneVisible) notify?.(message, error ? 'error' : 'gold');
  }
  function playPokerEvents(room) {
    const events = Array.isArray(room?.game?.events) ? room.game.events : Object.values(room?.game?.events || {});
    const sounds = {
      fold: 'poker-fold', check: 'poker-check', call: 'poker-call', raise: 'poker-raise', 'all-in': 'poker-all-in',
      'turn-player': 'poker-turn', flop: 'poker-flop', 'turn-card': 'poker-turn-card', river: 'poker-river',
      showdown: 'poker-win', 'win-fold': 'poker-win', 'show-cards': 'poker-show-cards'
    };
    for (const event of events.sort((a, b) => Number(a.seq) - Number(b.seq))) {
      const sequence = Number(event.seq || 0);
      if (sequence <= lastEventSeq) continue;
      lastEventSeq = sequence;
      if (!sceneVisible || now() - Number(event.at || 0) > 3500) continue;
      if (sounds[event.type]) playSound(sounds[event.type]);
    }
  }
  function scheduleTimeline(room, retryDelay = 0) {
    clearTimeout(timelineTimer); timelineTimer = null;
    if (room?.status !== 'playing' || room.game?.status !== 'runout' || role !== 'player') return;
    const expectedHandId = room.game.handId;
    const wait = Math.max(0, Number(room.game.runout?.nextTransitionAt || 0) - now());
    timelineTimer = setTimeout(async () => {
      if (!enabledConnection(canWrite)) { scheduleTimeline(currentRoom, 1000); return; }
      try { await repo.advance(room.code, currentProfile()?.id, { expectedHandId }); }
      catch (error) {
        if (!/déjà|Aucune distribution|pas encore/.test(error.message || '')) flash(error.message || 'Distribution interrompue.', true);
        if (currentRoom?.code === room.code && currentRoom.game?.handId === expectedHandId && currentRoom.game?.status === 'runout') scheduleTimeline(currentRoom, 750);
      }
    }, Math.min(2147483647, Math.max(wait + 50, retryDelay)));
  }
  function renderBlindClock(room) {
    clearTimeout(blindTimer); blindTimer = null;
    if (!sceneVisible || !room?.startedAt || !['playing', 'finished'].includes(room.status)) { blindClock.hidden = true; return; }
    blindClock.hidden = false;
    const status = pokerBlindStatus(room, room.status === 'finished' ? Number(room.finishedAt || now()) : now());
    const seconds = Math.ceil(status.remainingMs / 1000);
    const minutes = Math.floor(seconds / 60), rest = String(seconds % 60).padStart(2, '0');
    blindClock.replaceChildren(
      el('span', 'poker-blind-clock__level', `Niveau ${status.level}`),
      el('strong', '', `${number(status.current.small)} / ${number(status.current.big)}`),
      el('span', 'poker-blind-clock__time', status.next ? `${String(minutes).padStart(2, '0')}:${rest}` : 'MAX'),
      el('small', '', status.next ? `Prochain · ${number(status.next.small)} / ${number(status.next.big)}${status.pendingNextHand ? ' · prochaine main' : ''}` : 'Blindes maximales')
    );
    blindClock.classList.toggle('is-pending', status.pendingNextHand);
    if (room.status === 'playing') blindTimer = setTimeout(() => renderBlindClock(currentRoom), 250);
  }
  function refresh() { callbacks.refresh?.(); if (sceneVisible) renderScene(); }
  function setCallbacks(next) { callbacks = next || {}; }
  function setProfileList(profiles) { if (Array.isArray(profiles)) cachedProfiles = profiles; }
  let cachedProfiles = [];
  const currentProfile = () => identity()?.profile || null;
  const allProfiles = () => getProfiles?.() || cachedProfiles;
  const records = () => Object.values(history).filter(row => row && !row.deleted).sort((a, b) => Number(b.endedAt) - Number(a.endedAt));
  const handRecords = () => {
    const byId = new Map();
    const add = hand => { if (!hand?.id) return; const former = byId.get(hand.id); if (!former || Number(hand.revision || 0) >= Number(former.revision || 0)) byId.set(hand.id, hand); };
    for (const [code, room] of Object.entries(rooms)) if (!room?.deleted && !handsHistory[code]?.deleted) Object.values(room?.completedHands || {}).forEach(add);
    for (const group of Object.values(handsHistory)) if (group && !group.deleted) Object.values(group).forEach(add);
    return [...byId.values()].sort((a,b) => Number(b.endedAt) - Number(a.endedAt));
  };
  const ranking = () => pokerRanking(records(), allProfiles(), handRecords());
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
  function stopCurrent() {
    stopRoom?.(); stopChat?.(); stopRoom = null; stopChat = null;
    clearTimeout(timelineTimer); clearTimeout(blindTimer); clearTimeout(revealTimer);
    timelineTimer = null; blindTimer = null; revealTimer = null;
  }
  function enterRoom(code) {
    const normalized = String(code || '').toUpperCase();
    if (!normalized) return;
    stopCurrent(); currentCode = normalized; currentRoom = rooms[normalized] || null;
    lastEventSeq = Number(currentRoom?.game?.eventSeq || 0);
    role = currentRoom?.players?.some(player => same(player.id, currentProfile()?.id)) ? 'player' : 'spectator';
    chat = {};
    stopRoom = repo.watchRoom(normalized, room => {
      if (!room || room.deleted || room.status === 'cancelled') {
        currentRoom = null; currentCode = ''; stopCurrent(); hideScene(); callbacks.open?.('online'); flash('Cette table n’est plus disponible.'); return;
      }
      currentRoom = room; rooms[normalized] = room;
      role = room.players.some(player => same(player.id, currentProfile()?.id)) ? 'player' : 'spectator';
      repo.recordHands(room).catch(error => flash(error.message, true));
      if (room.status === 'finished') repo.recordFinished(room).catch(error => flash(error.message, true));
      playPokerEvents(room); renderScene(); refresh();
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
    muteLoungeMusic(); startLoungeMusic(); unlockSound();
    music.classList.add('is-muted'); soundPanel.hidden = true;
    renderScene();
    requestAppFullscreen();
  }
  function hideScene() {
    sceneVisible = false; shell.hidden = true; stopLoungeMusic();
    clearTimeout(blindTimer); clearTimeout(revealTimer);
    scheduleTimeline(currentRoom);
  }
  function roomList() { return Object.values(rooms).filter(room => room && ['waiting', 'playing'].includes(room.status)).sort((a, b) => Number(b.createdAt) - Number(a.createdAt)); }

  function seatMap(room) {
    return pokerSeatMap(room, getLeaderId?.());
  }
  function renderSeats(room) {
    const map = seatMap(room), game = room.game;
    for (const seat of SEATS) {
      const player = map[seat], image = portraits[seat], view = seats[seat];
      view.slot.hidden = !player; image.hidden = !player;
      if (!player) continue;
      const characterId = characterIdForProfile(player);
      const cutout = POKER_TABLE_STYLES[pokerTableStyle(room.style)].layout === 'luxe' && hasPlayerCutout(characterId, seat);
      const asset = cutout ? playerCutoutAsset(characterId, seat) : playerAsset(characterId, seat);
      if (image.dataset.asset !== asset.src) { setOptimizedImage(image, asset.src); image.dataset.asset = asset.src; }
      image.dataset.characterId = characterId; image.dataset.renderMode = cutout ? 'cutout' : 'scene';
      image.alt = `${player.name} assis à la table de poker`;
      const active = room.status === 'playing' && game?.status === 'betting' && same(game.turnId, player.id);
      view.slot.classList.toggle('is-turn', active);
      view.slot.classList.toggle('is-folded', Boolean(game?.folded?.[String(player.id)]));
      view.slot.classList.toggle('is-all-in', Boolean(game?.allIn?.[String(player.id)]));
      view.cards.replaceChildren();
      if (game?.holeCards?.[String(player.id)]?.length) {
        const folded = Boolean(game.folded?.[String(player.id)]);
        const foldReveal = game.status === 'showdown' && game.lastResult?.type === 'fold' && game.lastResult.shownCards && game.lastResult.winners.some(id => same(id, player.id));
        const reveal = !folded && (game.status === 'runout' || (game.status === 'showdown' && game.lastResult?.type === 'showdown') || foldReveal);
        view.slot.classList.toggle('is-showdown', reveal);
        const bestFive = new Set(game.lastResult?.hands?.[String(player.id)]?.bestFive || []);
        for (const card of game.holeCards?.[String(player.id)] || []) {
          const cardView = createPokerCard(card, { hidden: !reveal, small: true });
          if (reveal && game.status === 'showdown' && bestFive.size) cardView.classList.add(bestFive.has(card) ? 'is-best-card' : 'is-unused-card');
          view.cards.append(cardView);
        }
      } else view.slot.classList.remove('is-showdown');
      view.chips.replaceChildren();
      if (room.status !== 'waiting' && player.stack > 0) view.chips.append(createChipStack(player.stack, seat === 'right' ? 'red' : seat === 'left' ? 'green' : 'black'));
      view.wager.replaceChildren();
      const wager = Number(game?.bets?.[String(player.id)] || 0);
      if (wager > 0 && ['betting', 'runout'].includes(game?.status)) view.wager.append(createChipStack(wager, seat === 'right' ? 'red' : seat === 'left' ? 'green' : 'black', { compact: true }), el('strong', '', number(wager)));
      view.positions.replaceChildren();
      const playerIndex = room.players.findIndex(item => same(item.id, player.id));
      if (game && playerIndex === Number(game.dealerIndex)) view.positions.append(el('span', 'poker-position poker-position--dealer', 'D'));
      if (game && playerIndex === Number(game.smallIndex)) view.positions.append(el('span', 'poker-position poker-position--small', 'PB'));
      if (game && playerIndex === Number(game.bigIndex)) view.positions.append(el('span', 'poker-position poker-position--big', 'GB'));
      view.slot.dataset.playerId = String(player.id);
      view.plaque.replaceChildren(el('span', 'poker-seat__symbol', '⚜'), el('strong', '', player.name), el('span', 'poker-seat__balance', `Jetons : ${number(room.status === 'waiting' ? pokerSettings(room.settings).startingStack : player.stack)}`));
      if (game?.folded?.[String(player.id)]) view.plaque.append(el('em', '', 'Couché'));
      else if (game?.allIn?.[String(player.id)] && ['betting', 'runout'].includes(game.status)) view.plaque.append(el('em', '', 'Tapis'));
    }
  }
  function renderBoard(room) {
    const game = room.game;
    boardCards.replaceChildren(); potChips.replaceChildren(); sidePots.replaceChildren();
    const primaryWinner = game?.lastResult?.pots?.[0]?.winners?.[0] ?? game?.lastResult?.winners?.[0];
    const bestFive = new Set(game?.lastResult?.hands?.[String(primaryWinner)]?.bestFive || []);
    const displayedBoard = game?.status === 'showdown' && game.lastResult?.previewBoard?.length === 5
      ? game.lastResult.previewBoard : game?.board || [];
    for (let index = 0; index < 5; index += 1) {
      const slot = el('span', 'poker-board__slot');
      slot.dataset.cardPosition = String(index + 1);
      const card = displayedBoard[index];
      if (!card) { slot.setAttribute('aria-hidden', 'true'); boardCards.append(slot); continue; }
      const view = createPokerCard(card);
      if (index >= (game?.board?.length || 0)) view.classList.add('is-preview-card');
      else if (game?.status === 'showdown' && bestFive.size) view.classList.add(bestFive.has(card) ? 'is-best-card' : 'is-unused-card');
      slot.append(view);
      boardCards.append(slot);
    }
    if (game?.pot) {
      potChips.append(createChipStack(game.pot, 'red', { compact: true }));
    }
    pot.textContent = game ? `Pot : ${number(game.pot)}` : 'Pot : 0';
    const resultPots = game?.lastResult?.pots || [];
    if (resultPots.length > 1) resultPots.forEach((item, index) => sidePots.append(el('span', '', `${index ? `Pot annexe ${index}` : 'Pot principal'} · ${number(item.amount)}`)));
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
    const canAct = role === 'player' && game?.status === 'betting' && me && !game.folded?.[String(me.id)] && same(game.turnId, me.id);
    local.hidden = !game || ['runout', 'showdown'].includes(game.status);
    if (!game) return;
    const folded = Boolean(me && game.folded?.[String(me.id)]);
    local.classList.toggle('is-folded', folded);
    const turnPlayer = room.players.find(player => same(player.id, game.turnId));
    turn.textContent = game.status === 'showdown' ? 'Fin de la main' : folded ? (turnPlayer ? `Vous êtes couché · Tour de ${turnPlayer.name}` : 'Vous êtes couché') : canAct ? 'À vous de jouer' : turnPlayer ? `Tour de ${turnPlayer.name}` : 'Distribution des cartes';
    const handKey = `${game.handId}:${me?.id}:${Boolean(game.folded?.[String(me?.id)])}:${game.status}:${(game.holeCards?.[String(me?.id)] || []).join(',')}`;
    const keepPeeking = hand.dataset.handKey === handKey && hand.classList.contains('is-peeking');
    setPeeking(false); stack.replaceChildren(); hand.replaceChildren(); controls.replaceChildren();
    hand.dataset.handKey = handKey;
    if (me) {
      if (me.stack > 0) stack.append(createChipStack(me.stack, 'green', { compact: true }));
      stack.append(el('span', '', `Jetons : ${number(me.stack)}`));
      for (const card of game.holeCards?.[String(me.id)] || []) {
        const view = createPokerCard(card);
        if (game.status === 'betting') {
          view.dataset.cardLabel = view.getAttribute('aria-label') || '';
          view.setAttribute('aria-label', 'Carte personnelle face cachée');
          view.classList.add('poker-card--concealed');
        }
        hand.append(view);
      }
    } else stack.append(el('span', '', 'Vous regardez la table'));
    if (keepPeeking) setPeeking(true);
    const owed = canAct ? Math.max(0, game.currentBet - (game.bets[String(me.id)] || 0)) : 0;
    if (canAct) {
      const expected = { expectedHandId: game.handId, expectedRevision: game.revision };
      controls.append(actionButton('Se coucher', () => submit(() => repo.action(currentCode, me.id, 'fold', undefined, expected)), 'poker-action--fold'));
      const callAmount = Math.min(owed, me.stack);
      controls.append(actionButton(owed ? `${callAmount === me.stack ? 'Tapis' : 'Suivre'} ${number(callAmount)}` : 'Parole', () => submit(() => repo.action(currentCode, me.id, owed ? 'call' : 'check', undefined, expected)), 'poker-action--call'));
      const bounds = raiseBounds(game, me);
      const facedSinceAction = Math.max(0, Number(game.currentBet || 0) - Number(game.actedAtBet?.[String(me.id)] || 0));
      const fundedPlayers = room.players.filter(player => !game.folded[String(player.id)] && !game.allIn[String(player.id)] && player.stack > 0);
      const canRaise = fundedPlayers.length > 1 && bounds.maximum > game.currentBet && (!game.acted[String(me.id)] || facedSinceAction >= Number(game.minRaise || 0));
      raiseBox.hidden = !canRaise;
      if (canRaise) {
        raiseSlider.min = String(bounds.minimum); raiseSlider.max = String(bounds.maximum);
        raiseSlider.step = '1'; raiseSlider.value = String(bounds.minimum);
        raiseValue.value = number(bounds.minimum); raiseValue.textContent = number(bounds.minimum);
      }
      const raise = actionButton(Number(raiseSlider.value) === bounds.maximum ? 'Tapis' : 'Relancer', () => submit(() => repo.action(currentCode, me.id, 'raise', Number(raiseSlider.value), expected)), 'poker-action--raise');
      raiseSlider.oninput = () => { raiseValue.value = number(raiseSlider.value); raiseValue.textContent = number(raiseSlider.value); raise.textContent = Number(raiseSlider.value) === bounds.maximum ? 'Tapis' : 'Relancer'; };
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
      waiting.append(title(loungeTitle(room, room.players.find(player => same(player.id, room.hostId)))), hint(`${room.players.length} / 3 joueurs · ${number(pokerSettings(room.settings).startingStack)} jetons chacun · aucune mise réelle`));
      const members = el('div', 'poker-waiting__members');
      room.players.forEach(player => members.append(avatar(player), el('strong', '', player.name)));
      waiting.append(members);
      waiting.append(settingsControls(room));
      if (role === 'player') {
        const start = button('Lancer la partie', () => submit(() => repo.start(currentCode, currentProfile().id)), 'poker-action poker-action--raise');
        start.disabled = room.players.length !== 3 || busy;
        waiting.append(start);
      } else waiting.append(hint('Un joueur lancera la partie lorsque les trois sièges seront occupés.'));
      waiting.append(button(role === 'spectator' ? 'Retour aux tables' : 'Quitter la table', leaveRoom, 'poker-action poker-action--fold'));
    }
    const game = room.game;
    if (game?.status !== 'showdown') return;
    const last = game.lastResult || {};
    const primary = last.pots?.[0];
    const primaryNames = (primary?.winners || last.winners || []).map(id => room.players.find(player => same(player.id, id))?.name || 'Joueur');
    const resultTitle = room.status === 'finished'
      ? 'Tournoi terminé'
      : last.type === 'showdown'
        ? `${primaryNames.join(' et ')} gagne${primaryNames.length > 1 ? 'nt' : ''} avec ${primary?.handLabel || last.handName}`
        : `${primaryNames[0] || 'Le joueur'} remporte le pot`;
    result.append(title(resultTitle));
    result.append(line(last.type === 'fold' ? 'Tous les adversaires se sont couchés.' : 'Les meilleures cartes sont éclairées sur la table.', 'poker-result__hand'));
    const awardRows = el('div', 'poker-result__rows');
    (last.pots || []).forEach((item, index) => {
      const winners = (item.winners || []).map(id => room.players.find(player => same(player.id, id))?.name || 'Joueur').join(' et ');
      awardRows.append(line(`${index ? `Pot annexe ${index}` : 'Pot principal'} · ${number(item.amount)} · ${winners} · ${item.handLabel || 'sans dévoiler'}`));
    });
    if (!(last.pots || []).length) room.players.forEach(player => {
      const award = Number(last.awards?.[String(player.id)] || 0);
      if (award > 0) awardRows.append(line(`${player.name} · +${number(award)} jetons`));
    });
    result.append(awardRows);
    if (last.previewBoard?.length === 5) result.append(line('Cartes hypothétiques affichées sur le tapis · résultat inchangé.', 'poker-result__hand'));
    clearTimeout(revealTimer); revealTimer = null;
    const revealRemaining = last.type === 'fold' ? Math.max(0, Number(last.revealChoiceUntil || 0) - now()) : 0;
    const currentIsWinner = (last.winners || []).some(id => same(id, currentProfile()?.id));
    if (revealRemaining > 0 && currentIsWinner && !last.shownCards) result.append(button(`Montrer mes cartes · ${Math.ceil(revealRemaining / 1000)} s`, () => submit(() => repo.showCards(currentCode, currentProfile().id)), 'poker-action poker-action--call'));
    if (last.type === 'fold' && last.shownCards) result.append(line('Cartes du gagnant dévoilées sur la table.', 'poker-result__hand'));
    if (revealRemaining > 0) revealTimer = setTimeout(() => renderScene(), Math.min(250, revealRemaining + 20));
    if (room.status === 'finished') {
      const ranks = el('ol', 'poker-result__placements');
      room.result.placements.forEach((id, index) => {
        const player = room.players.find(item => same(item.id, id));
        const delta = room.result.points[String(id)];
        ranks.append(el('li', '', `${player?.name || 'Joueur'} · ${delta > 0 ? '+' : ''}${delta} prestige`));
      });
      result.append(ranks, button('Retour au salon Poker', () => callbacks.open?.('online'), 'poker-action poker-action--call'));
    } else if (role === 'player') {
      const next = button(revealRemaining > 0 ? `Main suivante · ${Math.ceil(revealRemaining / 1000)} s` : 'Main suivante', () => submit(() => repo.nextHand(currentCode, currentProfile().id, { expectedHandId: game.handId })), 'poker-action poker-action--raise');
      next.disabled = revealRemaining > 0 || busy;
      const actions = el('div', 'poker-result__actions');
      actions.append(next);
      const showBoard = button('Afficher les cartes', () => submit(() => repo.showRemainingBoard(currentCode, currentProfile().id)), 'poker-action poker-action--call');
      showBoard.disabled = busy || game.board.length >= 5 || last.previewBoard?.length === 5;
      actions.append(showBoard);
      result.append(actions);
    } else result.append(hint('Un joueur assis lancera la main suivante.'));
  }
  function renderScene() {
    if (!currentRoom || !currentCode) return;
    const room = currentRoom;
    stage.classList.toggle('is-revealing', ['runout', 'showdown'].includes(room.game?.status));
    const table = POKER_TABLE_STYLES[pokerTableStyle(room.style)];
    shell.dataset.roomStyle = table.layout;
    shell.dataset.pokerTable = pokerTableStyle(room.style);
    const sceneAsset = table.scene;
    if (sceneBase.dataset.asset !== sceneAsset) { setOptimizedImage(sceneBase, sceneAsset); sceneBase.dataset.asset = sceneAsset; }
    cancelGame.hidden = !['waiting', 'playing'].includes(room.status) || !same(room.hostId, currentProfile()?.id);
    renderSeats(room); renderBoard(room); renderLocal(room); renderOverlays(room);
    renderBlindClock(room); scheduleTimeline(room);
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
    const host = room.players.find(player => same(player.id, room.hostId));
    const section = card(loungeTitle(room, host));
    section.classList.add('poker-lobby-room');
    section.append(hint(`${loungeIdentity(room, host).territory} · ${STAGES[room.status] || room.status} · ${room.players.length}/3 joueurs · ${room.code}`));
    const portraits = el('div', 'poker-lobby-room__portraits');
    room.players.forEach(player => { const one = el('div'); one.append(avatar(player), el('span', '', player.name)); portraits.append(one); });
    section.append(portraits);
    const mine = room.players.some(player => same(player.id, currentProfile()?.id));
    const enter = button(room.status === 'waiting' && !mine ? 'Rejoindre' : mine ? 'Entrer à la table' : 'Regarder', () => room.status === 'waiting' && !mine ? joinRoom(room.code) : resumeRoom(room.code), 'online-action--primary');
    enter.disabled = room.status === 'waiting' && !mine && room.players.length >= 3;
    section.append(enter);
    if (room.status === 'waiting') {
      section.append(settingsControls(room));
      if (mine) {
        const start = button('Lancer la partie', () => submit(async () => { await repo.start(room.code, currentProfile().id); enterRoom(room.code); }), 'online-action--primary poker-lobby-start');
        start.disabled = room.players.length !== 3 || busy; section.append(start);
      }
    }
    if (same(room.hostId, currentProfile()?.id)) section.append(button('Annuler la partie', () => requestCancel(room), 'poker-room-cancel'));
    return section;
  }
  function settingsControls(room) {
    const group = el('div', 'poker-table-settings');
    const settings = pokerSettings(room.settings);
    const definitions = [
      ['style', 'Table', Object.entries(POKER_TABLE_STYLES).map(([value, option]) => [value, option.label]), pokerTableStyle(room.style)],
      ['blindMinutes', 'Durée des niveaux', POKER_LEVEL_MINUTES.map(value => [value, `${value} minute${value > 1 ? 's' : ''}`]), settings.blindMinutes],
      ['startingStack', 'Jetons de départ', POKER_STACK_CHOICES.map(value => [value, `${number(value)} jetons`]), settings.startingStack]
    ];
    for (const [field, text, choices, value] of definitions) {
      const label = el('label', '', text), select = el('select');
      select.setAttribute('aria-label', text); select.dataset.setting = field;
      for (const [id, text] of choices) { const option = el('option', '', text); option.value = String(id); select.append(option); }
      select.value = String(value); select.disabled = !same(room.hostId, currentProfile()?.id) || busy;
      select.addEventListener('change', () => {
        const latest = rooms[room.code] || room;
        submit(() => repo.settings(room.code, currentProfile().id, { ...pokerSettings(latest.settings), style: latest.style, [field]: field === 'style' ? select.value : Number(select.value) }));
      });
      label.append(select); group.append(label);
    }
    return group;
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
    const rows=ranking(), me=currentProfile() || allProfiles()[0];
    const mineIndex=rows.findIndex(row=>same(row.id,me?.id)), mine=rows[mineIndex];
    const member=el('section','portal-card portal-member-card portal-home-card portal-home-profile');
    member.append(el('span','portal-member-rank',mineIndex>=0?`#${mineIndex+1}`:'—'),pageHeading('profiles',me?.name || 'Mon profil'));
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
    const create=el('div','poker-create-table');
    for (const [style, table] of Object.entries(POKER_TABLE_STYLES)) {
      create.append(button(`Créer une table ${table.label}`, () => createRoom(style), style === 'luxe' ? 'online-action--primary' : ''));
    }
    const columns=el('div','poker-online-columns'),list=card('Tables du club');list.classList.add('poker-online-list');
    const active=roomList(), grid=el('div','poker-room-grid');if(!active.length){const empty=el('div','poker-empty');empty.append(navigationIcon('poker'),el('h3','','La prochaine partie vous attend'),line('Invitez deux partenaires et installez-vous à la table.'),button('Créer une salle',()=>createRoom(),'online-action--primary'));grid.append(empty);}else active.forEach(room=>grid.append(roomCard(room)));list.append(grid);
    const discussion=card('Discussion commune');discussion.classList.add('poker-common-chat');const messages=el('div','poker-common-messages');
    for(const entry of Object.values(lobbyChat).filter(Boolean).sort((a,b)=>a.at-b.at).slice(-40)){const row=el('p');row.append(el('strong','',entry.name),el('span','',entry.text));messages.append(row);}
    const form=el('form','poker-common-form'),input=el('input');input.placeholder='Écrire à tous les joueurs…';input.maxLength=300;input.value=lobbyDraft;input.setAttribute('aria-label','Message au club Poker');input.addEventListener('input',()=>{lobbyDraft=input.value;});const send=button('Envoyer');send.type='submit';
    form.append(input,send);form.addEventListener('submit',async event=>{event.preventDefault();if(!input.value.trim())return;send.disabled=true;try{await repo.sendChat('LOBBY',currentProfile(),input.value);lobbyDraft='';input.value='';}catch(error){flash(error.message,true);}finally{send.disabled=false;}});discussion.append(messages,form);columns.append(list,discussion);
    const note=el('div','poker-lobby-note');note.append(navigationIcon('poker'),el('span','','Texas Hold’em · 3 joueurs · Jetons et durée des niveaux réglables avant le lancement · Blindes initiales 100 / 200'));target.append(live,create,columns,note);messages.scrollTop=messages.scrollHeight;
  }
  function renderRanking(target) {
    const panel = card('Classement Prestige Poker');
    panel.classList.add('poker-ranking-panel');
    const podium=el('div','portal-podium');const rows=ranking();
    for(const index of [1,0,2]){const row=rows[index];if(!row)continue;const place=el('article',`portal-podium-place place-${index+1}`);place.append(el('span','portal-podium-rank',`#${index+1}`),avatar(row),el('h3','',row.name),line(`${number(row.points)} prestige · ${row.wins} victoire(s)`));podium.append(place);}panel.append(podium);
    const table = el('table', 'poker-ranking');
    const head = el('thead'), header = el('tr');
    for (const label of ['Rang', 'Joueur', 'Prestige', 'Tournois gagnés', 'Participations', 'Tapis Donnés']) header.append(el('th', '', label));
    head.append(header); table.append(head);
    const body = el('tbody');
    let position = 0;
    for (const row of ranking()) {
      position++;
      const item = el('tr');
      item.append(el('td', '', `#${position}`));
      const name = el('td', 'poker-ranking__name'); name.append(avatar(row), el('strong', '', row.name)); item.append(name);
      item.append(el('td', '', number(row.points)), el('td', '', String(row.wins)), el('td', '', String(row.played)), el('td', '', String(row.allInsGiven)));
      body.append(item);
    }
    table.append(body);const wrap=el('div','portal-table-wrap');wrap.append(table);const scoring=hint('Classement actif dès le premier tournoi · 1er +20 · 2e −5 · 3e −15');scoring.classList.add('poker-ranking-scoring');panel.append(wrap,scoring);target.append(panel);
  }
  function renderProfiles(target) {
    const roster = el('div', 'portal-players'), detail = el('section', 'portal-card portal-profile-detail');
    const rows = ranking();
    const selected = rows.find(row => same(row.id, chosenProfileId)) || rows.find(row => same(row.id, currentProfile()?.id)) || rows[0];
    rows.forEach(row => { const member = button('', () => { chosenProfileId = row.id; renderProfiles(target); }, 'portal-player-card'); member.replaceChildren(avatar(row), el('strong', '', row.name), el('span', 'portal-card-arrow', '›')); member.classList.toggle('is-chosen', same(row.id, selected?.id)); roster.append(member); });
    if (selected) {
      const portrait=el('div','portal-profile-portrait');portrait.append(avatar(selected));const content=el('div','portal-profile-content'),heading=el('div','portal-profile-heading');heading.append(title(selected.name),line('Membre du club Poker','portal-profile-membership'));
      const metrics=el('div','portal-profile-metrics');for(const [icon,value,label] of [['trophy',selected.wins,'tournois gagnés'],['poker',selected.handWins,'manches gagnées'],['ranking',selected.allInsGiven,'Tapis Donnés']]){const m=el('div'),g=el('span','portal-metric-icon');g.append(navigationIcon(icon));m.append(g,el('strong','',value),el('span','',label));metrics.append(m);}
      const badges=el('div','portal-profile-badges');badges.append(el('span','',`${number(selected.points)} points de prestige`),el('span','',`${selected.podiums} podium(s)`));
      content.append(el('span','portal-profile-rank',`#${rows.indexOf(selected)+1}`),heading,metrics,badges,button('Voir le classement',()=>callbacks.open?.('ranking'),'online-action--primary'));
      const facts=el('div','portal-profile-facts');facts.append(line(`${selected.played} participation(s) à un tournoi · Texas Hold’em`),line('Tapis Donnés : mises ou relances à tapis initiées, hors tapis suivis.'));detail.append(portrait,content,facts);
    }
    target.replaceChildren(roster, detail);
  }
  function renderHistory(target) {
    const matches = records(),panel=card('Tournois du club'),personalPanel=card('Mes dernières parties');panel.classList.add('portal-history-column');personalPanel.classList.add('portal-history-column','poker-personal-history');
    const rowFor=match=>{
      const winner = (match.players || []).find(player => same(player.id, match.placements?.[0]));
      const duration = durationLabel(Number(match.endedAt) - Number(match.startedAt));
      const row=el('article','portal-history-row'),meta=line(`${new Date(match.startedAt || match.endedAt).toLocaleString('fr-FR')} · ${duration} · ${match.hands} manches`,'portal-history-meta');
      row.append(meta,el('h3','',`${winner?.name || 'Joueur'} gagne le tournoi`),line((match.players || []).map(p=>p.name).join(' · ')),el('span','portal-history-arrow','›'));return row;
    };
    if(!matches.length)panel.append(hint('Les prochaines victoires s’écriront ici.'));matches.slice(historyPage*4,historyPage*4+4).forEach(m=>panel.append(rowFor(m)));
    if(matches.length>4){const pager=el('nav','portal-pagination'),prev=button('‹',()=>{historyPage--;target.replaceChildren();renderHistory(target);}),next=button('›',()=>{historyPage++;target.replaceChildren();renderHistory(target);});prev.disabled=!historyPage;next.disabled=(historyPage+1)*4>=matches.length;pager.append(prev,el('span','',`${historyPage+1} / ${Math.ceil(matches.length/4)}`),next);panel.append(pager);}
    const mine=handRecords().filter(m=>(m.players||[]).some(p=>same(p.id,currentProfile()?.id)));
    handsPage = Math.max(0, Math.min(handsPage, Math.ceil(mine.length / 2) - 1));
    if(!mine.length)personalPanel.append(hint('Vos prochaines manches apparaîtront ici avec les cartes dévoilées.'));
    mine.slice(handsPage*2,handsPage*2+2).forEach(match => {
      const row = el('article', 'poker-hand-history');
      row.append(line(`${new Date(match.endedAt).toLocaleString('fr-FR')} · Manche ${match.handNumber} · ${durationLabel(Number(match.endedAt) - Number(match.startedAt))}`, 'portal-history-meta'));
      const winners = (match.winners || []).map(id => { const player = match.players.find(p => same(p.id,id)); return `${player?.name || 'Joueur'} · +${number(pokerPotAward(match,id))} jetons`; });
      row.append(el('h3','',winners.join(' / ')), line(match.handName || 'Fin de la manche', 'poker-hand-history__result'));
      const shared = el('div','poker-history-cards');
      if (match.board?.length) { shared.append(el('strong','','Table')); match.board.forEach(value => shared.append(createPokerCard(value))); }
      else shared.append(hint('Aucune carte commune distribuée.'));
      row.append(shared);
      for (const player of match.players || []) {
        const cards = match.revealed?.[String(player.id)];
        if (!cards?.length) continue;
        const shown = el('div', 'poker-history-cards');
        shown.append(el('strong','',player.name)); cards.forEach(value => shown.append(createPokerCard(value))); row.append(shown);
      }
      if (!Object.keys(match.revealed || {}).length) row.append(hint('Cartes personnelles non dévoilées.'));
      personalPanel.append(row);
    });
    if(mine.length>2){const pager=el('nav','portal-pagination'),prev=button('‹',()=>{handsPage--;target.replaceChildren();renderHistory(target);}),next=button('›',()=>{handsPage++;target.replaceChildren();renderHistory(target);});prev.disabled=!handsPage;next.disabled=(handsPage+1)*2>=mine.length;pager.append(prev,el('span','',`${handsPage+1} / ${Math.ceil(mine.length/2)} · ${mine.length} manches`),next);personalPanel.append(pager);}
    target.append(panel,personalPanel);
  }
  function durationLabel(milliseconds) {
    const seconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
    return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2,'0')} s`;
  }
  function requestDelete(code) {
    if (!access.unlocked) return;
    const dialog = el('dialog', 'portal-dialog poker-confirm');
    dialog.append(title(`Supprimer la partie ${code} ?`), line('La salle, ses messages, ses manches et son résultat seront retirés. Les joueurs seront renvoyés au salon et le classement sera recalculé.'));
    dialog.append(button('Conserver', () => dialog.close()), button('Supprimer la partie', () => { dialog.close(); submit(async () => { await repo.remove(code); flash('Partie supprimée du Poker.'); }); }, 'online-action--danger'));
    dialog.addEventListener('close', () => dialog.remove(), { once:true }); document.body.append(dialog); dialog.showModal();
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
    for (const room of Object.values(rooms).filter(room => room && !room.deleted)) {
      const item = el('div', 'poker-admin-row');
      item.append(el('span', '', `${room.code} · ${STAGES[room.status] || room.status} · ${room.players.map(player => player.name).join(', ')}`));
      if (['playing','waiting'].includes(room.status)) item.append(button('Annuler la partie',()=>requestCancel(room),'online-action--danger'));
      item.append(button('Supprimer la partie', () => requestDelete(room.code), 'online-action--danger'));
      roomPanel.append(item);
    }
    for (const match of records()) {
      const item = el('div', 'poker-admin-row');
      item.append(el('span', '', `${match.code} · ${new Date(match.endedAt).toLocaleString('fr-FR')}`));
      item.append(button('Retirer le résultat', () => submit(async () => { await repo.removeHistory(match.code); flash('Résultat retiré du classement Poker.'); }), 'online-action--danger'));
      item.append(button('Supprimer la partie', () => requestDelete(match.code), 'online-action--danger'));
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
    applyPokerPortalSkin(target);
  }

  stopRooms = repo.watchRooms(value => { rooms = value; refresh(); }, error => flash(error.message, true));
  stopHistory = repo.watchHistory(value => { history = value; refresh(); }, error => flash(error.message, true));
  stopHands = repo.watchHands(value => { handsHistory = value; refresh(); }, error => flash(error.message, true));
  const stopLobby = repo.watchChat('LOBBY', value => { lobbyChat = value; if(!sceneVisible)refresh(); }, error => flash(error.message,true));
  return {
    setCallbacks, renderPage, showScene, hideScene, createRoom, enterRoom,
    setPresences(value) { presences = value || {}; },
    get isScene() { return sceneVisible; }, get currentRoom() { return currentRoom; }, get currentCode() { return currentCode; },
    get counts() { return { players: allProfiles().length, tournaments: records().length, rooms: roomList().length }; },
    dispose() { stopCurrent(); stopRooms?.(); stopHistory?.(); stopHands?.(); stopLobby?.(); clearTimeout(toastTimer); shell.remove(); }
  };
}
