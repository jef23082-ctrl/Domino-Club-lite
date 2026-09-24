import { FIREBASE_PATHS } from '../config/firebase.js?v=20260924T185554830';
import { randomId } from '../services/ids.js?v=20260924T185554830';
import { liveTransaction } from '../services/live-transaction.js?v=20260924T185554830';
import {
  createPokerRoom, joinPokerRoom, leavePokerRoom, choosePokerStyle,
  startPokerTournament, pokerAction, nextPokerHand, pokerHistoryRecord,
  shuffleDeck, normalizePokerRoom, cancelPokerTournament
} from './poker-engine.js?v=20260924T185554830';

export class PokerRepository {
  constructor(database, { now = () => Date.now() } = {}) {
    this.database = database;
    this.now = now;
    this.rooms = database.ref(FIREBASE_PATHS.pokerRooms);
    this.history = database.ref(FIREBASE_PATHS.pokerHistory);
    this.chats = database.ref(FIREBASE_PATHS.pokerChats);
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
      try { return reducer(normalizePokerRoom(current)); }
      catch (error) { failure = error; return undefined; }
    }, undefined, false);
    if (!result.committed) throw failure || new Error('La table a changé. Réessaie.');
    return result.snapshot.val();
  }

  join(code, profile) { return this.#change(code, room => joinPokerRoom(room, profile, this.now())); }
  leave(code, playerId) { return this.#change(code, room => leavePokerRoom(room, playerId)); }
  style(code, playerId, style) { return this.#change(code, room => choosePokerStyle(room, playerId, style)); }
  cancel(code, playerId) { return this.#change(code, room => cancelPokerTournament(room, playerId, this.now())); }
  start(code, playerId) {
    const deck = shuffleDeck(), at = this.now();
    return this.#change(code, room => startPokerTournament(room, playerId, at, deck));
  }
  action(code, playerId, type, amount) {
    const at = this.now();
    return this.#change(code, room => pokerAction(room, { playerId, type, amount, at }));
  }
  nextHand(code, playerId) {
    const deck = shuffleDeck(), at = this.now();
    return this.#change(code, room => nextPokerHand(room, playerId, at, deck));
  }
  async recordFinished(room) {
    if (room?.status !== 'finished') return;
    const record = pokerHistoryRecord(room);
    await liveTransaction(this.history.child(room.code), current => current || record, undefined, false);
  }
  async remove(code) {
    const normalized = String(code || '').toUpperCase();
    const room = (await this.rooms.child(normalized).once('value')).val();
    if (room?.status === 'playing') throw new Error('Termine le tournoi avant de supprimer sa salle.');
    await this.rooms.child(normalized).remove();
    await this.chats.child(normalized).remove();
  }
  async removeHistory(code) {
    // A tombstone prevents a still-open finished room from recording the same
    // result again on the next Firebase value event.
    await this.history.child(String(code || '').toUpperCase()).set({ deleted: true, deletedAt: this.now() });
  }
  watchRooms(onValue, onError) { return watch(this.rooms, snapshot => onValue(Object.fromEntries(Object.entries(snapshot.val() || {}).map(([code, room]) => [code, normalizePokerRoom(room)]))), onError); }
  watchHistory(onValue, onError) { return watch(this.history, snapshot => onValue(snapshot.val() || {}), onError); }
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
