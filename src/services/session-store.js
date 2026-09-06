const KEYS = Object.freeze({
  clubPlayerId: 'club_player_id',
  onlinePlayerId: 'od_player_id',
  clientToken: 'od_tab_client_token_v2',
  roomCode: 'od_room_code',
  roomRole: 'od_room_role'
});

const scopedRoomKey = (key, playerId) => `${key}_p_${String(playerId || '')}`;

export class SessionStore {
  constructor(storage = globalThis.sessionStorage, durableStorage = null) {
    this.storage = storage;
    this.durableStorage = durableStorage || (
      storage === globalThis.sessionStorage && globalThis.localStorage ? globalThis.localStorage : storage
    );
  }

  read(key) {
    return this.storage?.getItem(key) || this.durableStorage?.getItem(key) || '';
  }

  write(key, value) {
    this.storage?.setItem(key, value);
    if (this.durableStorage !== this.storage) this.durableStorage?.setItem(key, value);
  }

  remove(key) {
    this.storage?.removeItem(key);
    if (this.durableStorage !== this.storage) this.durableStorage?.removeItem(key);
  }

  get playerId() {
    return this.storage?.getItem(KEYS.onlinePlayerId) || this.storage?.getItem(KEYS.clubPlayerId) || '';
  }

  set playerId(value) {
    const normalized = String(value ?? '');
    this.storage?.setItem(KEYS.clubPlayerId, normalized);
    this.storage?.setItem(KEYS.onlinePlayerId, normalized);
  }

  get clientToken() {
    return this.storage?.getItem(KEYS.clientToken) || '';
  }

  set clientToken(value) {
    this.storage?.setItem(KEYS.clientToken, String(value || ''));
  }

  get room() {
    const playerId = this.playerId;
    return {
      code: this.storage?.getItem(KEYS.roomCode)
        || (playerId && this.durableStorage?.getItem(scopedRoomKey(KEYS.roomCode, playerId)))
        || this.durableStorage?.getItem(KEYS.roomCode)
        || '',
      role: this.storage?.getItem(KEYS.roomRole)
        || (playerId && this.durableStorage?.getItem(scopedRoomKey(KEYS.roomRole, playerId)))
        || this.durableStorage?.getItem(KEYS.roomRole)
        || 'player'
    };
  }

  setRoom(code, role = 'player') {
    const normalized = String(code || '').toUpperCase();
    const playerId = this.playerId;
    this.storage?.setItem(KEYS.roomCode, normalized);
    this.storage?.setItem(KEYS.roomRole, role);
    if (playerId && this.durableStorage) {
      this.durableStorage.setItem(scopedRoomKey(KEYS.roomCode, playerId), normalized);
      this.durableStorage.setItem(scopedRoomKey(KEYS.roomRole, playerId), role);
      // The former global keys made several tabs overwrite one another.
      this.durableStorage.removeItem(KEYS.roomCode);
      this.durableStorage.removeItem(KEYS.roomRole);
    }
  }

  clearRoom() {
    const playerId = this.playerId;
    this.storage?.removeItem(KEYS.roomCode);
    this.storage?.removeItem(KEYS.roomRole);
    if (this.durableStorage) {
      if (playerId) {
        this.durableStorage.removeItem(scopedRoomKey(KEYS.roomCode, playerId));
        this.durableStorage.removeItem(scopedRoomKey(KEYS.roomRole, playerId));
      }
      this.durableStorage.removeItem(KEYS.roomCode);
      this.durableStorage.removeItem(KEYS.roomRole);
    }
  }
}
