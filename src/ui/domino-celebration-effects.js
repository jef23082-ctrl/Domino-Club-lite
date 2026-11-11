const W = 1672, H = 941;
const palette = ['#ffc86d','#fff2af','#ffae42','#ff5648','#ffc888','#f84733'];
export const DOMINO_FIREWORK_TIMES = [.62,.88,1.47,2.32,2.66,3.82,4.26,5.35];
const centers = [[461,103],[1121,99],[395,160],[1187,149],[523,85],[1092,135],[450,130],[1150,110]];
const burstColors = [0,3,1,0,3,1,0,3];
const windows = [
  [[326,90],[352,19],[424,0],[527,0],[574,34],[601,98],[586,260],[327,279]],
  [[956,126],[980,65],[1030,22],[1111,5],[1183,27],[1237,83],[1255,138],[1248,278],[968,278]]
];

const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

export function runDominoCelebrationEffects(backCanvas, frontCanvas, mode, elapsed) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const back = backCanvas.getContext('2d');
  const front = frontCanvas.getContext('2d');
  for (const {canvas} of [back,front]) {
    canvas.width = 1340;
    canvas.height = 754;
    canvas.getContext('2d').setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  }
  const fx = {};
  let frame = 0;
  const start = performance.now() - elapsed;
  const duration = mode === 'match' ? 7700 : 5000;
  const clear = () => { back.clearRect(0,0,W,H); front.clearRect(0,0,W,H); };

  function newEffects(){
    const random=rng(mode==='match'?31319:4261),mix=(a,b)=>a+(b-a)*random();
    fx.stars=Array.from({length:92},()=>({x:mix(438,1234),y:mix(223,609),a:mix(0,6.3),v:mix(.5,3.7),r:mix(.7,3.4)}));
    fx.confetti=Array.from({length:reduced?48:158},()=>({x:mix(28,1644),y:mix(-220,-10),t:mix(0,5.3),vx:mix(-92,92),v:mix(103,205),spin:mix(-8,8),phi:mix(0,6.3),w:mix(4,15),h:mix(4,11),color:palette[Math.floor(mix(0,palette.length))]}));
    fx.bursts=centers.map(([x,y],i)=>({
      t:DOMINO_FIREWORK_TIMES[i],x,y,r:mix(107,149),color:palette[burstColors[i]],
      stars:Array.from({length:68},(_,j)=>({
        angle:j*6.283/68+mix(-.055,.055),
        speed:j%6===0?mix(.28,.52):mix(.62,1.25),
        life:mix(.76,1.44),glint:mix(0,6.3),curl:mix(-23,23),width:mix(.8,1.9),
        color:palette[(burstColors[i]+(j%7===0?1:0))%palette.length]
      }))
    }));
  }
  function glow(ctx,x,y,r,alpha,color='#ffbf48'){
    if(alpha<=0)return;
    const grad=ctx.createRadialGradient(x,y,0,x,y,r);
    grad.addColorStop(0,color);grad.addColorStop(.12,color+'9c');grad.addColorStop(1,color+'00');
    ctx.globalAlpha=alpha;ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  function ray(ctx,x,y,r,alpha,color='#ffe199'){
    ctx.globalAlpha=clamp(alpha);ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x-1.3,y-1.5);ctx.lineTo(x,y-r*.67);ctx.lineTo(x+1.3,y-1.5);ctx.lineTo(x+r,y);ctx.lineTo(x+1.3,y+1.5);ctx.lineTo(x,y+r*.67);ctx.lineTo(x-1.3,y+1.5);ctx.fill();
  }
  function beams(ctx,x,y,r,t,alpha){
    glow(ctx,x,y,r,alpha*.75);
    const fill=ctx.createRadialGradient(x,y,5,x,y,r);fill.addColorStop(0,'#fff1bb');fill.addColorStop(.26,'#ffc55478');fill.addColorStop(1,'#fca62b00');
    ctx.fillStyle=fill;
    for(let i=0;i<23;i++){const a=i*Math.PI*2/23+t*.065;const w=.004+(i%3)*.008;ctx.globalAlpha=alpha*(.18+i%4*.11);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a-w)*r,y+Math.sin(a-w)*r);ctx.lineTo(x+Math.cos(a+w)*r,y+Math.sin(a+w)*r);ctx.closePath();ctx.fill();}
  }
  function burningSpark(fire,spark,t){
    const spread=(1-Math.exp(-t*2.1))*fire.r*spark.speed;
    return [fire.x+Math.cos(spark.angle)*spread+spark.curl*t*t,
      fire.y+Math.sin(spark.angle)*spread+50*t*t];
  }
  function fireworks(t){
    back.save();
    back.beginPath();
    for(const [first,...rest] of windows){
      back.moveTo(...first);
      for(const point of rest)back.lineTo(...point);
      back.closePath();
    }
    back.clip();
    back.globalCompositeOperation='lighter';
    back.lineCap='round';
    for(const fire of fx.bursts){
      const age=t-fire.t;
      if(age<-.42||age>1.6)continue;
      if(age<0){
        const f=clamp(1+age/.42),lx=fire.x-55*(1-f),ly=fire.y+222*(1-f);
        back.strokeStyle='#ffc070';back.globalAlpha=.82;back.lineWidth=2.3;back.beginPath();back.moveTo(lx-9,ly+28);back.lineTo(lx,ly);back.stroke();ray(back,lx,ly,8,.75);continue;
      }
      glow(back,fire.x,fire.y,57,Math.max(0,.87-age*3.25),fire.color);
      for(const s of fire.stars){
        if(age>s.life)continue;
        const [x,y]=burningSpark(fire,s,age);
        const alpha=clamp((1-age/s.life)*1.48*(.86+.14*Math.sin(age*24+s.glint)));
        let head=[x,y];
        for(let tail=1;tail<=4;tail++){
          const next=burningSpark(fire,s,Math.max(0,age-tail*.077));
          back.globalAlpha=alpha*(1-tail*.2);
          back.strokeStyle=s.color;back.lineWidth=s.width*(1.9-tail*.2);
          back.beginPath();back.moveTo(...head);back.lineTo(...next);back.stroke();
          head=next;
        }
        if(s.glint%2<.72)glow(back,x,y,4+s.width,alpha*.76,s.color);
        back.globalAlpha=alpha;
        back.fillStyle='#fff1c7';
        back.fillRect(x-.54*s.width,y-.54*s.width,s.width,s.width);
      }
    }
    back.restore();
  }
  const frameEdges=[
    [480,312,1190,312],[1190,312,1208,329],[1208,329,1213,362],
    [1213,362,1213,570],[1213,570,1184,595],[1184,595,485,595],
    [485,595,456,572],[456,572,456,362],[456,362,465,331],[465,331,480,312]
  ].map(([x1,y1,x2,y2])=>({x1,y1,x2,y2,length:Math.hypot(x2-x1,y2-y1)}));
  const frameLength=frameEdges.reduce((total,edge)=>total+edge.length,0);
  function framePoint(distance){
    for(const {x1,y1,x2,y2,length} of frameEdges){
      if(distance<=length){
        const ratio=distance/length;
        return [x1+(x2-x1)*ratio,y1+(y2-y1)*ratio];
      }
      distance-=length;
    }
    return [480,312];
  }
  function frameShine(t,fade){
    for(const [index,offset] of [0,530,1030,1510].entries()){
      const distance=(offset+t*385)%frameLength;
      const alpha=(.65+.35*Math.sin(t*8+index))*fade;
      for(let i=1;i<=9;i++){
        const [x,y]=framePoint((distance-i*4+frameLength)%frameLength);
        const tail=1-i/10;
        ray(front,x,y,1.5+3.2*tail,alpha*tail*.64);
      }
      const [x,y]=framePoint(distance);
      glow(front,x,y,27,alpha*.64);
      ray(front,x,y,17,alpha,'#fff2bb');
    }
  }
  function fore(t){
    front.save();front.beginPath();front.rect(0,0,W,629);front.clip();
    if(mode==='match'){
      for(const p of fx.confetti){
        const age=t-p.t;if(age<0||age>3.5)continue;
        const x=p.x+p.vx*age+Math.sin(age*4+p.phi)*23,y=p.y+p.v*age+32*age*age;
        if(y<0||y>627||x<0||x>W)continue;
        const turn=Math.cos(age*p.spin+p.phi),fade=clamp((629-y)/75);
        front.save();front.globalAlpha=fade*(.64+.36*Math.abs(turn));front.translate(x,y);front.rotate(p.phi+age*p.spin*.37);
        front.fillStyle=turn>.1?p.color:'#974518';front.fillRect(-p.w*.5,-p.h*.5,p.w*Math.max(.15,Math.abs(turn)),p.h);
        if(turn>.8){front.globalAlpha=fade*.46;front.fillStyle='#fff9c8';front.fillRect(-p.w*.5,-p.h*.5,p.w*.65,1.25);}front.restore();
      }
    }
    front.globalCompositeOperation='lighter';
    const fade=ease(t/.33)*(1-ease((t-(mode==='round'?3.55:6.5))/1.2));
    for(const p of fx.stars){
      const a=(.5+.5*Math.sin(p.a+t*p.v*3))**4*fade;
      if(a>.08)ray(front,p.x+Math.sin(t*.8+p.a)*12,p.y-t*(mode==='round'?4.2:1.4),p.r*2.2,a);
    }
    if(mode==='round'){
      const appear=ease(t/.45);
      for(const [center,direction] of [[616,1],[1058,-1]])for(let i=0;i<70;i++){
        const a=direction*t*2.66-i*.041, f=1-i/71,x=center+Math.cos(a)*119,y=436+Math.sin(a)*36+Math.cos(a)*11*direction;
        const opacity=f*f*appear*fade;
        if(i===0){glow(front,x,y,21,opacity*.68);ray(front,x,y,14,opacity);}
        else{front.globalAlpha=opacity;front.fillStyle=i%4?'#ffca52':'#fff3be';front.fillRect(x,y,1.6+2*f,1.6+2*f);}
      }
      frameShine(t,fade);
      const pulse=(.58+.42*Math.sin(t*4.4)**2)*fade;
      glow(front,836,594,79,.42*pulse);ray(front,836,594,66,.82*pulse);
      glow(front,456,525,35,.42*fade);glow(front,1213,525,35,.42*fade);
    }else{
      const rise=ease((t-.15)/.47);
      glow(front,836,612,95,.30*rise*fade);
      const x=560+552*((t*.45)%1),y=539+26*((x-836)/276)**2;
      glow(front,x,y,22,rise*fade*.52);
      ray(front,x,y,23,rise*fade*.75);
    }
    front.restore();
  }
  function paint(now) {
    clear();
    if (now - start >= duration) return;
    const t = Math.max(0, (now - start) / 1000);
    if (mode === 'match') fireworks(t);
    else if (!reduced) {
      back.save();
      back.globalCompositeOperation = 'lighter';
      beams(back,836,342,258,t,.7*ease(t/.42)*(1-ease((t-3.8)/1.1)));
      back.restore();
    }
    fore(t);
    frame = requestAnimationFrame(paint);
  }
  newEffects();
  if (elapsed < duration) frame = requestAnimationFrame(paint);
  return () => { cancelAnimationFrame(frame); clear(); };
}
