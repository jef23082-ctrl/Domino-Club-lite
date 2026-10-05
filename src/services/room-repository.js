import { FIREBASE_PATHS } from '../config/firebase.js?v=20261005T162819119';
import {
  createInitialRoom,
  cancelRoomInState,
  joinWaitingRoom,
  reattachPlayerInRoom,
  selectRoomMusic,
  selectRoomStyle,
  selectTurnTimerInRoom,
  setTurnClockPausedInRoom,
  leaveWaitingRoom,
  passTurnInRoom,
  playTileInRoom,
  startMatchInRoom,
  startRematchInRoom,
  startNextRoundInRoom,
  timeoutTurnInRoom
} from '../game/room-state.js?v=20261005T162819119';
import { randomId } from './ids.js?v=20261005T162819119';
import { liveTransaction } from './live-transaction.js?v=20261005T162819119';
import { conditionalRoomWrite } from './conditional-room-write.js?v=20261005T162819119';
import { queueRoundTransition, commitRoundTransition } from '../game/round-transition.js?v=20261005T162819119';
import { createLoungeName } from '../online/lounge-name.js?v=20261005T162819119';
import { DEFAULT_ENVIRONMENT } from '../config/domino-environments.js?v=20261005T162819119';
import { knownCharacterIdForProfile } from '../online/profile-map.js?v=20261005T162819119';
import { boundedOperation } from './bounded-operation.js?v=20261005T162819119';
import { playerKey } from '../game/engine.js?v=20261005T162819119';

export const roomCommandFrame=room=>JSON.stringify([room?.matchId||'',room?.game?.roundNumber,room?.game?.currentTurnId,room?.game?.lastAction?.at,room?.game?.turnClock?.revision]);

export class RoomRepository {
  constructor(database, { now = () => Date.now(), roundTransport = conditionalRoomWrite, identity = null,
    commandStorage = globalThis.sessionStorage, timeoutMs = 6000, totalTimeoutMs = 18000 } = {}) {
    this.database = database;
    this.rooms = database.ref(FIREBASE_PATHS.rooms);
    this.roundAdvanceRequests = database.ref(FIREBASE_PATHS.roundAdvanceRequests);
    this.now = now;
    this.roundTransport=roundTransport;
    this.identity = identity;
    this.commandStorage=commandStorage;this.timeoutMs=timeoutMs;this.totalTimeoutMs=totalTimeoutMs;
    this.inflight=new Map();this.intents=new Map();this.confirmed=new Map();this.sdkConfirmed=new Map();this.observers=new Set();
    this.storagePrefix=`domino-room-command-v57:${String(this.rooms)}:`;
  }

  async create({ profile, clientToken, at } = {}) {
    ({profile,clientToken}=this.#actor({profile,clientToken}));
    const key=`create:${profile.id}`;
    return this.#singleFlight(key,async()=>{
    const createdAt = Number.isFinite(at) ? at : this.now();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      // Keep the SAME room code after an ambiguous/lost response, even after a
      // reload. A retry must acknowledge the first room, never create a second.
      const intent=this.#intent(key,()=>({id:randomId(24),code:randomId(5)}));
      const code = intent.code;
      const room = createInitialRoom({ code, profile, clientToken, at: createdAt });
      // Decor only: keep the initial room's rules, players, clocks and phase.
      room.style = DEFAULT_ENVIRONMENT[knownCharacterIdForProfile(profile)] || room.style;
      room.lounge = createLoungeName(profile);
      room.commandReceipts={[intent.id]:{action:'create',actor:String(profile.id),at:createdAt}};
      room.syncRevision=1;
      let collision=false;
      const saved=await this.#apply(code,current=>{
        if(current?.commandReceipts?.[intent.id]?.actor===String(profile.id))return current;
        if(current){collision=true;return current;}
        return room;
      },{recoverWrites:true});
      this.#clearIntent(key);
      if(!collision){this.#remember(code,saved);return code;}
    }
    throw new Error('Impossible de créer une salle unique.');
    });
  }

  async join(code, context) {
    return this.#command(code,'join',context,joinWaitingRoom);
  }

  async start(code, context) {
    return this.#command(code,'start',context,startMatchInRoom);
  }

  async reattach(code, context) {
    return this.#command(code,'reattach',context,reattachPlayerInRoom);
  }

  async selectMusic(code, context) {
    return this.#command(code,'music',context,selectRoomMusic);
  }

  async selectStyle(code, context) {
    return this.#command(code,'style',context,selectRoomStyle);
  }

  async selectTurnTimer(code, context) {
    return this.#command(code,'timer',context,selectTurnTimerInRoom);
  }

  async setTurnClockPaused(code, context) {
    return this.#command(code,'pause',context,setTurnClockPausedInRoom);
  }

  async timeoutTurn(code, context) {
    return this.#command(code,'timeout',context,timeoutTurnInRoom);
  }

  async play(code, context) {
    return this.#command(code,'play',context,playTileInRoom);
  }

  async pass(code, context) {
    return this.#command(code,'pass',context,passTurnInRoom);
  }

  async nextRound(code, context) {
    return this.#command(code,'next-round',context,startNextRoundInRoom);
  }

  // V50: durable room command -> atomic distribution + receipt. The old relay
  // below is kept solely for compatibility with already-open V49 clients.
  async queueRoundTransition(code, context, options = {}) {
    return this.#roundReduce(code, room => queueRoundTransition(room, this.#withServerTime(context)), options);
  }

  async commitRoundTransition(code, context, options = {}) {
    return this.#roundReduce(code, room => commitRoundTransition(room, this.#withServerTime(context)), options);
  }

  async readRoundState(code, options = {}) {
    return this.#roundReduce(code, room => room, options);
  }

  async #roundReduce(code, reducer, options) {
    const saved=await this.#apply(code,room=>{
      const before=JSON.stringify(room),revision=Number(room?.syncRevision)||0;
      const next=reducer(room);
      if(next&&JSON.stringify(next)!==before)next.syncRevision=revision+1;
      return next;
    },options);
    this.#remember(code,saved);return saved;
  }

  async requestNextRound(code, request) {
    if (!request || !Number.isFinite(Number(request.roundNumber)) || !Number.isFinite(Number(request.resultAt))) throw new Error('Demande de manche invalide.');
    return this.roundAdvanceRequests.child(String(code || '').toUpperCase()).set(request);
  }

  watchNextRoundRequest(code, onValue, onError) {
    const reference = this.roundAdvanceRequests.child(String(code || '').toUpperCase());
    const listener = snapshot => onValue(snapshot.val());
    reference.on('value', listener, onError);
    return () => reference.off('value', listener);
  }

  async rematch(code, context) {
    return this.#command(code,'rematch',context,startRematchInRoom);
  }

  async leaveWaiting(code, context) {
    return this.#command(code,'leave',context,(room,actor)=>{
      if(!room||!room.players?.[playerKey(actor.playerId)])return room;
      return leaveWaitingRoom(room,actor);
    });
  }

  async cancel(code, context) {
    return this.#command(code,'cancel',context,cancelRoomInState);
  }

  async removeRoomData(code, repositories = {}) {
    const normalized = String(code || '').toUpperCase();
    const removals = [this.rooms.child(normalized).remove(), this.roundAdvanceRequests.child(normalized).remove()];
    for (const repository of Object.values(repositories)) {
      if (repository?.remove) removals.push(repository.remove(normalized));
    }
    return Promise.allSettled(removals);
  }

  watch(code, onValue, onError) {
    const normalized=String(code||'').toUpperCase(),reference = this.rooms.child(normalized);
    const notify=changed=>{if(changed===normalized)onValue(this.confirmed.get(normalized));};
    this.observers.add(notify);
    const listener = snapshot => onValue(this.#latest(normalized,snapshot.val()));
    reference.on('value', listener, onError);
    if(this.confirmed.has(normalized))onValue(this.confirmed.get(normalized));
    return () => {this.observers.delete(notify);reference.off('value', listener);};
  }

  watchAll(onValue, onError) {
    let rooms={};
    const notify=()=>onValue(Object.fromEntries(Object.entries({...rooms,...Object.fromEntries(this.confirmed)}).map(([code,value])=>[code,this.#latest(code,rooms[code]??value)]).filter(([,value])=>value)));
    this.observers.add(notify);
    const listener = snapshot => {rooms=snapshot.val()||{};notify();};
    this.rooms.on('value', listener, onError);
    return () => {this.observers.delete(notify);this.rooms.off('value', listener);};
  }

  async #apply(code, reducer, options={}) {
    const reference=this.rooms.child(String(code||'').toUpperCase());
    if(/^https?:\/\//.test(String(reference)))return this.roundTransport(reference,reducer,{timeoutMs:this.timeoutMs,totalTimeoutMs:this.totalTimeoutMs,...options});
    let failure = null;
    const result = await boundedOperation(()=>liveTransaction(reference, room => {
      try {
        return reducer(room);
      } catch (error) {
        failure = error;
        return undefined;
      }
    }, undefined, false),this.totalTimeoutMs);
    if (!result.committed) throw failure || new Error('La salle a changé.');
    return result.snapshot.val();
  }

  #actor(context={}){
    if(!this.identity)return this.#withServerTime(context);
    const actor=this.identity();
    if(actor?.profile?.id==null||!actor.clientToken)throw new Error('Connecte-toi au club.');
    return this.#withServerTime({...context,profile:actor.profile,playerId:actor.profile.id,clientToken:actor.clientToken,creatorName:actor.profile.name});
  }

  #command(code,action,context,reducer){
    const actor=this.#actor(context),normalized=String(code||'').toUpperCase();
    const {at,randomIndex,profile,clientToken,...parameters}=actor;
    if(action==='start'||action==='rematch')delete parameters.matchId;
    const actorId=String(actor.playerId??profile?.id??clientToken);
    const key=JSON.stringify([normalized,action,actorId,parameters]);
    return this.#singleFlight(key,async()=>{
      const intent=this.#intent(key,()=>({id:randomId(24),...(['start','rematch'].includes(action)?{matchId:actor.matchId}:{} )}));
      try {
        const saved=await this.#apply(normalized,room=>{
          if(room?.commandReceipts?.[intent.id]?.actor===actorId)return room;
          // These checks reject a delayed action from an older frame, without
          // changing a single rule in the Domino reducer.
          if(actor.expectedMatchId!==undefined&&String(room?.matchId||'')!==String(actor.expectedMatchId))throw Object.assign(new Error('La partie a changé. Actualisation nécessaire.'),{code:'stale-match'});
          if(actor.expectedActionKey!==undefined&&roomCommandFrame(room)!==actor.expectedActionKey)throw Object.assign(new Error('Le tour a changé. Ton action n’a pas été rejouée.'),{code:'stale-turn'});
          const revision=Number(room?.syncRevision)||0,next=reducer(room,{...actor,...(intent.matchId?{matchId:intent.matchId}:{})});
          if(next){
            // Firebase may return object keys alphabetically. Prune by age,
            // not by key order, and always retain this command's own receipt.
            const older=Object.entries(next.commandReceipts||{}).filter(([id])=>id!==intent.id)
              .sort(([,a],[,b])=>Number(a.at||0)-Number(b.at||0)).slice(-63);
            next.commandReceipts=Object.fromEntries([...older,[intent.id,{action,actor:actorId,at:actor.at}]]);
            next.syncRevision=revision+1;
          }
          return next;
        },{recoverWrites:true});
        this.#remember(normalized,saved);this.#clearIntent(key);return saved;
      }catch(error){
        // Known rule/permission failures are definitive. Network ambiguity keeps
        // the ID, so the next click/reload reconciles the server receipt first.
        if(error.name==='GameRuleError'||/refused|stale-/.test(error.code||''))this.#clearIntent(key);
        throw error;
      }
    });
  }
  #singleFlight(key,operation){
    if(this.inflight.has(key))return this.inflight.get(key);
    const pending=Promise.resolve().then(operation).finally(()=>this.inflight.delete(key));this.inflight.set(key,pending);return pending;
  }
  #intent(key,create){
    if(!this.intents.has(key)){
      let saved;try{saved=JSON.parse(this.commandStorage?.getItem(this.storagePrefix+key)||'null');}catch{}
      const intent=saved?.id?saved:create();this.intents.set(key,intent);
      try{this.commandStorage?.setItem(this.storagePrefix+key,JSON.stringify(intent));}catch{}
    }
    return this.intents.get(key);
  }
  #clearIntent(key){this.intents.delete(key);try{this.commandStorage?.removeItem(this.storagePrefix+key);}catch{}}
  #latest(code,value,fromSdk=true){
    const confirmed=this.confirmed.get(code);
    if(confirmed===null&&this.confirmed.has(code))return null;
    if(!confirmed)return value;
    if(!value){
      // Ignore an initial stale/null cache. Once the SDK has caught up with the
      // confirmed version, a later null is a genuine deletion (e.g. admin).
      if(fromSdk&&this.sdkConfirmed.has(code)&&this.sdkConfirmed.get(code)>=Number(confirmed.syncRevision||0)){
        this.confirmed.set(code,null);this.sdkConfirmed.delete(code);return null;
      }
      return confirmed;
    }
    if(Number(value.syncRevision||0)<Number(confirmed.syncRevision||0))return confirmed;
    if(Number(value.syncRevision||0)===Number(confirmed.syncRevision||0)&&Number(value.updatedAt||0)<Number(confirmed.updatedAt||0))return confirmed;
    if(fromSdk)this.sdkConfirmed.set(code,Number(value.syncRevision||0));
    this.confirmed.set(code,value);return value;
  }
  #remember(code,value){
    const normalized=String(code||'').toUpperCase();
    this.confirmed.set(normalized,value?(this.confirmed.get(normalized)===null?value:this.#latest(normalized,value,false)):null);
    for(const notify of this.observers)notify(normalized);
  }

  #withServerTime(context = {}) {
    return Number.isFinite(context.at) ? context : { ...context, at: this.now() };
  }

}
