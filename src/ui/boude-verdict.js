// Validated PNG artwork; continuous motion independent of player rerenders.
import { loadOptimizedImage } from './image-source.js?v=20260924T185554830';
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const between=(t,a,b)=>clamp((t-a)/(b-a));
const smooth=x=>x*x*(3-2*x);
const easeOut=x=>1-(1-x)**3;
const lerp=(a,b,t)=>a+(b-a)*t;
export function verdictElapsed(at,now=Date.now()){
  const time=Number(at);
  if(!Number.isFinite(time)||time<=0)return null;
  const elapsed=Math.max(0,(now-time)/1000);
  return elapsed<3.2?elapsed:null;
}
export function verdictReadyToStart(at,now=Date.now(),maxAge=1.2){
  const age=verdictElapsed(at,now);
  return age!==null&&age<=maxAge;
}
export function createBoudeVerdict({stage,onSound=()=>{},isVisible=()=>true,now=()=>Date.now()}){
  const canvas=document.createElement('canvas');
  canvas.className='boude-verdict';canvas.width=640;canvas.height=520;canvas.hidden=true;
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','BOUDÉÉÉ');stage.append(canvas);
  const ctx=canvas.getContext('2d'),assets={};
  const sources={domino:'../../assets/interactions/verdict/domino.png',frame:'../../assets/interactions/verdict/frame.png',bar:'../../assets/interactions/verdict/bar.png',spark:'../../assets/interactions/particles/star-glint.png',dust:'../../assets/interactions/particles/gold-dust.png'};
  const ready=Promise.all(Object.entries(sources).map(async([name,path])=>{
    assets[name]=await loadOptimizedImage(new URL(path,import.meta.url).href);
  })).then(()=>true).catch(()=>false);
  const particles=Array.from({length:56},(_,i)=>({angle:i*2.39996323,speed:70+(i*37%175),life:.4+(i*13%90)/100,delay:(i%9)*.016,size:2+(i*7%6),spin:(i%2?1:-1)*(i%5+1)}));
  const cueTimes=[['arm',.17],['slide',.54],['impact',.86],['shine',1.32],['return',2.52]];
  let generation=0,raf=0,activeSeat='',startedAt=0;
  const cues=new Set();
  function reset(){generation++;cancelAnimationFrame(raf);raf=0;canvas.hidden=true;activeSeat='';}
  function position(){
    const w=stage.clientWidth,h=stage.clientHeight,s=Math.min(w/1672,h/941);
    const width=(activeSeat==='top'?250:265)*s,height=width*520/640;
    const bounds=stage.getBoundingClientRect();
    const r=stage.querySelector('#seat-'+activeSeat+' .player-plaque')?.getBoundingClientRect();
    if(!r||!bounds.width||!bounds.height)return;
    const px=(r.left-bounds.left)/bounds.width*w,py=(r.top-bounds.top)/bounds.height*h,pr=(r.right-bounds.left)/bounds.width*w;
    let left,top;
    if(activeSeat==='top'){
      // The top player's verdict sits directly below and centred on their plaque.
      left=px+(r.width/bounds.width*w-width)/2;
      top=py+r.height/bounds.height*h+10*s;
    }
    else {
      // Side players use mirrored positions: right of the left plaque, left of the right plaque.
      left=activeSeat==='left'?pr+18*s:px-width-18*s;
      const plaqueCenter=py+(r.height/bounds.height*h)/2;
      top=plaqueCenter-height*(440/520);
    }
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    canvas.style.left=clamp(left,4*s,w-width-4*s)+'px';canvas.style.top=clamp(top,4*s,h-height-4*s)+'px';
  }
  function render(t){ctx.clearRect(0,0,640,520);ctx.save();ctx.translate(320,252);drawActor(t);ctx.restore();}
  async function play({seat,at}){
    if(!ctx||!verdictReadyToStart(at,now())||!['top','left','right'].includes(seat)||!isVisible()||document.hidden)return;
    reset();const ticket=generation;
    if(!await ready||ticket!==generation)return;
    const age=verdictElapsed(at,now());if(age===null||age>1.2||!isVisible()||document.hidden)return;
    activeSeat=seat;startedAt=performance.now()-age*1000;canvas.dataset.seat=seat;canvas.dataset.eventAt=String(at);
    cues.clear();for(const [name,time]of cueTimes)if(time<age)cues.add(name);
    position();canvas.hidden=false;
    const step=()=>{
      if(!isVisible()||document.hidden){reset();return;}
      const t=(performance.now()-startedAt)/1000;if(t>=3.2){reset();return;}
      for(const [name,time]of cueTimes)if(t>=time&&!cues.has(name)){cues.add(name);onSound('verdict-'+name);}
      render(t);raf=requestAnimationFrame(step);
    };step();
  }
  const observer=new ResizeObserver(()=>{if(activeSeat)position();});observer.observe(stage);
  const visibility=()=>{if(document.hidden)reset();};document.addEventListener('visibilitychange',visibility);
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function sprite(name,x,y,w,h,crop){const image=assets[name];if(!image)return;if(crop)ctx.drawImage(image,...crop,x,y,w,h);else ctx.drawImage(image,x,y,w,h);}
function fade(t){return smooth(between(t,0,.24))*(1-smooth(between(t,2.78,3.2)));}
function bloom(x,y,r,opacity){ctx.save();ctx.globalAlpha*=opacity;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#fff8bb');g.addColorStop(.13,'#ffd976b0');g.addColorStop(.48,'#c284251d');g.addColorStop(1,'#bf761000');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();}
function glint(x,y,size,opacity,angle=0){ctx.save();ctx.globalAlpha*=opacity;ctx.translate(x,y);ctx.rotate(angle);ctx.globalCompositeOperation='lighter';sprite('spark',-size/2,-size/2,size,size);ctx.restore();}

function drawPlaque(t){
  const reveal=easeOut(between(t,.87,1.2));if(reveal<=0)return;
  ctx.save();ctx.globalAlpha*=reveal;ctx.translate(0,(1-reveal)*17);
  const width=552;const gold=ctx.createLinearGradient(-width/2,126,width/2,256);gold.addColorStop(0,'#fff0ae');gold.addColorStop(.2,'#ac6c14');gold.addColorStop(.47,'#ffdf72');gold.addColorStop(.67,'#81500d');gold.addColorStop(1,'#f9d981');
  ctx.shadowColor='#000b';ctx.shadowBlur=22;ctx.shadowOffsetY=14;
  roundRect(-width/2,148,width,92,16);ctx.fillStyle=gold;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  roundRect(-width/2+3,151,width-6,86,13);const bg=ctx.createLinearGradient(0,121,0,264);bg.addColorStop(0,'#15291c');bg.addColorStop(.5,'#06110d');bg.addColorStop(1,'#0a170e');ctx.fillStyle=bg;ctx.fill();
  roundRect(-width/2+8,156,width-16,76,9);ctx.lineWidth=.65;ctx.strokeStyle='#b8924360';ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';
  const label='BOUDÉÉÉ';ctx.font='bold 62px Georgia';
  // Extrusion, dark bevel, bright rim and a moving reflection are kept inside the glyphs.
  for(let depth=5;depth>0;depth--){ctx.fillStyle=depth>2?'#502806':'#9a590b';ctx.fillText(label,0,194+depth);}
  ctx.lineWidth=1;ctx.strokeStyle='#fff0ab';ctx.strokeText(label,0,193);
  const metal=ctx.createLinearGradient(0,158,0,226);metal.addColorStop(0,'#fffde0');metal.addColorStop(.22,'#ffe88d');metal.addColorStop(.41,'#ffdc58');metal.addColorStop(.49,'#a86105');metal.addColorStop(.56,'#ffd34f');metal.addColorStop(.76,'#fff3a5');metal.addColorStop(1,'#da8b16');
  ctx.fillStyle=metal;ctx.fillText(label,0,193);
  const sweep=lerp(-520,520,between(t,1.05,2.3));
  const reflect=ctx.createLinearGradient(sweep-90,0,sweep+90,0);reflect.addColorStop(0,'#fffce000');reflect.addColorStop(.35,'#fffce000');reflect.addColorStop(.51,'#ffffeebf');reflect.addColorStop(.58,'#fffce038');reflect.addColorStop(1,'#fffce000');ctx.fillStyle=reflect;ctx.fillText(label,0,193);

  for(const x of [-254,254]){ctx.save();ctx.translate(x,193);ctx.rotate(Math.PI/4);ctx.fillStyle='#d6a442';ctx.fillRect(-3,-3,6,6);ctx.restore();}
  const flash=Math.max(0,Math.sin(between(t,.9,1.65)*Math.PI));glint(sweep*.46,159,44,flash*.8);ctx.restore();
}

function drawActor(t){
  const visibility=fade(t);if(visibility<=0)return;
  ctx.save();ctx.globalAlpha=visibility;
  const entrance=easeOut(between(t,0,.35));ctx.translate(0,(1-entrance)*45);ctx.scale(.92+.08*entrance,.92+.08*entrance);
  const impact=t-.86;const vibration=impact>0?Math.sin(impact*65)*Math.exp(-impact*16)*3.5:0;
  ctx.translate(vibration,0);
  // Shadow follows the rise of the object, not the rectangular bounds of the PNG.
  ctx.save();ctx.scale(1,.15);const shadow=ctx.createRadialGradient(0,630,0,0,630,260);shadow.addColorStop(0,'#000b');shadow.addColorStop(1,'#0000');ctx.fillStyle=shadow;ctx.fillRect(-270,350,540,560);ctx.restore();
  const armed=smooth(between(t,.14,.43));const retreat=smooth(between(t,2.5,2.83));
  const approach=easeOut(between(t,.12,.7));const recoil=impact>0?Math.sin(Math.min(impact/.34,1)*Math.PI)*18:0;
  ctx.save();ctx.translate(lerp(-70,0,approach)-recoil,28-28*approach+retreat*30);ctx.rotate((lerp(-.2,0,approach)-recoil*.005));ctx.scale(.82+.18*approach-retreat*.06,.82+.18*approach-retreat*.06);ctx.globalAlpha*=1-retreat*.65;
  ctx.shadowColor='#0008';ctx.shadowBlur=15;ctx.shadowOffsetY=10;sprite('domino',-68,-212,136,264,[340,68,580,1130]);ctx.restore();
  ctx.save();ctx.globalAlpha*=armed;ctx.translate(0,(1-armed)*35);sprite('frame',-280,-230,560,373.333);ctx.restore();
  const drop=between(t,.54,.86);const barY=lerp(-186,-57,drop*drop*drop);const bounce=impact>0&&impact<.28?-Math.sin(impact/.28*Math.PI)*6:0;
  ctx.save();ctx.globalAlpha*=armed;ctx.translate(0,lerp(barY+bounce,-186,easeOut(retreat)));sprite('bar',-250,-35,500,73,[25,390,1484,224]);ctx.restore();
  const light=impact>0?Math.exp(-impact*5):0;bloom(0,-50,310,light*.5);
  if(impact>0&&impact<.8){ctx.save();ctx.globalAlpha*=Math.pow(1-impact/.8,2)*.13;ctx.globalCompositeOperation='lighter';sprite('dust',-235-impact*30,-190-impact*15,470+impact*60,260+impact*30);ctx.restore();}
  if(impact>0&&impact<1){ctx.save();ctx.globalAlpha*=Math.pow(1-impact,2)*.65;ctx.strokeStyle='#ffdf81';ctx.lineWidth=2.3;ctx.shadowColor='#efb634';ctx.shadowBlur=14;ctx.beginPath();ctx.ellipse(0,81,80+impact*225,8+impact*36,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  // Ballistic sparks leave both mechanical contacts then fall and fade continuously.
  for(let i=0;i<particles.length;i++){
    const p=particles[i],age=impact-p.delay;if(age<0||age>p.life)continue;
    const a=1-age/p.life,origin=i%2?-220:220;
    const x=origin+Math.cos(p.angle)*p.speed*age;
    const y=-48-Math.abs(Math.sin(p.angle))*p.speed*age+100*age*age;
    ctx.save();ctx.globalAlpha*=a*a;ctx.globalCompositeOperation='lighter';ctx.strokeStyle=i%4?'#ffc744':'#fff3bb';ctx.lineWidth=i%4?1.5:2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(p.angle)*5*a,y+7*a);ctx.stroke();ctx.restore();
    if(i%7===0)glint(x,y,18*a,a*.8,age*p.spin);
  }
  // Warm, small optical glints on the metal parts.
  if(t>.25&&t<2.7){glint(-224,-168,38,.5+.35*Math.sin(t*8),t*.4);glint(226,61,30,.4+.3*Math.sin(t*7+1),-t*.3);}
  drawPlaque(t);ctx.restore();
}

return {play,reset,dispose(){reset();observer.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.remove();}};
}
