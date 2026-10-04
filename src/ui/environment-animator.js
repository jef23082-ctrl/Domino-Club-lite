import { SIZE } from '../config/domino-environments.js?v=20261004T170705413';
const NS='http://www.w3.org/2000/svg';
let instance=0;
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function bounds(points){const pairs=points.split(' ').map(p=>p.split(',').map(Number));return {x:Math.min(...pairs.map(p=>p[0])),y:Math.min(...pairs.map(p=>p[1])),right:Math.max(...pairs.map(p=>p[0])),bottom:Math.max(...pairs.map(p=>p[1]))};}

// No game dependencies, timer, animation frame loop, network or global transforms.
// One bounded SVG scene per instance; removal releases every animation at once.
export class EnvironmentAnimator {
  constructor(host){
    this.host=host;this.doc=host.ownerDocument;this.win=this.doc.defaultView;this.id=`ambient-${++instance}`;
    this.root=this.doc.createElement('div');this.root.className='environment-layer';this.root.setAttribute('aria-hidden','true');host.append(this.root);
    this.motion=this.win.matchMedia('(prefers-reduced-motion: reduce)');
    this.onMotion=()=>this.render();this.onVisibility=()=>this.root.dataset.paused=String(this.doc.hidden || !!this.paused);
    this.motion.addEventListener('change',this.onMotion);this.doc.addEventListener('visibilitychange',this.onVisibility);
  }
  set(environment,{quality='AUTO',weather='breeze',intensity=85}={}){
    const nextQuality=['AUTO','FULL','REDUCED','OFF'].includes(quality)?quality:'AUTO';
    const nextWeather=['calm','breeze','windy'].includes(weather)?weather:'breeze';
    const nextIntensity=Math.max(0,Math.min(100,Number.isFinite(Number(intensity))?Number(intensity):85));
    // Room/presence snapshots must not restart the scenery on every move.
    if(this.environment===environment&&this.quality===nextQuality&&this.weather===nextWeather&&this.intensity===nextIntensity)return;
    this.environment=environment;this.quality=nextQuality;this.weather=nextWeather;this.intensity=nextIntensity;this.render();
  }
  element(tag,attrs={},parent){const e=this.doc.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))e.setAttribute(key,String(value));if(parent)parent.append(e);return e;}
  clip(points){const id=`${this.id}-clip-${++this.clipCount}`;const c=this.element('clipPath',{id},this.defs);this.element('polygon',{points},c);return `url(#${id})`;}
  texture(parent){return this.element('image',{href:this.environment.image,width:SIZE.width,height:SIZE.height,preserveAspectRatio:'none'},parent);}
  timing(node,low,high){node.style.setProperty('--duration',`${low+this.random()*(high-low)}s`);node.style.setProperty('--delay',`${-this.random()*29}s`);}
  render(){
    if(this.destroyed||!this.environment)return;
    this.root.replaceChildren();this.clipCount=0;this.random=seeded(this.environment.seed);
    // AUTO follows the device. FULL is an explicit preview choice, never a
    // change to device settings or the game's own reduced-motion behavior.
    const quality=this.quality==='AUTO'?(this.motion.matches?'REDUCED':'FULL'):this.quality;
    this.root.dataset.quality=quality;this.root.dataset.weather=this.weather;this.root.dataset.intensity=String(this.intensity);this.root.style.setProperty('--motion-level',String(this.intensity/50));this.onVisibility();
    if(quality==='OFF'||this.intensity===0)return;
    const e=this.environment,svg=this.element('svg',{viewBox:`0 0 ${SIZE.width} ${SIZE.height}`,preserveAspectRatio:'none'},this.root);
    this.defs=this.element('defs',{},svg);
    // Conservative common exclusion: every effect stays above y=302, where no
    // supplied table begins. No moving pixel can enter felt, rim or front plaque.
    const scene=this.element('g',{'clip-path':this.clip('0,0 1586,0 1586,302 0,302')},svg);
    const gradient=this.element('radialGradient',{id:`${this.id}-warm`},this.defs);
    this.element('stop',{offset:0,'stop-color':'#ffe3a1','stop-opacity':.75},gradient);
    this.element('stop',{offset:.35,'stop-color':'#ffbd51','stop-opacity':.32},gradient);
    this.element('stop',{offset:1,'stop-color':'#ffb348','stop-opacity':0},gradient);
    const sheen=this.element('linearGradient',{id:`${this.id}-cloth`},this.defs);
    for(const [offset,opacity] of [[0,0],[.4,0],[.53,.6],[.66,0],[1,0]])this.element('stop',{offset,'stop-color':'#fff2d1','stop-opacity':opacity},sheen);
    // Use only original flag pixels. Fixed polygon clips keep its silhouette,
    // pole and surroundings intact. Micro-displaced strips animate the folds.
    const fb=bounds(e.flag),flag=this.element('g',{'clip-path':this.clip(e.flag)},scene);
    for(let i=0;i<12;i++){
      const x=fb.x+(fb.right-fb.x)*i/12,w=(fb.right-fb.x)/12;
      const strip=this.element('g',{'clip-path':this.clip(`${x},${fb.y} ${x+w+.3},${fb.y} ${x+w+.3},${fb.bottom} ${x},${fb.bottom}`)},flag);
      const moving=this.element('g',{class:'flag-strip'},strip);
      // Keep the hoist still; fold travel grows toward the free edge. A few
      // source pixels remain visible at normal table size within a few seconds.
      moving.style.setProperty('--travel',`${(i===0?.08:3.5+i*.37)*e.wind}px`);moving.style.setProperty('--duration',`${3.6+e.wind*.4}s`);moving.style.setProperty('--delay',`${-i*.16-e.seed%4}s`);
      this.texture(moving);
    }
    this.element('rect',{x:fb.x-100,y:fb.y,width:fb.right-fb.x+200,height:fb.bottom-fb.y,fill:`url(#${this.id}-cloth)`,class:'fabric-light'},flag);
    for(const region of [e.water,e.water2].filter(Boolean)){
      const b=bounds(region),water=this.element('g',{'clip-path':this.clip(region)},scene);
      for(let i=0;i<27;i++){
        const x=b.x+this.random()*(b.right-b.x),y=b.y+this.random()*(b.bottom-b.y),length=12+this.random()*37;
        const ray=this.element('path',{d:`M${x} ${y}q${length/2} -0.5 ${length} 0`,'stroke-width':.85+this.random()*.7,class:'water-ray'},water);this.timing(ray,3.1,6.7);
      }
    }
    for(const [x,y,r] of e.lights){const glow=this.element('circle',{cx:x,cy:y,r:r*1.9,fill:`url(#${this.id}-warm)`,class:'lamp-glow'},scene);this.timing(glow,3.5,7.6);}
    for(const [x,y] of e.glints||[]){const light=this.element('circle',{cx:x,cy:y,r:1.2,fill:'#ffe5ad',class:'city-light'},scene);this.timing(light,7,16);}
    if(quality!=='FULL')return;
    e.plants.forEach(points=>{
      const b=bounds(points),fixed=this.element('g',{'clip-path':this.clip(points)},scene);
      const plant=this.element('g',{class:'vegetation-moving'},fixed);plant.style.setProperty('--origin',`${(b.x+b.right)/2}px ${b.bottom}px`);plant.style.setProperty('--tilt',`${.5+e.wind*.6}deg`);this.timing(plant,4.1,6.8);this.texture(plant);
    });
    if(e.sky){const sky=this.element('g',{'clip-path':this.clip(e.sky)},scene),b=bounds(e.sky);
      const cg=this.element('radialGradient',{id:`${this.id}-cloud`},this.defs);this.element('stop',{offset:0,'stop-color':'#ffe5bc','stop-opacity':.7},cg);this.element('stop',{offset:1,'stop-color':'#ffe5bc','stop-opacity':0},cg);
      this.element('ellipse',{cx:(b.x+b.right)/2,cy:(b.y+b.bottom)/2,rx:115,ry:14,fill:`url(#${this.id}-cloud)`,class:'cloud'},sky);
    }
    if(e.drift&&this.weather!=='calm'){
      const [x,y,right,bottom]=e.drift,field=this.element('g',{'clip-path':this.clip(`${x},${y} ${right},${y} ${right},${bottom} ${x},${bottom}`)},scene);
      for(let i=0;i<2;i++){
        const anchor=this.element('g',{transform:`translate(${x+12+i*35} ${y+10+i*13})`},field);
        const leaf=this.element('g',{class:'drifting-leaf'},anchor);leaf.style.setProperty('--duration',`${16+i*5+e.wind*3}s`);leaf.style.setProperty('--delay',`${-i*11-6}s`);
        this.element('path',{d:e.petal?'M-3 0C-4-5 4-5 3 0Q0 5-3 0Z':'M-5 0Q0-4 6 0Q1 4-5 0Z',fill:e.petal?'#d89781':'#848657'},leaf);
      }
    }
  }
  pause(paused){this.paused=paused;this.onVisibility();}
  diagnostics(){return {environment:this.environment?.id,quality:this.root.dataset.quality,elements:this.root.querySelectorAll('*').length,animations:this.root.getAnimations({subtree:true}).length,particles:this.root.querySelectorAll('.drifting-leaf').length,paused:this.root.dataset.paused==='true'};}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.motion.removeEventListener('change',this.onMotion);this.doc.removeEventListener('visibilitychange',this.onVisibility);this.root.remove();}
}
