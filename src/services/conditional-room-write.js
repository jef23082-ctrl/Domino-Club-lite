// A bounded, server-confirmed compare-and-swap independent of the SDK's
// WebSocket/reconnect queue. Firebase rules still apply to every HTTP request.
export async function conditionalRoomWrite(reference, reducer, {fetcher=globalThis.fetch, timeoutMs=6000, attempts=6}={}) {
  const address=String(reference);
  if(!/^https?:\/\//.test(address))throw new Error('Adresse de salle invalide.');
  const url=new URL(address.replace(/\/$/,'')+'.json');
  // Reuse an existing Firebase Auth identity, if this deployment has one.
  const auth=reference.database?.app?.auth;
  if(typeof auth==='function'){
    const user=auth.call(reference.database.app)?.currentUser;
    if(user)url.searchParams.set('auth',await user.getIdToken());
  }
  const request=async options=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetcher(url.href,{...options,cache:'no-store',signal:controller.signal});
      const body=await response.json();return {response,body};
    }catch(error){
      if(controller.signal.aborted)throw Object.assign(new Error('Le serveur ne confirme pas la manche. Nouvelle tentative possible.'),{code:'round-network-timeout'});
      throw error;
    }finally{clearTimeout(timer);}
  };
  for(let attempt=0;attempt<attempts;attempt++){
    const {response,body}=await request({headers:{'X-Firebase-ETag':'true'}});
    if(!response.ok)throw Object.assign(new Error(`Lecture de la salle refusée (${response.status}).`),{code:'round-read-refused'});
    const etag=response.headers.get('etag');
    if(!etag)throw new Error('Le serveur ne fournit pas de version de salle.');
    const next=reducer(structuredClone(body));
    // Already advanced: acknowledge without writing over subsequent turns.
    if(JSON.stringify(next)===JSON.stringify(body))return body;
    const saved=await request({method:'PUT',headers:{'Content-Type':'application/json','If-Match':etag},body:JSON.stringify(next)});
    if(saved.response.status===412)continue;
    if(!saved.response.ok)throw Object.assign(new Error(`Lancement refusé par le serveur (${saved.response.status}).`),{code:'round-write-refused'});
    return saved.body;
  }
  throw Object.assign(new Error('La salle évolue encore. Réessaie la manche suivante.'),{code:'round-conflict'});
}
