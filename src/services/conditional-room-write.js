// A bounded, server-confirmed compare-and-swap independent of the SDK's
// WebSocket/reconnect queue. Firebase rules still apply to every HTTP request.
export async function conditionalRoomWrite(reference, reducer, {fetcher=globalThis.fetch, timeoutMs=6000, attempts=6, signal, totalTimeoutMs=18000, recoverWrites=false}={}) {
  const deadline=Date.now()+totalTimeoutMs;
  const address=String(reference);
  if(!/^https?:\/\//.test(address))throw new Error('Adresse de salle invalide.');
  const url=new URL(address.replace(/\/$/,'')+'.json');
  // Reuse an existing Firebase Auth identity, if this deployment has one.
  const auth=reference.database?.app?.auth;
  if(typeof auth==='function'){
    const user=auth.call(reference.database.app)?.currentUser;
    if(user){
      let authTimer;
      try {url.searchParams.set('auth',await Promise.race([user.getIdToken(),new Promise((_,reject)=>{authTimer=setTimeout(()=>reject(Object.assign(new Error('Connexion au serveur non confirmée.'),{code:'round-network-timeout'})),Math.min(timeoutMs,totalTimeoutMs));})]));}
      finally {clearTimeout(authTimer);}
    }
  }
  const request=async options=>{
    if(signal?.aborted)throw Object.assign(new Error('La demande a été interrompue. Elle pourra être reprise.'),{code:'round-network-timeout'});
    const remaining=Math.min(timeoutMs,deadline-Date.now());
    if(remaining<=0)throw Object.assign(new Error('Confirmation du serveur encore indisponible.'),{code:'round-network-timeout'});
    const controller=new AbortController();let timer,rejectAbort;
    const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
    const abort=()=>{controller.abort();rejectAbort(Object.assign(new Error('La demande a été interrompue. Elle pourra être reprise.'),{code:'round-network-timeout'}));};
    if(signal?.aborted)controller.abort();
    else signal?.addEventListener('abort',abort,{once:true});
    try{
      return await Promise.race([
        (async()=>{const response=await fetcher(url.href,{...options,cache:'no-store',signal:controller.signal});const body=await response.json();return {response,body};})(),
        aborted,
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error('Confirmation du serveur encore indisponible.'),{code:'round-network-timeout'}));},remaining);})
      ]);
    }catch(error){
      if(controller.signal.aborted)throw Object.assign(new Error('Le serveur ne confirme pas encore la demande. Réessaie : son résultat sera vérifié avant tout nouvel envoi.'),{code:'round-network-timeout'});
      throw error;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  };
  for(let attempt=0;attempt<attempts;attempt++){
    const {response,body}=await request({headers:{'X-Firebase-ETag':'true'}});
    if(!response.ok)throw Object.assign(new Error(`Lecture de la salle refusée (${response.status}).`),{code:'round-read-refused'});
    const etag=response.headers.get('etag');
    if(!etag)throw new Error('Le serveur ne fournit pas de version de salle.');
    const next=reducer(structuredClone(body));
    // Already advanced: acknowledge without writing over subsequent turns.
    if(JSON.stringify(next)===JSON.stringify(body))return body;
    let saved;
    try {saved=await request({method:'PUT',headers:{'Content-Type':'application/json','If-Match':etag},body:JSON.stringify(next)});}
    catch(error){
      // Only receipt-protected/idempotent reducers may be retried after a lost ACK.
      // The next GET reconciles an applied PUT before considering another write.
      if(recoverWrites&&!signal?.aborted&&attempt+1<attempts&&Date.now()<deadline)continue;
      throw error;
    }
    if(saved.response.status===412)continue;
    if(!saved.response.ok)throw Object.assign(new Error(`Demande refusée par le serveur (${saved.response.status}).`),{code:'round-write-refused'});
    return saved.body;
  }
  throw Object.assign(new Error('La salle évolue encore. Réessaie : la demande sera vérifiée.'),{code:'round-conflict'});
}
