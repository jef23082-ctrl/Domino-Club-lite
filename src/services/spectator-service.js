import { FIREBASE_PATHS } from '../config/firebase.js';

export class SpectatorService {
  constructor(database, { serverTimestamp = () => Date.now() } = {}) {
    this.database = database;
    this.rooms = database.ref(FIREBASE_PATHS.rooms);
    this.serverTimestamp = serverTimestamp;
    this.reference = null;
    this.stopConnection = null;
  }

  async register(roomCode, clientToken, profile) {
    await this.clear();
    this.reference = this.rooms.child(`${roomCode}/spectators/${clientToken}`);
    const reference = this.reference;
    const entry = {
      playerId: profile.id,
      name: profile.name,
      avatar: profile.avatar || '❓',
      joinedAt: this.serverTimestamp()
    };
    const connection = this.database.ref('.info/connected');
    const reconnect = async snapshot => {
      if (snapshot.val() !== true || this.reference !== reference) return;
      try {
        await reference.onDisconnect().remove();
        if (this.reference === reference) await reference.set(entry);
      } catch (_) {}
    };
    connection.on('value', reconnect);
    this.stopConnection = () => connection.off('value', reconnect);
  }

  async clear() {
    this.stopConnection?.();
    this.stopConnection = null;
    if (!this.reference) return;
    const reference = this.reference;
    this.reference = null;
    try { await reference.onDisconnect().cancel(); } catch (_) {}
    try { await reference.remove(); } catch (_) {}
  }
}
