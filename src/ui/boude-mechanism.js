// Presentation only. Never calls click(), a room repository, game logic or
// audio. The existing native button and its business listener stay in charge.
const SVG_NS='http://www.w3.org/2000/svg';
const art = new URL('../../assets/domino-premium-v52/boude-mechanism.png', import.meta.url).href;
const center='M390 88 H1667 C1753 88 1806 115 1815 203 C1826 287 1794 357 1697 359 H385 C293 359 239 334 239 240 C239 146 279 88 390 88Z';
let sequence=0;

function element(doc,name,attributes={}) {
  const node=doc.createElementNS(SVG_NS,name);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  return node;
}

function artwork(doc,fixed) {
  const id=`boude-cut-${++sequence}`;
  const svg=element(doc,'svg',{viewBox:'0 0 2048 480',preserveAspectRatio:'none','aria-hidden':'true',focusable:'false'});
  svg.classList.add(fixed?'boude-fixed-art':'boude-moving-art');
  const defs=element(doc,'defs');
  const mask=element(doc,'mask',{id,maskUnits:'userSpaceOnUse',x:0,y:0,width:2048,height:480});
  if(fixed)mask.append(
    // Keep every gold leaf and the original dark mounting backing, not an
    // approximate silhouette which would shave off their metallic highlights.
    element(doc,'rect',{x:0,y:0,width:2048,height:480,fill:'white'}),
    element(doc,'path',{d:center,fill:'black'})
  );
  else mask.append(element(doc,'path',{d:center,fill:'white'}));
  defs.append(mask);
  const image=element(doc,'image',{href:art,width:2048,height:480,preserveAspectRatio:'none',mask:`url(#${id})`});
  svg.append(defs,image);
  return svg;
}

export function createBoudeMechanism(button,{onFeedback=()=>{}}={}) {
  const doc=button.ownerDocument;
  const win=doc.defaultView;
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  const moving=doc.createElement('span');moving.className='boude-moving';moving.setAttribute('aria-hidden','true');
  moving.append(artwork(doc,false));
  const sheen=doc.createElement('span');sheen.className='boude-metal-sheen';moving.append(sheen);
  const bed=doc.createElement('span');bed.className='boude-cavity';bed.setAttribute('aria-hidden','true');
  const rim=doc.createElement('span');rim.className='boude-seat-light';rim.setAttribute('aria-hidden','true');
  const label=doc.createElement('span');label.className='sr-only';label.textContent='BOUDÉÉÉ';
  button.classList.add('boude-mechanism');
  button.setAttribute('aria-label','Bouder — passer mon tour');
  button.replaceChildren(bed,artwork(doc,true),moving,rim,label);
  button.dataset.mechanicalPhase='idle';

  let gesture=null,cycle=null,cancelNextClick=false;
  let downTimer=0,releaseTimer=0,endTimer=0,shineTimer=0;
  const history=[];
  const now=()=>win.performance.now();
  const duration=()=>reduced.matches?{down:25,minimum:40,release:50}:{down:130,minimum:150,release:170};
  const enabled=()=>!button.disabled&&!button.hidden&&button.isConnected;
  const pointInside=event=>{const box=button.getBoundingClientRect();return event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom;};
  function phase(value) {
    button.dataset.mechanicalPhase=value;
    history.push({phase:value,at:now()});
    if(history.length>80)history.shift();
    onFeedback({phase:value,button});
    button.dispatchEvent(new win.CustomEvent('boude-mechanical-feedback',{detail:{phase:value},bubbles:false}));
  }
  function clearMotion() {
    for(const id of [downTimer,releaseTimer,endTimer])win.clearTimeout(id);
    downTimer=releaseTimer=endTimer=0;
  }
  function start() {
    if(!enabled())return false;
    clearMotion();
    cycle={start:now(),activated:false};
    phase('idle');
    // Restart the CSS keyframe without layout reads or changes to dimensions.
    for(const animation of moving.getAnimations())animation.cancel();
    phase('pressing');
    downTimer=win.setTimeout(()=>{if(cycle&&button.dataset.mechanicalPhase==='pressing')phase('pressed');},duration().down);
    return true;
  }
  function release() {
    if(!cycle)return;
    const wait=Math.max(0,duration().minimum-(now()-cycle.start));
    win.clearTimeout(releaseTimer);
    releaseTimer=win.setTimeout(()=> {
      win.clearTimeout(downTimer);
      phase('releasing');
      endTimer=win.setTimeout(()=>{phase('idle');cycle=null;},duration().release);
    },wait);
  }
  function activate() {
    if(!cycle&&!start())return;
    cycle.activated=true;
    win.clearTimeout(shineTimer);
    button.classList.remove('is-mechanically-activated');
    // Resolving animation styles (not geometry) makes rapid reflections restart
    // cleanly, without forcing layout or a synthetic activation.
    sheen.getAnimations({subtree:true});
    button.classList.add('is-mechanically-activated');
    for(const animation of sheen.getAnimations({subtree:true})){animation.currentTime=0;animation.play();}
    shineTimer=win.setTimeout(()=>button.classList.remove('is-mechanically-activated'),reduced.matches?70:350);
    onFeedback({phase:'activation',button});
  }
  function reset({instant=false}={}) {
    clearMotion();gesture=null;cycle=null;
    win.clearTimeout(shineTimer);button.classList.remove('is-mechanically-activated');
    phase(instant?'idle':'cancelled');
    if(!instant)endTimer=win.setTimeout(()=>phase('idle'),reduced.matches?40:120);
  }
  function down(event) {
    if(event.button!==0||event.isPrimary===false||!enabled())return;
    cancelNextClick=false;
    if(start())gesture={kind:'pointer',id:event.pointerId,cancelled:false};
  }
  function leave(event) {
    if(gesture?.kind!=='pointer'||gesture.id!==event.pointerId)return;
    cancelNextClick=true;
    reset();
  }
  function up(event) {
    if(gesture?.kind!=='pointer'||gesture.id!==event.pointerId)return;
    if(!pointInside(event)||!enabled()){cancelNextClick=true;reset();return;}
    gesture=null;release();
  }
  function cancel(event) {
    if(gesture?.kind==='pointer'&&gesture.id===event.pointerId){cancelNextClick=true;reset();}
  }
  function click(event) {
    if(cancelNextClick&&event.detail>0){cancelNextClick=false;event.preventDefault();event.stopImmediatePropagation();return;}
    if(!enabled())return;
    if(!cycle)start();
    activate();
    if(!gesture)release();
    // No game action here. The one pre-existing native click handler runs next.
  }
  function keyDown(event) {
    if(!['Enter',' '].includes(event.key)||!enabled())return;
    if(event.repeat){event.preventDefault();return;}
    cancelNextClick=false;
    if(start())gesture={kind:'keyboard',key:event.key};
  }
  function keyUp(event) {
    if(gesture?.kind==='keyboard'&&gesture.key===event.key){gesture=null;release();}
  }
  const blur=()=>{cancelNextClick=Boolean(gesture);reset();};
  const visibility=()=>{if(doc.hidden)blur();};
  button.addEventListener('pointerdown',down);
  button.addEventListener('pointerleave',leave);
  win.addEventListener('pointerup',up,true);
  win.addEventListener('pointercancel',cancel,true);
  button.addEventListener('click',click,true);
  button.addEventListener('keydown',keyDown);
  button.addEventListener('keyup',keyUp);
  button.addEventListener('blur',blur);
  win.addEventListener('blur',blur);
  doc.addEventListener('visibilitychange',visibility);
  const observer=new win.MutationObserver(()=> {
    if(button.hidden||!button.isConnected)reset({instant:true});
    else if(button.disabled&&cycle&&!cycle.activated)reset();
  });
  observer.observe(button,{attributes:true,attributeFilter:['disabled','hidden']});
  return {
    get phase(){return button.dataset.mechanicalPhase;},
    get history(){return history.slice();},
    preview(){if(!enabled())return;start();activate();release();},
    reset,
    destroy(){
      reset({instant:true});observer.disconnect();
      button.removeEventListener('pointerdown',down);button.removeEventListener('pointerleave',leave);
      win.removeEventListener('pointerup',up,true);win.removeEventListener('pointercancel',cancel,true);
      button.removeEventListener('click',click,true);button.removeEventListener('keydown',keyDown);button.removeEventListener('keyup',keyUp);
      button.removeEventListener('blur',blur);win.removeEventListener('blur',blur);doc.removeEventListener('visibilitychange',visibility);
    }
  };
}
