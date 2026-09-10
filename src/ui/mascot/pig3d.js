import * as T from '../../vendor/three/three.module.js?v=20260910T004553338';

// One persistent, volumetric character. Expressions never replace an image.
const V=(x,y,z)=>new T.Vector3(x,y,z);
const smooth=(a,b,t)=>a+(b-a)*t;
function surface(color,roughness=.6,extra={}){return new T.MeshPhysicalMaterial({color,roughness,...extra})}
export class Pig3D {
  constructor(){
    this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setSize(640,720);this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(30,640/720,.1,40);
    this.camera.position.set(0,3.3,8.7);this.camera.lookAt(0,1.64,.15);
    this.scene.add(new T.HemisphereLight(0xfff0df,0x234638,1.5));
    const key=new T.DirectionalLight(0xffddbd,2.4);key.position.set(-3,5,5);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=5;key.shadow.camera.bottom=-2;key.shadow.normalBias=.035;key.shadow.bias=-.0002;key.shadow.radius=4;this.scene.add(key);
    const fill=new T.DirectionalLight(0xb6d9ef,1.25);fill.position.set(3,3,2);this.scene.add(fill);
    const rim=new T.DirectionalLight(0xffcb80,3.8);rim.position.set(2,4,-3);this.scene.add(rim);
    this.root=new T.Group();this.scene.add(this.root);
    const noise=document.createElement('canvas');noise.width=noise.height=128;const g=noise.getContext('2d'),pixels=g.createImageData(128,128);let seed=37;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const n=120+(seed>>>25);pixels.data.set([n,n,n,255],i)}g.putImageData(pixels,0,0);
    const bump=new T.CanvasTexture(noise);bump.wrapS=bump.wrapT=T.RepeatWrapping;bump.repeat.set(3,3);
    this.skin=surface('#ec9e99',.48,{bumpMap:bump,bumpScale:.012,clearcoat:.13,clearcoatRoughness:.6});
    this.rose=surface('#cc7779',.6);this.inner=surface('#da8187',.62);
    this.green=surface('#123d2d',.8,{sheen:1,sheenColor:new T.Color('#629578'),sheenRoughness:.75,bumpMap:bump,bumpScale:.016});
    this.gold=surface('#cfa35c',.3,{metalness:.78});this.dark=surface('#201d23',.3);this.hoof=surface('#66504d',.37);
    this.body=new T.Group();this.root.add(this.body);
    this.ell(this.body,this.green,[0,1.17,0],[.61,.71,.45]);
    this.ell(this.body,this.skin,[0,1.78,.015],[.36,.4,.31]);
    // The neck penetrates both volumes; there is no floating head cutout.
    for(const side of [-1,1]){
      this.ell(this.body,this.skin,[side*.31,.48,.03],[.22,.33,.26]);
      this.ell(this.body,this.hoof,[side*.31,.25,.14],[.23,.16,.31]);
      this.line(this.body,[[side*.31,.30,.40],[side*.31,.23,.44]],.008,this.dark);
      const lapel=this.ell(this.body,this.green,[side*.17,1.6,.385],[.16,.31,.052]);lapel.rotation.z=side*.35;
      this.line(this.body,[[side*.04,1.78,.4],[side*.3,1.44,.422],[side*.13,1.19,.45]],.009,this.gold);
    }
    for(let i=0;i<3;i++)this.ell(this.body,this.gold,[0,1.30-i*.19,.45],[.033,.033,.016]);
    this.line(this.body,[[-.46,.93,.32],[-.29,.9,.42],[-.2,.91,.44]],.011,this.gold);
    this.bow=new T.Group();this.bow.position.set(0,1.81,.39);this.body.add(this.bow);
    for(const side of [-1,1]){const wing=this.ell(this.bow,this.dark,[side*.13,0,.035],[.16,.10,.07]);wing.rotation.z=side*-.2;}this.ell(this.bow,this.dark,[0,0,.08],[.064,.073,.056]);
    this.head=new T.Group();this.head.position.set(0,2.35,0);this.body.add(this.head);
    const face=this.ell(this.head,this.skin,[0,0,.035],[.78,.66,.59]);
    const faceVertices=face.geometry.attributes.position;
    for(let i=0;i<faceVertices.count;i++){
      const x=faceVertices.getX(i),y=faceVertices.getY(i),z=faceVertices.getZ(i);
      const cheek=Math.exp(-Math.pow((y+.32)/.35,2));
      faceVertices.setXYZ(i,x*(1+.10*cheek),y,z*(1+.12*cheek*Math.abs(x)));
    }
    face.geometry.computeVertexNormals();
    this.snout=new T.Group();this.snout.position.set(0,-.14,.61);this.head.add(this.snout);
    this.ell(this.snout,this.skin,[0,0,0],[.37,.25,.25]);this.ell(this.snout,this.rose,[0,-.005,.17],[.315,.192,.07]);
    for(const side of [-1,1])this.ell(this.snout,surface('#79454a',.75),[side*.126,.017,.223],[.049,.069,.018]);
    this.ears=[];
    for(const side of [-1,1]){
      const ear=new T.Group();ear.position.set(side*.51,.43,-.01);ear.scale.set(1.12,.72,1);ear.rotation.z=-side*.55;this.head.add(ear);this.ears.push(ear);
      const shape=new T.Shape();shape.moveTo(-.16,0);shape.bezierCurveTo(-.32,.18,-.25,.42,-.02,.61);shape.bezierCurveTo(.06,.66,.30,.27,.17,.03);shape.quadraticCurveTo(0,-.1,-.16,0);
      const geo=new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.045,bevelThickness:.04,curveSegments:24});
      const mesh=new T.Mesh(geo,this.skin);mesh.castShadow=true;ear.add(mesh);
      const insert=new T.Mesh(geo,this.inner);insert.scale.set(.63,.72,.18);insert.position.set(0,.09,.115);ear.add(insert);
    }
    this.eyes=[];
    for(const side of [-1,1]){
      const eye=new T.Group();eye.position.set(side*.31,.16,.485);eye.rotation.y=side*.15;this.head.add(eye);
      this.ell(eye,this.rose,[0,0,-.025],[.19,.22,.10]);
      this.ell(eye,surface('#fff6e5',.24),[0,0,0],[.16,.188,.108]);
      const iris=new T.Group();eye.add(iris);this.ell(iris,surface('#6b4023',.26),[0,0,.095],[.098,.12,.033]);this.ell(iris,surface('#120d0c',.11,{clearcoat:1}),[0,0,.12],[.062,.085,.021]);
      this.ell(iris,surface('#ffffff',.15,{emissive:'#fff4d8',emissiveIntensity:.15}),[-.027,.043,.14],[.021,.027,.009]);
      this.ell(iris,surface('#ffffff',.2),[.029,-.035,.14],[.009,.011,.005]);
      const lidGeo=new T.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI);const lid=new T.Mesh(lidGeo,this.skin);lid.scale.set(.166,.195,.176);eye.add(lid);
      const creaseMat=surface('#985c5c',.85);creaseMat.transparent=true;
      const crease=this.line(eye,[[-.14,0,.10],[-.075,-.025,.156],[0,-.032,.179],[.075,-.025,.156],[.14,0,.10]],.005,creaseMat);
      const brow=this.line(this.head,[[side*.15,.36,.48],[side*.3,.40,.49],[side*.47,.34,.42]],.025,this.skin);
      this.eyes.push({iris,lid,brow,crease});
    }
    this.smile=this.line(this.head,[[-.2,-.36,.5],[0,-.43,.59],[.2,-.36,.5]],.018,surface('#8c4b4b',.7));
    this.mouth=new T.Group();this.mouth.position.set(0,-.43,.55);this.head.add(this.mouth);
    this.ell(this.mouth,surface('#562a35',.8),[0,0,0],[.13,.15,.052]);this.ell(this.mouth,this.inner,[0,-.07,.04],[.085,.055,.026]);
    this.arms=[];
    for(const side of [-1,1]){
      const shoulder=V(side*.47,1.6,.04);
      const sleeve=this.ell(this.body,this.green,[side*.50,1.61,0],[.235,.235,.19]);sleeve.rotation.z=side*.3;
      const geometry=new T.TubeGeometry(new T.LineCurve3(shoulder,V(side*.65,.9,.7)),24,.145,12,false);
      const mesh=new T.Mesh(geometry,this.skin);mesh.castShadow=true;this.body.add(mesh);
      const hand=new T.Group();this.body.add(hand);this.ell(hand,this.skin,[0,0,0],[.17,.17,.18]);
      for(const digit of [-1,1])this.ell(hand,this.hoof,[digit*.068,-.035,.11],[.075,.10,.09]);
      this.arms.push({side,shoulder,mesh,hand,end:V(side*.68,.97,.8)});
    }
    this.tray=new T.Group();this.tray.position.set(0,.76,.91);this.body.add(this.tray);
    this.box(this.tray,this.gold,[0,0,0],[1.55,.10,.71],.055);
    this.box(this.tray,this.green,[0,.058,0],[1.43,.035,.59],.025);
    this.dominos=[];for(let i=0;i<3;i++){const d=this.makeDomino(true);d.position.set((i-1)*.4,.12,0);this.tray.add(d);this.dominos.push(d)}
    this.offered=this.makeDomino(false);this.body.add(this.offered);
    const ground=new T.Mesh(new T.PlaneGeometry(8,8),new T.ShadowMaterial({opacity:.25}));ground.rotation.x=-Math.PI/2;ground.position.y=.08;ground.receiveShadow=true;this.scene.add(ground);
    this.open=1;this.yawn=0;this.blinkStart=0;this.nextBlink=2;this.pack=0;
  }
  ell(parent,mat,pos,scale){const m=new T.Mesh(new T.SphereGeometry(1,40,28),mat);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  line(parent,points,r,mat){const curve=new T.CatmullRomCurve3(points.map(p=>V(...p)));const mesh=new T.Mesh(new T.TubeGeometry(curve,32,r,8,false),mat);parent.add(mesh);return mesh}
  box(parent,mat,pos,size,r){const [w,h,d]=size;const shape=new T.Shape();const x=-w/2,y=-d/2;shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+d-r);shape.quadraticCurveTo(x+w,y+d,x+w-r,y+d);shape.lineTo(x+r,y+d);shape.quadraticCurveTo(x,y+d,x,y+d-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);const geo=new T.ExtrudeGeometry(shape,{depth:h-r*2,bevelEnabled:true,bevelSegments:3,bevelSize:r,bevelThickness:r,steps:1,curveSegments:12});geo.rotateX(-Math.PI/2);const m=new T.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  makeDomino(back){const group=new T.Group();this.box(group,this.gold,[0,0,0],[.24,.075,.4],.016);this.box(group,back?this.green:surface('#f4e6c9',.3),[0,.032,0],[.215,.045,.374],.012);if(back){this.line(group,[[-.07,.085,-.12],[.07,.085,-.12],[.07,.085,.12],[-.07,.085,.12],[-.07,.085,-.12]],.004,this.gold)}else{this.line(group,[[-.085,.085,0],[.085,.085,0]],.004,this.gold);for(const [x,z] of [[-.05,-.14],[0,-.10],[.05,-.06],[-.05,.06],[.05,.06],[0,.1],[-.05,.14],[.05,.14]])this.ell(group,this.dark,[x,.086,z],[.017,.005,.017])}return group}
  render({mode,t,elapsed,dt,look,slow}){
    const follow=1-Math.exp(-dt*9),breath=slow?0:Math.sin(t*2.1)*.012;
    this.body.position.y=breath;this.head.rotation.y=smooth(this.head.rotation.y,look.x*.09,follow);
    this.head.rotation.z=smooth(this.head.rotation.z,(mode==='guard'?-.06:mode==='bow'?.035:look.x*-.045),follow);
    this.head.rotation.x=smooth(this.head.rotation.x,mode==='select'?.12:mode==='mix'?.09:look.y*.035,follow);
    if(t>this.nextBlink){this.blinkStart=t;this.nextBlink=t+3.2+Math.random()*2.6}
    const b=t-this.blinkStart,blink=!slow&&b<.24?Math.sin(Math.PI*b/.24):0;
    const yawning=mode==='idle'&&elapsed>1.2?Math.sin(Math.min(1,(elapsed-1.2)/3)*Math.PI):0;
    this.yawn=smooth(this.yawn,yawning,follow);this.open=1-Math.max(blink,this.yawn*.7);
    this.mouth.scale.set(1,Math.max(.01,this.yawn),1);this.mouth.visible=this.yawn>.025;this.smile.visible=this.yawn<.13;
    this.snout.scale.y=1+this.yawn*.08;
    this.snout.position.z=.61+(mode==='nose'?Math.sin(elapsed*17)*Math.exp(-elapsed*1.5)*.025:0);
    this.eyes.forEach(({iris,lid,brow,crease},i)=>{
      iris.position.set(look.x*.027,(mode==='select'?-.035:-look.y*.023),0);
      iris.children[2].material.emissiveIntensity=mode==='select'?1.2:.15;
      crease.material.opacity=Math.max(0,1-this.open/.45);
      const thetaMax=.66+(1-this.open)*(Math.PI-.66),position=lid.geometry.attributes.position;
      for(let row=0;row<=20;row++){const theta=row/20*thetaMax;for(let col=0;col<=32;col++){const phi=col/32*Math.PI*2;position.setXYZ(row*33+col,-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta))}}
      position.needsUpdate=true;lid.geometry.computeVertexNormals();brow.rotation.z=smooth(brow.rotation.z,mode==='guard'?(i===0?-.16:.16):0,follow);
    });
    this.ears.forEach((ear,i)=>{ear.rotation.z=(i===0?1:-1)*.55;ear.rotation.x=mode==='nose'?Math.sin(elapsed*18)*.16*Math.exp(-elapsed):Math.sin(t*1.5+i)*.02});
    this.bow.rotation.z=smooth(this.bow.rotation.z,mode==='bow'?Math.sin(elapsed*7)*.07:0,follow);
    this.pack=smooth(this.pack,mode==='pack'||mode==='exit'?1:0,follow);this.tray.position.y=.76+this.pack*.22;this.tray.position.z=.91-this.pack*.2;
    const targets=[V(-.68,.97,.8),V(.68,.97,.8)];
    if(mode==='mix'){for(let i=0;i<2;i++){const a=elapsed*2.1+i*Math.PI;targets[i].set(Math.cos(a)*.43,1.02,.91+Math.sin(a)*.14)}}
    if(mode==='offer')targets[0].set(-.46,1.26,1.14);
    if(mode==='bow'){targets[0].set(-.17,1.76,.58);targets[1].set(.17,1.76,.58)}
    if(mode==='idle'){if(elapsed<1.2)targets[1].set(.4,1+Math.sin(elapsed*17)*.035,.95);else targets[1].set(.25,1.94,.78)}
    if(mode==='guard'){targets[0].set(-.18,1.04,1.06);targets[1].set(.18,1.04,1.06)}
    if(mode==='select')targets[1].set(.85,.8,1.24);
    if(mode==='clap'){const gap=.16+(1+Math.sin(elapsed*13))*.10;targets[0].set(-gap,1.45,.78);targets[1].set(gap,1.45,.78)}
    if(mode==='pack'||mode==='exit'){targets[0].set(-.7,1,.91);targets[1].set(.7,1,.91)}
    this.arms.forEach((arm,i)=>{
      arm.end.lerp(targets[i],follow);const elbow=V(arm.side*.7,Math.min(1.3,arm.end.y-.13),.34);
      const curve=new T.CatmullRomCurve3([arm.shoulder,elbow,arm.end]);const geo=new T.TubeGeometry(curve,24,.145,12,false);arm.mesh.geometry.dispose();arm.mesh.geometry=geo;
      arm.hand.position.copy(arm.end);arm.hand.rotation.x=mode==='bow'?-.5:mode==='clap'?-.6:0;arm.hand.rotation.z=arm.side*(mode==='clap'?.9:.15);
    });
    for(let i=0;i<3;i++){const d=this.dominos[i],phase=elapsed*2.1+i*Math.PI*2/3;const x=mode==='mix'?Math.cos(phase)*.43:(i-1)*.4;const z=mode==='mix'?Math.sin(phase)*.14:0;d.position.x=smooth(d.position.x,x,follow);d.position.z=smooth(d.position.z,z,follow);d.rotation.y=smooth(d.rotation.y,mode==='mix'?Math.sin(phase)*.25:0,follow);d.visible=!(mode==='offer'&&i===0)}
    this.offered.visible=mode==='offer';this.offered.position.copy(this.arms[0].end).add(V(0,.08,.12));this.offered.rotation.set(1.0,0,-.15);
    this.renderer.render(this.scene,this.camera);return this.renderer.domElement;
  }
  dispose(){
    const geometries=new Set(),materials=new Set(),textures=new Set();
    this.scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of [object.material].flat().filter(Boolean)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value)}});
    for(const value of geometries)value.dispose();for(const value of materials)value.dispose();for(const value of textures)value.dispose();
    this.renderer.dispose();this.renderer.forceContextLoss();
  }
  hotspots(){return [this.snout,this.bow].map(object=>{const p=object.getWorldPosition(new T.Vector3()).project(this.camera);return {x:(p.x+1)/2,y:(1-p.y)/2}})}
}
