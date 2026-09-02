import { FIREBASE_PATHS } from '../config/firebase.js';
import { playerKey } from '../game/engine.js';

export class InvitationRepository {
  constructor(database, { serverTimestamp = () => Date.now() } = {}) {
    this.root = database.ref(FIREBASE_PATHS.invites);
    this.serverTimestamp = serverTimestamp;
  }

  watch(playerId, onValue, onError) {
    const reference = this.root.child(playerKey(playerId));
    const listener = snapshot => onValue(snapshot.val() || {});
    reference.on('value', listener, onError);
    return () => reference.off('value', listener);
  }

  send({ roomCode, fromProfile, toPlayerId }) {
    return this.root.child(`${playerKey(toPlayerId)}/${roomCode}`).set({
      roomCode,
      fromPlayerId: fromProfile.id,
      fromName: fromProfile.name,
      fromAvatar: fromProfile.avatar || '❓',
      toPlayerId,
      createdAt: this.serverTimestamp()
    });
  }

  remove(playerId, invitationId) {
    return this.root.child(`${playerKey(playerId)}/${invitationId}`).remove();
  }
}
