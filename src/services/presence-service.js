import { FIREBASE_PATHS } from '../config/firebase.js';

export class PresenceService {
  constructor(database, { heartbeatMs = 45000, serverTimestamp = () => Date.now(), publishPresence = null, onHeartbeat = null } = {}) {
    this.database = database;
    this.root = database.ref(FIREBASE_PATHS.presence);
    this.heartbeatMs = heartbeatMs;
    this.serverTimestamp = serverTimestamp;
    this.reference = null;
    this.timer = null;
    this.roomCode = '';
    this.role = 'lobby';
    this.stopConnection = null;
    this.connected = false;
    this.publishPresence = publishPresence;this.onHeartbeat = onHeartbeat;
  }

  async connect({ clientToken, profile, roomCode = '', role = 'lobby' }) {
    await this.disconnect();
    this.roomCode = roomCode;
    this.role = role;
    this.reference = this.root.child(clientToken);
    const reference = this.reference;
    const write = () => {const payload={
      playerId: profile.id,
      name: profile.name,
      avatar: profile.avatar || '❓',
      connectedAt: Date.now(),
      lastSeen: this.serverTimestamp(),
      roomCode: this.roomCode,
      role: this.role
    };return this.publishPresence?this.publishPresence(reference.key,payload):reference.set(payload);};
    let resolveReady,rejectReady;const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const connection = this.database.ref('.info/connected');
    const reconnect = async snapshot => {
      this.connected = snapshot.val() === true;
      if (!this.connected || this.reference !== reference) return;
      try {
        // onDisconnect registrations are consumed by a disconnect: renew before
        // restoring the complete profile, not just its heartbeat fields.
        await reference.onDisconnect().remove();
        if (this.reference === reference && this.connected) {await write();resolveReady();}
      } catch (error) {rejectReady(error);}
    };
    connection.on('value', reconnect);
    this.stopConnection = () => connection.off('value', reconnect);
    this.timer = setInterval(() => {
      if (!this.connected) return;
      this.reference?.update({
        lastSeen: this.serverTimestamp(),
        roomCode: this.roomCode,
        role: this.role
      }).catch(() => {});
      this.onHeartbeat?.().catch(() => {});
    }, this.heartbeatMs);
    try {await ready;} catch (error) {if(this.reference===reference)await this.disconnect();throw error;}
  }

  updateRoom(roomCode = '', role = 'lobby') {
    this.roomCode = roomCode;
    this.role = role;
    return this.connected && this.reference?.update({
      roomCode,
      role,
      lastSeen: this.serverTimestamp()
    });
  }

  watch(onValue, onError) {
    const listener = snapshot => onValue(snapshot.val() || {});
    this.root.on('value', listener, onError);
    return () => this.root.off('value', listener);
  }

  async disconnect() {
    this.stopConnection?.(); this.stopConnection = null;
    this.connected = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.reference) return;
    try { await this.reference.onDisconnect().cancel(); } catch (_) {}
    try { await this.reference.remove(); } catch (_) {}
    this.reference = null;
    this.roomCode = '';
    this.role = 'lobby';
  }
}
