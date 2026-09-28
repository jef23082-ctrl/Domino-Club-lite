import { FIREBASE_PATHS } from '../config/firebase.js?v=20260928T204111961';
import { randomId } from '../services/ids.js?v=20260928T204111961';
import { liveTransaction } from '../services/live-transaction.js?v=20260928T204111961';
import {
  createPokerRoom, joinPokerRoom, leavePokerRoom, choosePokerStyle,
  startPokerTournament, pokerAction, nextPokerHand, pokerHistoryRecord,
  shuffleDeck, normalizePokerRoom, cancelPokerTournament,
  advancePokerTimeline, showPokerCards, previewRemainingPokerBoard, choosePokerSettings
} from './poker-engine.js?v=20260928T204111961';

export class PokerRepository {
  constructor(database, { now = () => Date.now() } = {}) {
    this.database = database;
    this.now = now;
    this.rooms = database.ref(FIREBASE_PATHS.pokerRooms);
    this.history = database.ref(FIREBASE_PATHS.pokerHistory);
    this.hands = database.ref(FIREBASE_PATHS.pokerHands);
    this.chats = database.ref(FIREBASE_PATHS.pokerChats);
    this.archivedHands = new Map();
  }

  async create(profile, style = 'luxe') {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = randomId(5);
      const candidate = createPokerRoom({ code, profile, style, at: this.now() });
      const result = await liveTransaction(this.rooms.child(code), current => current ? undefined : candidate, undefined, false);
      if (result.committed) return code;
    }
    throw new Error('Impossible de créer une table unique.');
  }

  async #change(code, reducer) {
    let failure = null;
    const result = await liveTransaction(this.rooms.child(String(code || '').toUpperCase()), current => {
      try {
        if (current?.deleted) throw new Error('Cette partie a été supprimée.');
        return reducer(normalizePokerRoom(current));
      }
      catch (error) { failure = error; return undefined; }
    }, undefined, false);
    if (!result.committed) throw failure || new Error('La table a changé. Réessaie.');
    const room = result.snapshot.val();
    await this.recordHands(room);
    if (room?.status === 'finished') await this.recordFinished(room);
    return room;
  }

  join(code, profile) { return this.#change(code, room => joinPokerRoom(room, profile, this.now())); }
  leave(code, playerId) { return this.#change(code, room => leavePokerRoom(room, playerId)); }
  style(code, playerId, style) { return this.#change(code, room => choosePokerStyle(room, playerId, style)); }
  settings(code, playerId, settings) { return this.#change(code, room => choosePokerSettings(room, playerId, settings)); }
  cancel(code, playerId) { return this.#change(code, room => cancelPokerTournament(room, playerId, this.now())); }
  start(code, playerId) {
    const deck = shuffleDeck(), at = this.now();
    return this.#change(code, room => startPokerTournament(room, playerId, at, deck));
  }
  action(code, playerId, type, amount, expected = {}) {
    const at = this.now();
    const commandId = randomId(18);
    return this.#change(code, room => pokerAction(room, { playerId, type, amount, at, commandId, ...expected }));
  }
  nextHand(code, playerId, expected = {}) {
    const deck = shuffleDeck(), at = this.now(), commandId = randomId(18);
    return this.#change(code, room => nextPokerHand(room, playerId, at, deck, { commandId, ...expected }));
  }
  advance(code, playerId, expected = {}) {
    const at = this.now(), commandId = randomId(18);
    return this.#change(code, room => advancePokerTimeline(room, { playerId, at, commandId, ...expected }));
  }
  showCards(code, playerId) { return this.#change(code, room => showPokerCards(room, playerId, this.now())); }
  showRemainingBoard(code, playerId) { return this.#change(code, room => previewRemainingPokerBoard(room, playerId)); }
  async recordFinished(room) {
    if (room?.status !== 'finished') return;
    const record = pokerHistoryRecord(room);
    await liveTransaction(this.history.child(room.code), current => current || record, undefined, false);
  }
  async recordHands(room) {
    if (!room?.code || !Object.keys(room.completedHands || {}).length || room.deleted) return;
    const signature = Object.entries(room.completedHands).map(([id, hand]) => `${id}:${hand.revision || 0}`).join('|');
    if (this.archivedHands.get(room.code) === signature) return;
    await liveTransaction(this.hands.child(room.code), current => {
      if (current?.deleted) return undefined;
      const next = { ...(current || {}) };
      let changed = false;
      for (const [id, hand] of Object.entries(room.completedHands)) {
        if (!next[id] || Number(hand.revision || 0) > Number(next[id].revision || 0)) { next[id] = hand; changed = true; }
      }
      return changed ? next : undefined;
    }, undefined, false);
    this.archivedHands.set(room.code, signature);
  }
  async remove(code) {
    const normalized = String(code || '').toUpperCase();
    const room = (await this.rooms.child(normalized).once('value')).val();
    if (!normalized) throw new Error('Table manquante.');
    const tombstone = { deleted: true, deletedAt: this.now() };
    // One atomic multi-location update closes the room and removes its records.
    // Tombstones reject late actions and stale archive callbacks on all clients.
    await this.database.ref(FIREBASE_PATHS.pokerRoot).update({
      [`rooms/${normalized}`]: { ...tombstone, code: normalized, status: 'deleted', players: [] },
      [`history/${normalized}`]: tombstone, [`hands/${normalized}`]: tombstone,
      [`chats/${normalized}`]: null
    });
    return room;
  }
  async removeHistory(code) {
    // A tombstone prevents a still-open finished room from recording the same
    // result again on the next Firebase value event.
    await this.history.child(String(code || '').toUpperCase()).set({ deleted: true, deletedAt: this.now() });
  }
  watchRooms(onValue, onError) { return watch(this.rooms, snapshot => onValue(Object.fromEntries(Object.entries(snapshot.val() || {}).map(([code, room]) => [code, normalizePokerRoom(room)]))), onError); }
  watchHistory(onValue, onError) { return watch(this.history, snapshot => onValue(snapshot.val() || {}), onError); }
  watchHands(onValue, onError) { return watch(this.hands, snapshot => onValue(snapshot.val() || {}), onError); }
  watchRoom(code, onValue, onError) { return watch(this.rooms.child(String(code || '').toUpperCase()), snapshot => onValue(normalizePokerRoom(snapshot.val())), onError); }
  watchChat(code, onValue, onError) { return watch(this.chats.child(String(code || '').toUpperCase()).limitToLast(80), snapshot => onValue(snapshot.val() || {}), onError); }
  async sendChat(code, profile, message) {
    const text = String(message || '').trim().slice(0, 300);
    if (!text || profile?.id === undefined || profile?.id === null) throw new Error('Message ou profil manquant.');
    await this.chats.child(String(code || '').toUpperCase()).push().set({ playerId: profile.id, name: profile.name, text, at: this.now() });
  }
}

function watch(reference, onValue, onError) {
  const listener = snapshot => onValue(snapshot);
  reference.on('value', listener, onError);
  return () => reference.off('value', listener);
}
