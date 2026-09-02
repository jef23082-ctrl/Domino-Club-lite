import { FIREBASE_PATHS } from '../config/firebase.js';
import { historyRecordFromRoom } from '../game/online-stats.js';
import { addRecordToStats, validFirebaseKey, visibleHistory } from './online-records.js';

export class StatsRepository {
  constructor(database) {
    this.root = database.ref(FIREBASE_PATHS.onlineRoot);
  }

  watchSummary(onValue, onError) {
    const listener = snapshot => {
      const root = snapshot.val() || {};
      onValue({ history: visibleHistory(root), stats: root.stats || {}, rooms: root.rooms || {} });
    };
    this.root.on('value', listener, onError);
    return () => this.root.off('value', listener);
  }

  watchHistory(onValue, onError) {
    return this.watchSummary(summary => onValue(summary.history), onError);
  }

  async record(room) {
    const record = historyRecordFromRoom(room);
    if (!validFirebaseKey(record.matchId)) throw new Error('Identifiant de partie invalide.');
    const at = Date.now();
    const result = await this.root.transaction(root => {
      root ||= {};
      if (root.deletedMatches?.[record.matchId]) return;
      root.history ||= {};
      // History and credits commit together, including transaction retries.
      root.history[record.matchId] ||= record;
      root.stats = addRecordToStats(root.stats, { ...root.history[record.matchId], matchId: record.matchId }, at);
      return root;
    }, undefined, false);
    return result.committed ? record : null;
  }
}
