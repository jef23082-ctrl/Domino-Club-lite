// Presentation-only lifecycle. Never mutates a room or participates in a move.
export class OpeningMascotState {
  key = '';
  active = false;
  completed = new Set();

  update(room) {
    const game = room?.game;
    if (room?.status !== 'playing' || game?.roundStatus !== 'playing') {
      this.active = false;
      this.key = '';
      return 'hide';
    }
    const key = JSON.stringify([room.code, room.matchId, game.roundNumber || 1]);
    const changed = key !== this.key;
    this.key = key;
    if (changed) this.active = false;
    if (game.board?.placements?.length) {
      const finish = this.active;
      this.active = false;
      this.completed.add(key);
      if (this.completed.size > 100) this.completed.delete(this.completed.values().next().value);
      return finish ? 'finish' : changed ? 'hide' : 'none';
    }
    if (this.completed.has(key)) return 'hide';
    if (!this.active) { this.active = true; return 'start'; }
    return 'none';
  }

  reset() { this.key = ''; this.active = false; }
}
