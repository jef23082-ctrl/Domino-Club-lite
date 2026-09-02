const KEYS = Object.freeze({
  clubPlayerId: 'club_player_id',
  onlinePlayerId: 'od_player_id',
  clientToken: 'od_client_token',
  roomCode: 'od_room_code',
  roomRole: 'od_room_role'
});

export class SessionStore {
  constructor(storage = globalThis.sessionStorage) {
    this.storage = storage;
  }

  get playerId() {
    return this.storage.getItem(KEYS.onlinePlayerId) || this.storage.getItem(KEYS.clubPlayerId) || '';
  }

  set playerId(value) {
    const normalized = String(value ?? '');
    this.storage.setItem(KEYS.clubPlayerId, normalized);
    this.storage.setItem(KEYS.onlinePlayerId, normalized);
  }

  get clientToken() {
    return this.storage.getItem(KEYS.clientToken) || '';
  }

  set clientToken(value) {
    this.storage.setItem(KEYS.clientToken, String(value || ''));
  }

  get room() {
    return {
      code: this.storage.getItem(KEYS.roomCode) || '',
      role: this.storage.getItem(KEYS.roomRole) || 'player'
    };
  }

  setRoom(code, role = 'player') {
    this.storage.setItem(KEYS.roomCode, String(code || '').toUpperCase());
    this.storage.setItem(KEYS.roomRole, role);
  }

  clearRoom() {
    this.storage.removeItem(KEYS.roomCode);
    this.storage.removeItem(KEYS.roomRole);
  }
}
