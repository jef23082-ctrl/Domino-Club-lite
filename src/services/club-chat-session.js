import { FIREBASE_PATHS } from '../config/firebase.js';
import { liveTransaction } from './live-transaction.js';

export const CLUB_CHAT_CHANNEL = 'GENERAL';
export const CHAT_IDLE_GRACE_MS = 120000;

// GitHub Pages has no worker after the last browser closes. Reset lazily,
// atomically with the first returning presence, before subscribing to messages.
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
  constructor(database,{now=()=>Date.now(),serverTimestamp=()=>Date.now()}={}) {
    this.root=database.ref(FIREBASE_PATHS.onlineRoot);
    this.activity=this.root.child('chatSession/lastActiveAt');this.now=now;this.serverTimestamp=serverTimestamp;
    this.serverOffset=database.ref('.info/serverTimeOffset');
  }
  async enter(clientToken,presence) {
    // The server records the actual loss of each connection even after its
    // browser closes. This starts the grace period at disconnect, not heartbeat.
    await this.root.child(`chatSession/disconnectedAt/${clientToken}`).onDisconnect().set(this.serverTimestamp());
    const offset=Number((await this.serverOffset.once('value')).val())||0;
    const result=await liveTransaction(this.root,current=>enterClubChat(current,{clientToken,presence,at:this.now()+offset}));
    if(!result.committed)throw new Error('Connexion à la discussion commune non confirmée.');
  }
  heartbeat(){return this.activity.set(this.serverTimestamp());}
}
