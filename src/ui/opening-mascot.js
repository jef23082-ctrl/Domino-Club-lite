import { OpeningMascotState } from './opening-mascot-state.js?v=20260910T004553338';
import { playPigGrunt, stopPigGrunt } from './sound-player.js?v=20260910T004553338';

export function createOpeningMascot({ stage, shell, notify = () => {} }) {
  const lifecycle = new OpeningMascotState();
  const layer = document.createElement('div');
  layer.className = 'opening-mascot';layer.hidden = true;
  layer.setAttribute('aria-label', 'Le cochon du club');
  const rig = document.createElement('div');rig.className = 'opening-mascot__rig';
  const effects = document.createElement('canvas');effects.className = 'opening-mascot__sparkles';effects.setAttribute('aria-hidden','true');
  const bubble = document.createElement('div');bubble.className = 'opening-mascot__bubble';bubble.setAttribute('role','status');
  const nose = document.createElement('button'), bow = document.createElement('button');
  for(const [button,label] of [[nose,'Toucher le groin du cochon'],[bow,'Toucher son nœud papillon']]) {
    button.type='button';button.className='opening-mascot__hotspot';button.setAttribute('aria-label',label);rig.append(button);
  }
  rig.append(bubble);layer.append(rig,effects);stage.append(layer);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer={x:0,y:0},look={x:0,y:0};
  let pig=null, loading=false, generation=0, failed=false, mode='gone', time=0, since=0;
  let frame=0,last=0,finishedAt=0,canPlay=false,selection='',clicks=[],disposed=false;
  const particles=[];
  const visible=()=>!document.hidden&&!shell.hidden&&shell.getBoundingClientRect().width>0;
  function setMode(next,message){mode=next;since=time;layer.dataset.mode=next;if(message)bubble.textContent=message;}
  function invitation(){return canPlay?'À toi de jouer':'À vous de jouer';}
  function resume(){setMode(selection&&canPlay?'select':'offer',selection&&canPlay?'Juste ici, à toi !':invitation());}
  function halt(){cancelAnimationFrame(frame);frame=0;last=0;}
  function hide(){generation++;loading=false;halt();mode='gone';layer.dataset.mode=mode;layer.hidden=true;layer.classList.remove('is-departing');particles.length=0;stopPigGrunt();}
  function freeModel(){if(pig){const previous=pig;pig=null;previous.renderer.domElement.remove();previous.dispose();}}
  async function ensureModel(){
    if(pig||loading||failed||!visible()||mode==='gone')return;
    loading=true;const ticket=++generation;
    try {
      const { Pig3D }=await import('./mascot/pig3d.js?v=20260910T004553338');
      if(ticket!==generation||disposed||mode==='gone')return;
      pig=new Pig3D();pig.renderer.domElement.className='opening-mascot__canvas';pig.renderer.domElement.setAttribute('aria-hidden','true');
      rig.prepend(pig.renderer.domElement);
      pig.renderer.domElement.addEventListener('webglcontextlost',()=>{if(disposed||!pig)return;failed=true;hide();freeModel();notify('Le cochon est indisponible sur cet appareil. La partie reste jouable.');});
      loading=false;layer.hidden=false;wake();
    }catch(error){loading=false;failed=true;hide();freeModel();console.warn('Mascotte 3D indisponible :',error);}
  }
  function wake(){
    if(disposed||mode==='gone'||!visible()){halt();return;}
    if(!pig){ensureModel();return;}
    if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
  }
  function react(next){
    if(!lifecycle.active||!pig||layer.hidden)return;
    const now=performance.now();clicks=clicks.filter(t=>now-t<1250);clicks.push(now);
    if(clicks.length>=4){next='guard';clicks=[];}
    setMode(next,{nose:'Groin-groin !',bow:'Toujours élégant.',guard:'Hé, doucement !'}[next]);
    if(next==='nose')playPigGrunt().then(result=>{
      if(result==='muted')notify('Effets coupés : active-les dans les réglages musicaux.');
      else if(result==='blocked'||result==='error')notify('Grognement indisponible. Réessaie depuis « Écouter le cochon » dans les réglages musicaux.');
    });
  }
  const onNose=()=>react('nose'),onBow=()=>react('bow');nose.addEventListener('click',onNose);bow.addEventListener('click',onBow);
  const move=event=>{const r=stage.getBoundingClientRect();pointer.x=Math.max(-1,Math.min(1,(event.clientX-r.left-r.width/2)/(r.width*.35)));pointer.y=Math.max(-1,Math.min(1,(event.clientY-r.top-r.height*.44)/(r.height*.35)));};
  const leave=()=>{pointer.x=0;pointer.y=0;};stage.addEventListener('pointermove',move);stage.addEventListener('pointerleave',leave);
  const observer=new MutationObserver(()=>{if(!visible())stopPigGrunt();wake();});observer.observe(shell,{attributes:true,attributeFilter:['hidden']});
  const onVisibility=()=>{if(!visible())stopPigGrunt();wake();};document.addEventListener('visibilitychange',onVisibility);
  function sparkle(dt,progress){
    const width=stage.clientWidth,height=stage.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    if(effects.width!==Math.round(width*dpr)||effects.height!==Math.round(height*dpr)){effects.width=Math.round(width*dpr);effects.height=Math.round(height*dpr);}
    const ctx=effects.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    if(mode!=='exit'||reduced.matches)return;
    if(progress<.65)for(let i=0;i<3;i++)particles.push({x:width*(.41+Math.random()*.1),y:height*(.41+Math.random()*.1),vx:(Math.random()-.5)*width*.08,vy:-height*(.025+Math.random()*.05),life:1});
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0){particles.splice(i,1);continue;}ctx.globalAlpha=p.life*(1-progress);ctx.fillStyle='#ffe4a0';ctx.fillRect(p.x,p.y,2,2);}
    ctx.globalAlpha=1;
  }
  function tick(now){
    frame=0;if(!visible()||mode==='gone'||!pig)return;
    const dt=Math.min((now-last)/1000,.05)||.016;last=now;time+=dt;
    let elapsed=time-since;
    if(mode==='arrival'&&elapsed>1){setMode('mix','Joue avec moi');elapsed=0;}
    if(mode==='mix'&&elapsed>4.4)resume();
    if(['nose','bow','guard'].includes(mode)&&elapsed>2.7)resume();
    if(mode==='offer'&&elapsed>14)setMode('idle','Je garde ta place…');
    if(mode==='idle'&&elapsed>4.5)resume();
    if(finishedAt){const age=time-finishedAt;
      if(age>3.7){hide();return;}
      if(age>2.6&&mode!=='exit')setMode('exit','Bonne partie !');
      else if(age>1.5&&mode==='clap')setMode('pack','Bonne partie !');
    }
    elapsed=time-since;
    look.x+=(pointer.x-look.x)*Math.min(1,dt*5);look.y+=(pointer.y-look.y)*Math.min(1,dt*5);
    try{pig.render({mode,t:time,elapsed,dt,look,slow:reduced.matches});}
    catch(error){failed=true;hide();freeModel();console.warn('Animation du cochon arrêtée :',error);return;}
    const arrival=mode==='arrival'?Math.min(1,elapsed/.8):1,exit=mode==='exit'?Math.min(1,elapsed/1.1):0;
    rig.style.opacity=String(arrival*(1-exit));
    rig.style.transform=`translateY(${reduced.matches?0:((1-arrival)*12-exit*12)}px)`;
    pig.hotspots().forEach((p,i)=>{const button=i?bow:nose;button.style.left=`${p.x*100-8}%`;button.style.top=`${p.y*100-4}%`;});
    sparkle(dt,exit);frame=requestAnimationFrame(tick);
  }
  function update(room){
    const action=lifecycle.update(room);
    if(action==='hide'){hide();return;}
    if(action==='start'){
      hide();failed=false;time=0;since=0;finishedAt=0;selection='';clicks=[];nose.disabled=false;bow.disabled=false;
      setMode('arrival','Joue avec moi');if(pig)layer.hidden=false;wake();
    }else if(action==='finish'){
      if(!pig||!visible()||layer.hidden){hide();return;}
      finishedAt=time||.001;selection='';nose.disabled=true;bow.disabled=true;stopPigGrunt();
      // Move beside the first real tile; never cover it or delay its transaction.
      layer.classList.add('is-departing');setMode('clap','Bien joué !');wake();
    }
  }
  function select({tileId='',playable=false,active=false}={}){
    canPlay=active;
    if(!lifecycle.active)return;
    const next=tileId&&playable&&active?tileId:'';
    if(next!==selection){selection=next;if(selection)setMode('select','Juste ici, à toi !');else if(mode==='select')resume();}
    else if(mode==='offer'&&bubble.textContent!==invitation())bubble.textContent=invitation();
  }
  const reset=()=>{lifecycle.reset();hide();freeModel();};
  function dispose(){disposed=true;reset();observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerleave',leave);layer.remove();}
  return {update,select,reset,dispose};
}
