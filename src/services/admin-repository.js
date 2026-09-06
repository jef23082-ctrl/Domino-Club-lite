import { FIREBASE_PATHS } from '../config/firebase.js';
import { rebuiltStats, validFirebaseKey } from './online-records.js';
import { liveTransaction } from './live-transaction.js';

export class AdminRepository {
  constructor(database, access) {
    this.root = database.ref(FIREBASE_PATHS.onlineRoot);
    this.access = access;
  }

  async #change(reducer) {
    this.access.require();
    let failure;
    const result = await liveTransaction(this.root, root => {
      try {
        this.access.require();
        if (!root) throw new Error('Données en ligne introuvables.');
        reducer(root);
        failure = null;
        return root;
      } catch (error) { failure = error; return undefined; }
    }, undefined, false);
    if (!result.committed) throw failure || new Error('Les données ont changé. Réessayez.');
  }

  async removeHistory(matchId) {
    this.access.require();
    if (!validFirebaseKey(matchId)) throw new Error('Identifiant de résultat invalide.');
    const at = Date.now();
    return this.#change(root => {
      if (!root.history?.[matchId] || root.deletedMatches?.[matchId]) throw new Error('Ce résultat a déjà été supprimé.');
      delete root.history[matchId];
      root.deletedMatches ||= {};
      root.deletedMatches[matchId] = { at, reason: 'admin-history' };
      root.stats = rebuiltStats(root, at);
    });
  }

  async removeRoom(expected) {
    this.access.require();
    if (!validFirebaseKey(expected?.code)) throw new Error('Identifiant de salle invalide.');
    const at = Date.now();
    return this.#change(root => {
      const room = root.rooms?.[expected.code];
      if (!room) throw new Error('Cette salle a déjà été supprimée.');
      if (room.status !== expected.status || String(room.matchId || '') !== String(expected.matchId || '') || Number(room.createdAt || 0) !== Number(expected.createdAt || 0)) {
        throw new Error('La salle a changé depuis la confirmation. Vérifiez son nouvel état.');
      }
      if (room.matchId && !validFirebaseKey(room.matchId)) throw new Error('Identifiant de partie invalide.');
      for (const branch of ['rooms', 'chats', 'reactions', 'typing']) if (root[branch]) delete root[branch][expected.code];
      if (room.matchId && (room.status === 'finished' || !root.history?.[room.matchId])) {
        root.deletedMatches ||= {};
        root.deletedMatches[room.matchId] = { at, reason: 'admin-room' };
      }
      if (room.status === 'finished' && room.matchId) {
        if (root.history) delete root.history[room.matchId];
        root.stats = rebuiltStats(root, at);
      }
    });
  }
}
