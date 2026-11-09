import * as T from '../../vendor/three/three.module.js?v=20261005T162819119';
import {isChristmasTable} from '../../config/christmas.js?v=58-r2';
// Attach accessories to the existing animated bones, never to screen coordinates.
export function christmasCostume(pig){
  const red=new T.MeshPhysicalMaterial({color:'#9c1023',roughness:.87,sheen:1,sheenColor:new T.Color('#d34145')});
  const fur=new T.MeshStandardMaterial({color:'#fff3de',roughness:1});
  const head=new T.Group(),body=new T.Group();pig.head.add(head);pig.body.add(body);
  pig.ell(head,red,[0,.65,0],[.59,.37,.46]);
  const tip=pig.ell(head,red,[.30,.91,0],[.27,.35,.24]);tip.rotation.z=.65;
  pig.ell(head,fur,[.51,.92,.07],[.15,.16,.15]);
  for(let i=0;i<24;i++){const a=i*Math.PI/12;pig.ell(head,fur,[Math.cos(a)*.57,.49,Math.sin(a)*.43],[.10,.10,.10]);}
  for(let i=0;i<20;i++){const a=i*Math.PI/10;pig.ell(body,fur,[Math.cos(a)*.48,.70,Math.sin(a)*.35],[.10,.10,.10]);}
  for(let i=0;i<8;i++)pig.ell(body,fur,[0,.85+i*.1,.455],[.065,.075,.035]);
  pig.ell(body,pig.dark,[0,.99,0],[.60,.09,.45]);
  const buckle=new T.Mesh(new T.TorusGeometry(.10,.023,8,24),pig.gold);buckle.position.set(0,.99,.46);body.add(buckle);
  const cuffs=pig.arms.map(arm=>{const cuff=new T.Group();arm.hand.add(cuff);for(let i=0;i<10;i++){const a=i*Math.PI/5;pig.ell(cuff,fur,[Math.cos(a)*.13,.08,Math.sin(a)*.13],[.055,.055,.055]);}return cuff;});
  const clothes=pig.body.children.filter(n=>n.isMesh&&n.material===pig.green);let enabled;
  return ({mode,elapsed=0,slow=false}={})=>{
    const next=isChristmasTable(document.querySelector('#casino-stage')?.dataset.roomTheme);
    if(next&&!slow){const spring=mode==='nose'?Math.sin(elapsed*14)*Math.exp(-elapsed*2)*.09:mode==='bow'?Math.sin(elapsed*5)*.035:0;tip.rotation.z=.65+spring;head.rotation.z=spring*.25;}
    else{tip.rotation.z=.65;head.rotation.z=0;}
    if(next===enabled)return;enabled=next;head.visible=body.visible=next;cuffs.forEach(c=>c.visible=next);clothes.forEach(n=>n.material=next?red:pig.green);
  };
}
