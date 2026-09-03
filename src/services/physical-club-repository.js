import { FIREBASE_PATHS } from '../config/firebase.js';
import { clubData, recalculatePhysical, startPhysicalGame, recordPhysicalRound } from '../game/club-state.js';
import { liveTransaction } from './live-transaction.js';

export class PhysicalClubRepository {
  constructor(database, { requirePlayer = () => {}, requireAdmin = () => {} } = {}) {
    this.root = database.ref(FIREBASE_PATHS.legacyData);
    this.backups = database.ref(FIREBASE_PATHS.legacyBackups);
    this.requirePlayer = requirePlayer; this.requireAdmin = requireAdmin;
  }
  watch(onValue, onError) {
    const listener = snapshot => {
      const data = clubData(snapshot.val());
      data.players = recalculatePhysical(data.players, data.history, true);
      onValue(data);
    };
    this.root.on('value', listener, onError);
    return () => this.root.off('value', listener);
  }
  async change(reason, reducer, admin = false) {
    const requireAccess = () => { this.requirePlayer(); if (admin) this.requireAdmin(); };
    requireAccess();
    const before = (await this.root.once('value')).val();
    if (!before || !before.players) throw new Error('Données du club indisponibles : aucune écriture effectuée.');
    // Back up physical data only; never copy or overwrite the online branches.
    await this.backups.push().set({ createdAt: Date.now(), source: 'domino-club-v3', reason, data: clubData(before) });
    let failure;
    const result = await liveTransaction(this.root, current => {
      try {
        requireAccess();
        if (!current?.players) throw new Error('Les données du club ont changé.');
        return { ...current, ...reducer(clubData(current)) };
      } catch (error) { failure = error; return undefined; }
    });
    if (!result.committed) throw failure || new Error('Modification non confirmée.');
    return clubData(result.snapshot.val());
  }
  start(ids) { const at = Date.now(); return this.change('nouvelle partie physique', data => startPhysicalGame(data, ids, at)); }
  cancel(expectedTable, expectedVersion) {
    return this.change('annulation partie physique', data => {
      if (!data.currentTable.length) throw new Error('Aucune partie physique à annuler.');
      if (!expectedVersion || JSON.stringify(data.currentTable)!==JSON.stringify(expectedTable)
        || data.matchStartTime!==expectedVersion.startedAt || JSON.stringify(data.history[0]||null)!==JSON.stringify(expectedVersion.head)) {
        throw new Error('La partie physique a changé : ouvre à nouveau la confirmation.');
      }
      // Return only these fields: neither player scores, history nor online branches are rewritten.
      return {currentTable:[],matchStartTime:null};
    });
  }
  record(selection, expectedTable, expectedVersion = null) {
    const at = Date.now();
    return this.change('fin de manche physique', data => {
      if (JSON.stringify(data.currentTable) !== JSON.stringify(expectedTable)) throw new Error('La table a changé : ouvre à nouveau Fin de Manche.');
      if (expectedVersion && (JSON.stringify(data.history[0] || null) !== JSON.stringify(expectedVersion.head) || data.matchStartTime !== expectedVersion.startedAt)) throw new Error('Une manche a déjà été enregistrée ou une partie relancée. Rouvre Fin de Manche.');
      return recordPhysicalRound(data, selection, at);
    });
  }
  savePlayer({ id = null, name, avatar, expected = null }) {
    return this.change('enregistrement joueur', data => {
      name = String(name || '').trim(); avatar = String(avatar || '').trim();
      if (!name || name.length > 60 || !avatar || avatar.length > 200000) throw new Error('Nom ou avatar invalide.');
      if (data.players.some(p=>String(p.id)!==String(id) && p.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) throw new Error('Ce nom est déjà utilisé.');
      if (id === null) {
        const nextId = Math.max(-1, ...data.players.map(p=>Number(p.id)).filter(Number.isFinite), ...data.history.flatMap(h=>h.table || []).map(Number).filter(Number.isFinite)) + 1;
        data.players.push({ id: nextId, name, avatar, vic:0, coch:0, totalGames:0, saved:0, currentStreak:0 });
      } else {
        const player = data.players.find(p=>String(p.id)===String(id));
        if (!player || (expected && (player.name!==expected.name || player.avatar!==expected.avatar))) throw new Error('Le joueur a été modifié entre-temps.');
        Object.assign(player, { name, avatar });
      }
      return data;
    }, true);
  }
  deletePlayer(expected) {
    return this.change('suppression joueur', data => {
      const player = data.players.find(p=>String(p.id)===String(expected.id));
      if (!player || player.name !== expected.name || player.avatar !== expected.avatar) throw new Error('Le joueur a changé depuis la confirmation.');
      return { ...data, players: data.players.filter(p=>p!==player), currentTable: data.currentTable.filter(id=>String(id)!==String(expected.id)) };
    }, true);
  }
  deleteHistory(expected) {
    return this.change('suppression manche physique', data => {
      const index = data.history.findIndex(match=>JSON.stringify(match)===JSON.stringify(expected));
      if (index < 0) throw new Error('Cette manche a déjà été modifiée ou supprimée.');
      data.history.splice(index,1);
      return { ...data, players: recalculatePhysical(data.players,data.history) };
    }, true);
  }
}
