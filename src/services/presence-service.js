import { FIREBASE_PATHS } from '../config/firebase.js?v=20261005T162819119';
import { boundedOperation } from './bounded-operation.js?v=20261005T162819119';
import { writeCompletePresence } from './presence-write.js?v=20261005T162819119';
import { conditionalRoomWrite } from './conditional-room-write.js?v=20261005T162819119';

export class PresenceService {
  constructor(database, { heartbeatMs=45000, serverTimestamp=()=>Date.now(), publishPresence=null, onHeartbeat=null,
    onState=()=>{}, timeoutMs=5000, retryDelayMs=500, initialTimeoutMs=15000 }={}) {
    Object.assign(this,{database,heartbeatMs,serverTimestamp,publishPresence,onHeartbeat,onState,timeoutMs,retryDelayMs,initialTimeoutMs});
    this.root=database.ref(FIREBASE_PATHS.presence);
    this.reference=null;this.timer=null;this.retryTimer=null;this.stopConnection=null;
    this.connected=false;this.state='disconnected';this.roomCode='';this.role='lobby';this.working=false;
    this.generation=0;this.revision=0;this.failures=0;this.recovering=null;
  }
  #state(state,error=null){this.state=state;this.onState({state,connected:this.connected,error});}
  #payload(){
    this.revision=Math.max(Date.now()*1000,this.revision+1);
    return {playerId:this.profile.id,name:this.profile.name,avatar:this.profile.avatar||'❓',connectedAt:this.connectedAt,
      lastSeen:this.serverTimestamp(),roomCode:this.roomCode,role:this.role,working:this.working,revision:this.revision};
  }
  async connect({clientToken,profile,roomCode='',role='lobby'}) {
    await this.disconnect();
    this.profile=profile;this.connectedAt=Date.now();this.roomCode=roomCode;this.role=role;
    const reference=this.root.child(clientToken);this.reference=reference;
    let resolveReady,rejectReady;const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    this.resolveReady=resolveReady;this.rejectReady=rejectReady;this.initialReady=false;
    this.#state('connecting');
    const connection=this.database.ref('.info/connected');
    const listener=snapshot=>{
      if(this.reference!==reference)return;
      this.connected=snapshot.val()===true;this.generation++;
      clearTimeout(this.retryTimer);this.retryTimer=null;this.recovering=null;
      if(this.connected)this.#recover();
      else this.#state(this.initialReady?'recovering':'connecting');
    };
    connection.on('value',listener);this.stopConnection=()=>connection.off('value',listener);
    this.timer=setInterval(()=>{
      if(!this.connected)return;
      if(this.state!=='ready'){this.#recover();return;}
      this.#write().catch(error=>this.#failed(error));
      Promise.resolve().then(()=>this.onHeartbeat?.()).catch(error=>this.onState({state:this.state,connected:this.connected,chatError:error}));
    },this.heartbeatMs);
    try {await boundedOperation(()=>ready,this.initialTimeoutMs,'Connexion du joueur non confirmée. Réessaie la connexion.');}
    catch(error){if(this.reference===reference)await this.disconnect();throw error;}
  }
  #recover(){
    if(!this.reference||!this.connected||this.recovering||this.retryTimer)return;
    const reference=this.reference,generation=this.generation,run={};this.recovering=run;
    this.#state(this.initialReady?'recovering':'connecting');
    (async()=>{
      try {
        await boundedOperation(()=>reference.onDisconnect().remove(),this.timeoutMs);
        if(this.reference!==reference||this.generation!==generation||!this.connected)return;
        const payload=this.#payload();
        await boundedOperation(()=>this.publishPresence?this.publishPresence(reference.key,payload):writeCompletePresence(reference,payload,this.timeoutMs),this.initialTimeoutMs);
        if(this.reference!==reference||this.generation!==generation||!this.connected)return;
        this.failures=0;this.initialReady=true;this.#state('ready');this.resolveReady?.();
      } catch(error){
        if(this.reference!==reference||this.generation!==generation)return;
        const transient=/timeout|network|fetch|set|conflict/i.test(String(error.code||error.message));
        if(!this.initialReady&&!transient){this.rejectReady?.(error);return;}
        this.#failed(error);
      } finally {if(this.recovering===run)this.recovering=null;}
    })();
  }
  #failed(error){
    if(!this.reference||!this.connected)return;
    if(error.presenceReference&&error.presenceReference!==this.reference||error.presenceGeneration!==undefined&&error.presenceGeneration!==this.generation)return;
    this.#state('failed',error);this.failures++;
    if(!this.retryTimer)this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.#recover();},Math.min(10000,this.retryDelayMs*2**Math.min(4,this.failures-1)));
  }
  #write(){
    const reference=this.reference,generation=this.generation;
    if(!reference||!this.connected)return Promise.resolve(false);
    return writeCompletePresence(reference,this.#payload(),this.timeoutMs).then(()=>true,error=>{error.presenceReference=reference;error.presenceGeneration=generation;throw error;});
  }
  async updateRoom(roomCode='',role='lobby'){
    this.roomCode=roomCode;this.role=role;if(!roomCode)this.working=false;
    try{return await this.#write();}catch(error){this.#failed(error);return false;}
  }
  async setWorking(active=false){
    this.working=Boolean(active);
    try{return await this.#write();}catch(error){this.#failed(error);throw error;}
  }
  watch(onValue,onError){const listener=snapshot=>onValue(snapshot.val()||{});this.root.on('value',listener,onError);return()=>this.root.off('value',listener);}
  async disconnect(){
    const reference=this.reference,wasConnected=this.connected,revision=this.revision;
    this.generation++;this.reference=null;this.connected=false;this.recovering=null;
    this.stopConnection?.();this.stopConnection=null;
    clearInterval(this.timer);clearTimeout(this.retryTimer);this.timer=null;this.retryTimer=null;
    this.roomCode='';this.role='lobby';this.working=false;this.#state('disconnected');
    if(!reference)return;
    if(wasConnected){try{await boundedOperation(()=>reference.onDisconnect().cancel(),Math.min(2000,this.timeoutMs));}catch{}}
    // Never queue an SDK remove while offline: it could arrive after a new login.
    try{
      if(/^https?:\/\//.test(String(reference))){
        if(wasConnected)await conditionalRoomWrite(reference,current=>Number(current?.revision||0)>revision?current:null,{timeoutMs:2000,totalTimeoutMs:3000,recoverWrites:true});
      }else await boundedOperation(()=>reference.remove(),this.timeoutMs);
    }catch{}
  }
}
