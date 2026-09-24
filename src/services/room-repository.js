import { FIREBASE_PATHS } from '../config/firebase.js?v=20260924T185554830';
import {
  createInitialRoom,
  cancelRoomInState,
  joinWaitingRoom,
  reattachPlayerInRoom,
  selectRoomMusic,
  selectRoomStyle,
  selectTurnTimerInRoom,
  setTurnClockPausedInRoom,
  leaveWaitingRoom,
  passTurnInRoom,
  playTileInRoom,
  startMatchInRoom,
  startRematchInRoom,
  startNextRoundInRoom,
  timeoutTurnInRoom
} from '../game/room-state.js?v=20260924T185554830';
import { randomId } from './ids.js?v=20260924T185554830';
import { liveTransaction } from './live-transaction.js?v=20260924T185554830';
import { createLoungeName } from '../online/lounge-name.js?v=20260924T185554830';

export class RoomRepository {
  constructor(database, { now = () => Date.now() } = {}) {
    this.database = database;
    this.rooms = database.ref(FIREBASE_PATHS.rooms);
    this.now = now;
  }

  async create({ profile, clientToken, at } = {}) {
    const createdAt = Number.isFinite(at) ? at : this.now();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomId(5);
      const room = createInitialRoom({ code, profile, clientToken, at: createdAt });
      room.lounge = createLoungeName(profile);
      const result = await this.rooms.child(code).transaction(current => current ? undefined : room, undefined, false);
      if (result.committed) return code;
    }
    throw new Error('Impossible de créer une salle unique.');
  }

  async join(code, context) {
    let failure = null;
    const normalized = String(code || '').toUpperCase();
    const result = await liveTransaction(this.rooms.child(normalized), room => {
      try {
        return joinWaitingRoom(room, this.#withServerTime(context));
      } catch (error) {
        failure = error;
        return undefined;
      }
    }, undefined, false);
    if (!result.committed) throw failure || new Error('Impossible de rejoindre cette salle.');
    return result.snapshot.val();
  }

  async start(code, context) {
    return this.#reduce(code, room => startMatchInRoom(room, this.#withServerTime(context)));
  }

  async reattach(code, context) {
    return this.#reduce(code, room => reattachPlayerInRoom(room, this.#withServerTime(context)));
  }

  async selectMusic(code, context) {
    return this.#reduce(code, room => selectRoomMusic(room, this.#withServerTime(context)));
  }

  async selectStyle(code, context) {
    return this.#reduce(code, room => selectRoomStyle(room, this.#withServerTime(context)));
  }

  async selectTurnTimer(code, context) {
    return this.#reduce(code, room => selectTurnTimerInRoom(room, this.#withServerTime(context)));
  }

  async setTurnClockPaused(code, context) {
    return this.#reduce(code, room => setTurnClockPausedInRoom(room, this.#withServerTime(context)));
  }

  async timeoutTurn(code, context) {
    return this.#reduce(code, room => timeoutTurnInRoom(room, this.#withServerTime(context)));
  }

  async play(code, context) {
    return this.#reduce(code, room => playTileInRoom(room, this.#withServerTime(context)));
  }

  async pass(code, context) {
    return this.#reduce(code, room => passTurnInRoom(room, this.#withServerTime(context)));
  }

  async nextRound(code, context) {
    return this.#reduce(code, room => startNextRoundInRoom(room, this.#withServerTime(context)));
  }

  async rematch(code, context) {
    return this.#reduce(code, room => startRematchInRoom(room, this.#withServerTime(context)));
  }

  async leaveWaiting(code, context) {
    return this.#reduce(code, room => leaveWaitingRoom(room, this.#withServerTime(context)));
  }

  async cancel(code, context) {
    return this.#reduce(code, room => cancelRoomInState(room, this.#withServerTime(context)));
  }

  async removeRoomData(code, repositories = {}) {
    const normalized = String(code || '').toUpperCase();
    const removals = [this.rooms.child(normalized).remove()];
    for (const repository of Object.values(repositories)) {
      if (repository?.remove) removals.push(repository.remove(normalized));
    }
    return Promise.allSettled(removals);
  }

  watch(code, onValue, onError) {
    const reference = this.rooms.child(String(code || '').toUpperCase());
    const listener = snapshot => onValue(snapshot.val());
    reference.on('value', listener, onError);
    return () => reference.off('value', listener);
  }

  watchAll(onValue, onError) {
    const listener = snapshot => onValue(snapshot.val() || {});
    this.rooms.on('value', listener, onError);
    return () => this.rooms.off('value', listener);
  }

  async #reduce(code, reducer) {
    let failure = null;
    const result = await liveTransaction(this.rooms.child(String(code || '').toUpperCase()), room => {
      try {
        return reducer(room);
      } catch (error) {
        failure = error;
        return undefined;
      }
    }, undefined, false);
    if (!result.committed) throw failure || new Error('La salle a changé.');
    return result.snapshot.val();
  }

  #withServerTime(context = {}) {
    return Number.isFinite(context.at) ? context : { ...context, at: this.now() };
  }
}
