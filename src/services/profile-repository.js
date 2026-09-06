import { FIREBASE_PATHS } from '../config/firebase.js';

function toProfiles(value) {
  return (Array.isArray(value) ? value : Object.values(value || {})).filter(Boolean);
}

export class ProfileRepository {
  constructor(database) {
    this.players = database.ref(FIREBASE_PATHS.players);
  }

  async list() {
    const snapshot = await this.players.once('value');
    return toProfiles(snapshot.val());
  }

  watch(onValue, onError) {
    const listener = snapshot => onValue(toProfiles(snapshot.val()));
    this.players.on('value', listener, onError);
    return () => this.players.off('value', listener);
  }
}
