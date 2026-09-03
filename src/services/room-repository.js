import { FIREBASE_PATHS } from '../config/firebase.js';
import {
  createInitialRoom,
  cancelRoomInState,
  joinWaitingRoom,
  leaveWaitingRoom,
  passTurnInRoom,
  playTileInRoom,
  startMatchInRoom,
  startRematchInRoom,
  startNextRoundInRoom
} from '../game/room-state.js';
import { randomId } from './ids.js';
import { liveTransaction } from './live-transaction.js';
import { createLoungeName } from '../online/lounge-name.js';

export class RoomRepository {
  constructor(database) {
    this.database = database;
    this.rooms = database.ref(FIREBASE_PATHS.rooms);
  }

  async create({ profile, clientToken, at = Date.now() }) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomId(5);
      const room = createInitialRoom({ code, profile, clientToken, at });
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
        return joinWaitingRoom(room, context);
      } catch (error) {
        failure = error;
        return undefined;
      }
    }, undefined, false);
    if (!result.committed) throw failure || new Error('Impossible de rejoindre cette salle.');
    return result.snapshot.val();
  }

  async start(code, context) {
    return this.#reduce(code, room => startMatchInRoom(room, context));
  }

  async play(code, context) {
    return this.#reduce(code, room => playTileInRoom(room, context));
  }

  async pass(code, context) {
    return this.#reduce(code, room => passTurnInRoom(room, context));
  }

  async nextRound(code, context) {
    return this.#reduce(code, room => startNextRoundInRoom(room, context));
  }

  async rematch(code, context) {
    return this.#reduce(code, room => startRematchInRoom(room, context));
  }

  async leaveWaiting(code, context) {
    return this.#reduce(code, room => leaveWaitingRoom(room, context));
  }

  async cancel(code, context) {
    return this.#reduce(code, room => cancelRoomInState(room, context));
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
}
