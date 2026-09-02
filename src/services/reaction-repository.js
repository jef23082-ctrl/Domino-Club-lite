import { FIREBASE_PATHS } from '../config/firebase.js';
import { randomId } from './ids.js';

export const REACTION_DURATION = 4200;
export const REACTION_COOLDOWN = 2400;

export class ReactionRepository {
  constructor(database, { serverTimestamp = () => Date.now() } = {}) {
    this.root = database.ref(FIREBASE_PATHS.reactions);
    this.serverTimestamp = serverTimestamp;
  }

  watch(roomCode, onValue, onError) {
    const reference = this.root.child(roomCode);
    const listener = snapshot => onValue(snapshot.val());
    reference.on('value', listener, onError);
    return () => reference.off('value', listener);
  }

  send(roomCode, { kind, effect, sender, target, clientToken }) {
    const at = Date.now();
    return this.root.child(roomCode).set({
      id: `${at}_${randomId(6)}`,
      kind,
      effect,
      senderId: sender.playerId,
      senderName: sender.name,
      senderToken: clientToken,
      targetId: target.playerId,
      targetName: target.name,
      at: this.serverTimestamp()
    });
  }

  remove(roomCode) {
    return this.root.child(roomCode).remove();
  }
}
