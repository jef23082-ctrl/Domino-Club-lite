import { FIREBASE_PATHS } from '../config/firebase.js?v=20261005T162819119';
import { liveTransaction } from './live-transaction.js?v=20261005T162819119';
import { conditionalRoomWrite } from './conditional-room-write.js?v=20261005T162819119';
import { boundedOperation } from './bounded-operation.js?v=20261005T162819119';
import { writeCompletePresence } from './presence-write.js?v=20261005T162819119';

export const CLUB_CHAT_CHANNEL = 'GENERAL';
export const CHAT_IDLE_GRACE_MS = 120000;

// Legacy pure reducer retained for old tests/data. V57 never transacts this root.
export function enterClubChat(current, {clientToken, presence, at, graceMs=CHAT_IDLE_GRACE_MS}) {
  const root=current||{}, entries=Object.values(root.presence||{});
  const active=entries.some(p=>p&&Number(p.lastSeen)>0&&at-Number(p.lastSeen)<graceMs);
  const activity=Math.max(0,Number(root.chatSession?.lastActiveAt)||0,
    ...Object.values(root.chatSession?.disconnectedAt||{}).map(value=>Number(value)||0),
    ...entries.map(p=>Number(p?.lastSeen)||0),
    ...Object.values(root.chats?.[CLUB_CHAT_CHANNEL]||{}).map(m=>Number(m?.createdAt)||0));
  const reset=!active&&at-activity>=graceMs;
  const next={...root,presence:{...root.presence,[clientToken]:presence},
    chatSession:{...root.chatSession,lastActiveAt:at}};
  if(reset){
    next.chats={...root.chats};delete next.chats[CLUB_CHAT_CHANNEL];
    next.typing={...root.typing};delete next.typing[CLUB_CHAT_CHANNEL];
    next.chatSession.resetAt=at;
  }
  return next;
}

export class ClubChatSession {
  constructor(database,{now=()=>Date.now(),serverTimestamp=()=>Date.now(),timeoutMs=5000}={}) {
    this.root=database.ref(FIREBASE_PATHS.onlineRoot);
    this.metadata=this.root.child('chatSession');this.now=now;this.serverTimestamp=serverTimestamp;this.timeoutMs=timeoutMs;this.offsetMs=0;
    this.serverOffset=database.ref('.info/serverTimeOffset');
  }
  async enter(clientToken,presence) {
    // The server records the actual loss of each connection even after its
    // browser closes. This starts the grace period at disconnect, not heartbeat.
    await boundedOperation(()=>this.root.child(`chatSession/disconnectedAt/${clientToken}`).onDisconnect().set(this.serverTimestamp()),this.timeoutMs);
    const [offset,entries,messages,typing]=await Promise.all([
      boundedOperation(()=>this.serverOffset.once('value'),this.timeoutMs).then(s=>Number(s.val())||0),
      this.#read(this.root.child('presence')),this.#read(this.root.child(`chats/${CLUB_CHAT_CHANNEL}`)),this.#read(this.root.child(`typing/${CLUB_CHAT_CHANNEL}`))
    ]);
    this.offsetMs=offset;const at=this.now()+offset;
    // The CAS is ONLY on small chat metadata, outside every room. Heartbeats,
    // chat writes and spectators can no longer cancel room/login transactions.
    const metadata=await this.#reduce(this.metadata,current=>enterClubChat({presence:entries,chatSession:current,chats:{[CLUB_CHAT_CHANNEL]:messages}}, {clientToken,presence,at}).chatSession);
    const cutoff=Number(metadata?.resetAt)||0,removals={};
    // Delete only IDs observed before the new session. A concurrent newly sent
    // message is never deleted by a delayed cleanup or a second returning tab.
    for(const [id,message] of Object.entries(messages||{}))if(Number(message?.createdAt||0)<cutoff)removals[`chats/${CLUB_CHAT_CHANNEL}/${id}`]=null;
    for(const [id,item] of Object.entries(typing||{}))if(Number(item?.at||0)<cutoff)removals[`typing/${CLUB_CHAT_CHANNEL}/${id}`]=null;
    if(Object.keys(removals).length)await boundedOperation(()=>this.root.update(removals),this.timeoutMs);
    await writeCompletePresence(this.root.child(`presence/${clientToken}`),presence,this.timeoutMs);
  }
  heartbeat(){
    const timestamp=this.serverTimestamp();
    const at=typeof timestamp==='number'?timestamp:this.now()+this.offsetMs;
    return this.#reduce(this.metadata,current=>({...current,lastActiveAt:Math.max(Number(current?.lastActiveAt)||0,at)}));
  }
  #read(reference){
    if(/^https?:\/\//.test(String(reference)))return conditionalRoomWrite(reference,value=>value,{timeoutMs:this.timeoutMs,totalTimeoutMs:this.timeoutMs*2});
    return boundedOperation(()=>reference.once('value'),this.timeoutMs).then(s=>s.val());
  }
  async #reduce(reference,reducer){
    if(/^https?:\/\//.test(String(reference)))return conditionalRoomWrite(reference,reducer,{timeoutMs:this.timeoutMs,totalTimeoutMs:this.timeoutMs*2,recoverWrites:true});
    const result=await boundedOperation(()=>liveTransaction(reference,reducer),this.timeoutMs);
    if(!result.committed)throw new Error('Connexion à la discussion commune non confirmée.');
    return result.snapshot.val();
  }
}
