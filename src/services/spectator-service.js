import { FIREBASE_PATHS } from '../config/firebase.js?v=20261005T162819119';
import { boundedOperation } from './bounded-operation.js?v=20261005T162819119';
import { conditionalRoomWrite } from './conditional-room-write.js?v=20261005T162819119';
import { writeCompletePresence } from './presence-write.js?v=20261005T162819119';

export class SpectatorService {
  constructor(database, { serverTimestamp = () => Date.now() } = {}) {
    this.database = database;
    this.rooms = database.ref(FIREBASE_PATHS.rooms);
    this.serverTimestamp = serverTimestamp;
    this.reference = null;
    this.stopConnection = null;
    this.connected=false;this.revision=0;this.cleanup=null;
  }

  async register(roomCode, clientToken, profile) {
    await this.clear();
    this.reference = this.rooms.child(`${roomCode}/spectators/${clientToken}`);
    const reference = this.reference;
    const entry = {
      playerId: profile.id,
      name: profile.name,
      avatar: profile.avatar || '❓',
      joinedAt: this.serverTimestamp(),revision:this.revision=Math.max(Date.now()*1000,this.revision+1)
    };
    const connection = this.database.ref('.info/connected');
    const reconnect = async snapshot => {
      if(this.reference!==reference)return;
      this.connected=snapshot.val()===true;
      if (snapshot.val() !== true || this.reference !== reference) return;
      try {
        await boundedOperation(()=>reference.onDisconnect().remove(),4000);
        if (this.reference === reference&&this.connected) await writeCompletePresence(reference,entry,4000);
      } catch (_) {}
    };
    connection.on('value', reconnect);
    this.stopConnection = () => connection.off('value', reconnect);
  }

  async clear() {
    if(this.cleanup){await this.cleanup;return;}
    this.stopConnection?.();
    this.stopConnection = null;
    if (!this.reference) return;
    const reference = this.reference;
    this.reference = null;
    const wasConnected=this.connected,revision=this.revision;this.connected=false;
    this.cleanup=(async()=>{
      if(!wasConnected)return;
      try { await boundedOperation(()=>reference.onDisconnect().cancel(),2000); } catch (_) {}
      try {
        if(/^https?:\/\//.test(String(reference)))await conditionalRoomWrite(reference,current=>Number(current?.revision||0)>revision?current:null,{timeoutMs:2000,totalTimeoutMs:3000,recoverWrites:true});
        else await boundedOperation(()=>reference.remove(),2000);
      } catch (_) {}
    })();
    try{await this.cleanup;}finally{this.cleanup=null;}
  }
}
