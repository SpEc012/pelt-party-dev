import {THREE,GEO,mat,mesh,mergeStatic,rng,disposeTree,canvasTexture} from './kit.mjs';
import {character} from './characters.js';
import {bakeLevels} from './lod.js';
import {buildProp,buildBackdrop,groundTexture,palette} from './props.js';
import {SEASONS,POWERS,makeMap} from '../../shared/content.mjs';
import {peltAt,makePelt,clamp,flightEnd} from '../../shared/physics.mjs';
import {cameraBasis,cameraClearance} from '../../shared/controller.mjs';

// Render-quality presets. `scale` multiplies the device pixel ratio cap.
export const QUALITY={
  low:{dpr:1,shadows:0,particles:.4,full:7,lod0:22,weather:400},
  medium:{dpr:1.25,shadows:0,particles:.7,full:11,lod0:28,weather:800},
  high:{dpr:1.5,shadows:1024,particles:1,full:15,lod0:34,weather:1300},
  ultra:{dpr:2,shadows:2048,particles:1,full:22,lod0:44,weather:1800}
};
const V=()=>new THREE.Vector3();
const _v1=V(),_v2=V(),_v3=V(),_target=V(),_look=V(),_sphere=new THREE.Sphere(),_center=new THREE.Vector2(0,0),_hit=V(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_s=V(),_m=new THREE.Matrix4(),_m2=new THREE.Matrix4(),_col=new THREE.Color();
const P0={},P1={};

function skyMaterial(top,horizon,bottom){
  return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color(top)},horizon:{value:new THREE.Color(horizon)},bottom:{value:new THREE.Color(bottom)}},
    vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 top,horizon,bottom;varying vec3 vP;void main(){float h=vP.y;vec3 c=h>0.?mix(horizon,top,pow(clamp(h*1.6,0.,1.),.7)):mix(horizon,bottom,clamp(-h*4.,0.,1.));gl_FragColor=vec4(c,1.);}'});
}
function softDot(){return canvasTexture(64,64,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.45,'rgba(255,255,255,.85)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);},{srgb:false});}
function splatTexture(){return canvasTexture(128,128,(g,w,h)=>{const r=rng(9);g.fillStyle='#fff';g.beginPath();g.arc(64,64,30,0,7);g.fill();for(let i=0;i<14;i++){const a=r()*7,d=26+r()*30,s=4+r()*11;g.beginPath();g.arc(64+Math.cos(a)*d,64+Math.sin(a)*d,s,0,7);g.fill();g.beginPath();g.moveTo(64,64);g.lineTo(64+Math.cos(a)*d,64+Math.sin(a)*d);g.lineWidth=s;g.strokeStyle='#fff';g.stroke();}},{srgb:false});}

export class World {
  constructor(canvas,settings){
    this.settings=settings;this.quality=QUALITY[settings.quality]||QUALITY.high;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:settings.quality!=='low',powerPreference:'high-performance',alpha:false,stencil:false});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,400);this.camera.position.set(0,12,30);
    this.hemi=new THREE.HemisphereLight('#ffffff','#5a6a50',1.6);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight('#fff3dd',3.2);this.sun.position.set(-18,30,14);this.scene.add(this.sun);this.scene.add(this.sun.target);
    this.fill=new THREE.DirectionalLight('#9fb6ff',.8);this.fill.position.set(14,10,-18);this.scene.add(this.fill);
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(300,32,16),skyMaterial('#6f93c4','#dfe9f5','#9fb2c2'));this.sky.frustumCulled=false;this.scene.add(this.sky);
    this.actors=new Map();this.labelLayer=document.createElement('div');this.labelLayer.id='world-labels';document.body.append(this.labelLayer);this.labels=new Map();
    this.dummy=new THREE.Object3D();this.frustum=new THREE.Frustum();this.viewProj=new THREE.Matrix4();this.ray=new THREE.Raycaster();
    this.yaw=Math.PI/2;this.pitch=.12;this.cameraReady=false;this.kick=0;this.shake=0;this.roll=0;this.zoom=0;this.mode='menu';this.orbit=0;this.timeScale=1;this.hitStop=0;
    this.sparks=[];this.decals=[];this.dot=softDot();
    // Instanced pools: one draw call each, regardless of how many pelts or particles exist.
    const pool=(geo,material,n)=>{const m=new THREE.InstancedMesh(geo,material,n);m.count=0;m.frustumCulled=false;this.scene.add(m);return m;};
    this.peltPool=pool(GEO.lowSphere,mat('#ffffff',{roughness:.5}),200);
    this.peltStem=pool(GEO.lowCyl,mat('#4f6b33'),200);
    this.gigaPool=pool(GEO.lowSphere,new THREE.MeshBasicMaterial({color:'#c79bff',transparent:true,opacity:.35,depthWrite:false}),40);
    this.trailPool=pool(GEO.lowSphere,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.45,depthWrite:false}),800);
    this.arcPool=pool(GEO.lowSphere,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.8,depthWrite:false}),40);
    this.sparkPool=pool(GEO.lowSphere,new THREE.MeshBasicMaterial({color:'#ffffff'}),900);this.sparkPool.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(900*3),3);
    const decalMat=new THREE.MeshBasicMaterial({map:splatTexture(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,color:'#ffffff'});
    this.decalPool=pool(GEO.plane,decalMat,120);this.decalPool.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(120*3),3);
    this.wallParts=[];
    this.marker=new THREE.Mesh(new THREE.RingGeometry(.42,.52,40),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.85,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.marker.visible=false;this.scene.add(this.marker);
    this.zone=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,1.6,48,1,true),new THREE.MeshBasicMaterial({color:'#7dff9b',transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false}));this.zone.visible=false;this.scene.add(this.zone);
    this.padGroup=new THREE.Group();this.scene.add(this.padGroup);this.padMeshes=[];
    this.weather=null;
    this.resize=()=>{this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();};
    addEventListener('resize',this.resize);this.applySettings(settings);this.resize();
  }
  applySettings(s){
    this.settings=s;this.quality=QUALITY[s.quality]||QUALITY.high;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.quality.dpr)*clamp(s.renderScale||1,.5,1.5));
    const sh=this.quality.shadows;this.renderer.shadowMap.enabled=!!sh&&s.shadows!==false;this.sun.castShadow=this.renderer.shadowMap.enabled;
    if(this.sun.castShadow){this.sun.shadow.mapSize.set(sh,sh);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;const c=this.sun.shadow.camera;c.left=c.bottom=-34;c.right=c.top=34;c.near=1;c.far=110;c.updateProjectionMatrix();this.sun.shadow.bias=-.0006;this.sun.shadow.normalBias=.03;}
    this.scene.traverse(n=>{if(n.material&&n.isMesh)n.material.needsUpdate=true;});
    if(this.season)this.makeWeather();this.resize();
  }
  setMap(map,season){
    if(this.mapGroup){this.scene.remove(this.mapGroup);disposeTree(this.mapGroup);this.mapGroup.traverse(n=>{if(n.material?.map&&n.userData.ownMap)n.material.map.dispose();});}
    this.map=map;this.season=season;const S=SEASONS[season],P=palette(season);this.P=P;this.mapGroup=new THREE.Group();this.scene.add(this.mapGroup);
    this.sky.material.uniforms.top.value.set(S.sky);this.sky.material.uniforms.horizon.value.set(S.horizon);this.sky.material.uniforms.bottom.value.set(S.fog);
    this.scene.fog=new THREE.Fog(S.fog,P.night?30:45,P.night?140:190);this.scene.background=new THREE.Color(S.fog);
    this.hemi.color.set(P.night?'#9d8fd8':'#ffffff');this.hemi.groundColor.set(P.night?'#3a3550':P.frost?'#b4c4d4':'#5a6a50');this.hemi.intensity=P.night?1.5:P.frost?1.25:1.6;
    this.sun.color.set(S.sun);this.sun.intensity=P.night?1.6:P.frost?2.6:3;this.fill.color.set(P.night?'#ff8a5c':'#9fb6ff');this.fill.intensity=P.night?1.1:.7;
    this.renderer.toneMappingExposure=P.night?1.35:P.frost?1.0:1.15;
    const tex=groundTexture(map,S,P);tex.anisotropy=8;
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(map.width,map.depth),new THREE.MeshStandardMaterial({map:tex,roughness:P.frost?.65:.95}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.ownMap=true;this.mapGroup.add(ground);
    const outer=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:S.ground2,roughness:1}));outer.rotation.x=-Math.PI/2;outer.position.y=-.02;outer.receiveShadow=true;this.mapGroup.add(outer);
    const props=new THREE.Group(),back=new THREE.Group();
    for(const o of map.props)buildProp(o,P,props);
    for(const p of map.piles){mesh(GEO.lowSphere,P.frost?'#ffffff':P.snow,props,[p.x,.05,p.z],[1.6,.28,1.6]);const ammo=P.frost?'#ffffff':P.night?P.pumpkin:P.fall?'#d0612f':'#f3a9c4';for(let i=0;i<7;i++){const a=i/7*Math.PI*2,r=i?0.62:0;mesh(GEO.lowSphere,ammo,props,[p.x+Math.cos(a)*r,.3+(i?0:.25),p.z+Math.sin(a)*r],[.24,.22,.24]);}
      mesh(GEO.lowCyl,mat('#ffffff',{emissive:'#ffffff',emissiveIntensity:.25,transparent:true,opacity:.35}),props,[p.x,.02,p.z],[1.9,.02,1.9]);}
    buildBackdrop(map,S,P,back);
    const merged=mergeStatic(props);merged.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});this.mapGroup.add(merged);
    const mergedBack=mergeStatic(back);mergedBack.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=true;}});this.mapGroup.add(mergedBack);
    for(const m of this.padMeshes){m.removeFromParent();}this.padMeshes=[];
    for(const pad of map.pads){const g=new THREE.Group();g.position.set(pad.x,0,pad.z);const base=new THREE.Mesh(GEO.cyl,mat('#2b3150',{roughness:.4}));base.scale.set(.95,.12,.95);base.position.y=.06;g.add(base);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.95,.06,8,32),new THREE.MeshBasicMaterial({color:'#ffffff'}));ring.rotation.x=Math.PI/2;ring.position.y=.14;g.add(ring);
      const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.36),new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:.6,roughness:.3}));gem.position.y=1;g.add(gem);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.5,.8,3,16,1,true),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=1.5;g.add(beam);
      g.userData={gem,ring,beam,kind:null};this.padGroup.add(g);this.padMeshes.push(g);}
    this.peltPool.material.color.set(P.frost?'#ffffff':P.night?'#f08a34':P.fall?'#d0612f':'#f6b6cf');this.peltStem.visible=P.night;
    this.trailPool.material.color.set(P.frost?'#e8f6ff':S.accent);this.arcPool.material.color.set(S.accent);this.marker.material.color.set(S.accent);
    this.decalColor=new THREE.Color(P.frost?'#ffffff':P.night?'#ff9a3c':P.fall?'#e0a33a':'#f6b6cf');
    this.buildWallKit(P);this.makeWeather();this.decals=[];this.decalPool.count=0;
  }
  buildWallKit(P){
    for(const m of this.wallParts){m.removeFromParent();m.dispose();}this.wallParts=[];
    const parts=P.frost?[[GEO.box,'#f4f9fc',[0,.52,0],[1.12,1.04,.6]],[GEO.lowSphere,'#ffffff',[-.28,1.08,0],[.32,.18,.3]],[GEO.lowSphere,'#ffffff',[.3,1.06,0],[.3,.16,.28]],[GEO.box,'#dbe8f0',[0,.08,.18],[1.2,.16,.4]]]
      :P.night?[[GEO.lowSphere,'#ec8a34',[-.32,.32,0],[.36,.32,.34]],[GEO.lowSphere,'#e27a2c',[.32,.32,0],[.36,.32,.34]],[GEO.lowSphere,'#f29a44',[0,.86,0],[.36,.32,.34]],[GEO.lowCyl,'#59613b',[0,1.22,0],[.05,.14,.05]],[GEO.lowCyl,'#59613b',[-.32,.66,0],[.04,.1,.04]]]
      :P.fall?[[GEO.lowSphere,'#d0612f',[0,.5,0],[.62,.55,.36]],[GEO.lowSphere,'#e0a33a',[-.3,.85,.05],[.35,.3,.3]],[GEO.lowSphere,'#b8452a',[.3,.82,-.05],[.33,.3,.3]]]
      :[[GEO.box,'#5e9a52',[0,.55,0],[1.12,1.1,.6]],[GEO.lowSphere,'#86b960',[0,1.08,0],[.58,.2,.32]],[GEO.lowSphere,'#ffd25e',[.3,1.12,.2],[.07,.07,.07]]];
    for(const [geo,color,pos,scale]of parts){const m=new THREE.InstancedMesh(geo,mat(color),120);m.count=0;m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;m.userData.local=new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion(),new THREE.Vector3(...scale));this.scene.add(m);this.wallParts.push(m);}
  }
  makeWeather(){
    if(this.weather){this.weather.removeFromParent();this.weather.geometry.dispose();this.weather.material.dispose();this.weather=null;}
    if(this.settings.weather===false||!this.season)return;const kind=SEASONS[this.season].weather,n=this.quality.weather,pos=new Float32Array(n*3),seed=new Float32Array(n);
    for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*70;pos[i*3+1]=Math.random()*28;pos[i*3+2]=(Math.random()-.5)*70;seed[i]=Math.random();}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('seed',new THREE.BufferAttribute(seed,1));
    const color=kind==='snow'?'#ffffff':kind==='embers'?'#ffab5c':kind==='leaves'?'#e0873a':'#ffc8dd';
    const m=new THREE.PointsMaterial({color,size:kind==='snow'?.16:kind==='embers'?.12:.22,map:this.dot,transparent:true,depthWrite:false,opacity:kind==='embers'?.9:.85,blending:kind==='embers'?THREE.AdditiveBlending:THREE.NormalBlending,sizeAttenuation:true});
    this.weather=new THREE.Points(g,m);this.weather.frustumCulled=false;this.weather.userData.kind=kind;this.scene.add(this.weather);
  }
  stepWeather(dt,t){
    const w=this.weather;if(!w)return;const a=w.geometry.attributes.position.array,seed=w.geometry.attributes.seed.array,k=w.userData.kind,cx=this.camera.position.x,cz=this.camera.position.z;
    const fall=k==='snow'?1.4:k==='embers'?-.6:k==='leaves'?1.8:1;
    for(let i=0,n=seed.length;i<n;i++){const s=seed[i],j=i*3;a[j]+=(Math.sin(t*.7+s*40)*.6+.4)*dt*(k==='leaves'?1.6:1);a[j+1]-=fall*(.6+s)*dt;a[j+2]+=Math.cos(t*.5+s*30)*.4*dt;
      if(a[j+1]<0)a[j+1]+=28;else if(a[j+1]>28)a[j+1]-=28;
      const dx=a[j]-cx,dz=a[j+2]-cz;if(dx>35)a[j]-=70;else if(dx<-35)a[j]+=70;if(dz>35)a[j+2]-=70;else if(dz<-35)a[j+2]+=70;}
    w.geometry.attributes.position.needsUpdate=true;
  }
  clearActors(){for(const a of this.actors.values())this.dropActor(a);this.actors.clear();for(const l of this.labels.values())l.remove();this.labels.clear();this.sparks.length=0;}
  dropActor(a){for(const lod of a.levels)lod.removeFromParent();a.rig.dispose();}
  addActor(p){
    const rig=character(p.character,p.hat,this.settings.quality==='low'?'low':'mid'),levels=bakeLevels(rig,p.character+':'+p.hat);
    rig.root.position.set(p.x,0,p.z);rig.root.scale.setScalar(1.55);this.scene.add(rig.root);
    for(const lod of levels){lod.visible=false;lod.scale.setScalar(1.55);this.scene.add(lod);}
    const a={rig,levels,character:p.character,hat:p.hat,animUntil:0,anim:'idle',facing:p.facing||0};this.actors.set(p.slot,a);return a;
  }
  sync(state,mySlot){
    if(!this.map||this.map.id!==state.map.id||this.map.scale!==state.map.scale||this.season!==state.season)this.setMap(state.map,state.season);
    this.mySlot=mySlot;
    for(const p of state.players){if(p.spectator)continue;let a=this.actors.get(p.slot);if(a&&(a.character!==p.character||a.hat!==p.hat)){this.dropActor(a);this.actors.delete(p.slot);a=null;}if(!a)this.addActor(p);}
    for(const [id,a]of this.actors)if(id!=='hero'&&!state.players.some(p=>p.slot===id&&!p.spectator)){this.dropActor(a);this.actors.delete(id);this.labels.get(id)?.remove();this.labels.delete(id);}
  }
  hero(look){
    const old=this.actors.get('hero');if(old&&old.character===look.character&&old.hat===look.hat)return;if(old){this.dropActor(old);this.actors.delete('hero');}
    if(!look)return;const a=this.addActor({slot:'hero',character:look.character,hat:look.hat,x:0,z:0});a.levels.forEach(l=>l.visible=false);
  }
  // Silly ragdoll: launched away from the thrower, a backflip or two, a bounce, then flat on the back.
  makeRag(slot,pose,from,settled=false){
    let dx=0,dz=0;if(from){dx=pose.x-from.x;dz=pose.z-from.z;}const d=Math.hypot(dx,dz);if(d>.01){dx/=d;dz/=d;}else{const f=(this.actors.get(slot)?.facing)||0;dx=-Math.sin(f);dz=-Math.cos(f);}
    const vy=4.6+Math.random()*1.6;return {t0:settled?performance.now()-5000:performance.now(),dx,dz,vy,air:2*vy/18,flips:Math.random()<.35?2:1,side:Math.random()<.5?-1:1,face:Math.atan2(-dx,-dz),push:2+Math.random()*1.2,landed:settled};
  }
  // Lowest world-space height of an object's opaque geometry, from a cached sample of its vertices.
  lowest(obj){
    obj.updateMatrixWorld(true);let list=obj.userData.groundSamples;
    if(!list){list=[];obj.traverse(n=>{if(!n.isMesh||n.material?.transparent)return;const pos=n.geometry?.attributes?.position;if(!pos?.count)return;const step=Math.max(1,Math.floor(pos.count/120)),pts=[];for(let i=0;i<pos.count;i+=step)pts.push(pos.getX(i),pos.getY(i),pos.getZ(i));list.push({mesh:n,pts:new Float32Array(pts)});});obj.userData.groundSamples=list;}
    let low=Infinity;
    for(const {mesh,pts}of list){let v=mesh,shown=true;while(v&&v!==obj.parent){if(!v.visible&&v!==obj){shown=false;break;}v=v.parent;}if(!shown)continue;
      const e=mesh.matrixWorld.elements;for(let i=0;i<pts.length;i+=3){const y=e[1]*pts[i]+e[5]*pts[i+1]+e[9]*pts[i+2]+e[13];if(y<low)low=y;}}
    return low===Infinity?0:low;
  }
  ragdoll(slot,pose,from){const a=this.actors.get(slot);if(a)a.rag=this.makeRag(slot,pose,from);}
  ragPose(rag,t,out){
    // Resting: tilted so the big head and the heels both touch the ground.
    const REST=-1.24,g=18,k=1-Math.exp(-3.2*t);out.x=rag.dx*rag.push*k;out.z=rag.dz*rag.push*k;
    if(t<rag.air){const u=t/rag.air;out.y=Math.max(0,rag.vy*t-g*t*t/2)+.02*u;out.rx=REST*u-Math.PI*2*rag.flips*(u*u*(3-2*u));out.rz=Math.sin(u*Math.PI)*.7*rag.side;return out;}
    const t2=t-rag.air,vb=rag.vy*.3,tb=2*vb/g;out.y=.02+(t2<tb?vb*t2-g*t2*t2/2:0);out.rx=REST+(t2<tb?Math.sin(t2/tb*Math.PI)*.25:0);out.rz=t2<tb?Math.sin(t2/tb*Math.PI)*.2*rag.side:0;return out;
  }
  animate(slot,anim,duration=400){const a=this.actors.get(slot);if(a){a.anim=anim;a.animUntil=performance.now()+duration;a.rig.play(anim);}}
  // Particles: count scales with the quality preset.
  burst(x,y,z,n,{color='#ffffff',speed=4,up=3,size=.08,life=.6,gravity=12,spread=1}={}){
    n=Math.round(n*this.quality.particles);_col.set(color);
    for(let i=0;i<n;i++){if(this.sparks.length>=900)this.sparks.shift();const a=Math.random()*Math.PI*2,s=speed*(.3+Math.random()*.7);this.sparks.push({x,y,z,vx:Math.cos(a)*s*spread,vz:Math.sin(a)*s*spread,vy:up*(.4+Math.random()),size:size*(.6+Math.random()*.8),life:life*(.6+Math.random()*.6),max:life,g:gravity,r:_col.r,gC:_col.g,b:_col.b});}
  }
  decal(x,z,size=1){if(this.decals.length>=120)this.decals.shift();this.decals.push({x,z,size:size*(.8+Math.random()*.5),rot:Math.random()*6.28,born:performance.now()});}
  fx(m){
    const P=this.P||{},ammo=P.frost?'#ffffff':P.night?'#ff9a3c':P.fall?'#e0873a':'#f6b6cf',y=m.y??.6;
    if(m.kind==='impact'||m.kind==='thud'){this.burst(m.x,Math.max(.1,y),m.z,14,{color:ammo,speed:4,up:3.5,size:.07});if(y<.4)this.decal(m.x,m.z,.9);}
    if(m.kind==='burst'){this.burst(m.x,Math.max(.1,y),m.z,46,{color:ammo,speed:m.giga?11:8,up:6,size:.11,life:.8});this.burst(m.x,.2,m.z,16,{color:'#ffffff',speed:6,up:1,size:.18,life:.5,gravity:2});this.decal(m.x,m.z,m.giga?3.4:2.2);}
    if(m.kind==='hit'){this.burst(m.x,1.1,m.z,22,{color:ammo,speed:5,up:4,size:.09});}
    if(m.kind==='splat'){this.burst(m.x,1,m.z,60,{color:ammo,speed:9,up:7,size:.12,life:1});this.burst(m.x,1.2,m.z,24,{color:'#ffe680',speed:6,up:6,size:.06,life:.9,gravity:6});this.decal(m.x,m.z,2.4);}
    if(m.kind==='break'){this.burst(m.x,.8,m.z,40,{color:P.frost?'#ffffff':P.night?'#ec8a34':'#d0612f',speed:6,up:5,size:.14,life:.8});}
    if(m.kind==='build'){this.burst(m.x,.3,m.z,30,{color:P.frost?'#ffffff':'#c9b98f',speed:5,up:3,size:.12,life:.6});}
    if(m.kind==='dive'||m.kind==='slide'){this.burst(m.x,.15,m.z,14,{color:P.frost?'#ffffff':'#c9b98f',speed:3,up:1.5,size:.09,life:.5,gravity:6});}
    if(m.kind==='power'){this.burst(m.x,1,m.z,36,{color:POWERS[m.power]?.color||'#ffffff',speed:4,up:6,size:.08,life:.9,gravity:3});}
    if(m.kind==='block'){this.burst(m.x,1.1,m.z,18,{color:'#8fe3ff',speed:5,up:3,size:.07});}
    if(m.kind==='spawn'){this.burst(m.x,.4,m.z,30,{color:'#ffffff',speed:2,up:7,size:.07,life:.9,gravity:2});}
    if(m.kind==='dodge'){this.burst(m.x,1,m.z,12,{color:'#ffffff',speed:4,up:1,size:.06,life:.4,gravity:0});}
  }
  resetCombat(p){this.yaw=Math.atan2(-p.x,-p.z);this.pitch=.1;this.cameraReady=false;this.kick=this.shake=0;}
  look(dx,dy){this.yaw=Math.atan2(Math.sin(this.yaw-dx),Math.cos(this.yaw-dx));this.pitch=clamp(this.pitch+dy,-.35,.75);}
  impulse(power=.1){this.kick=Math.min(.3,this.kick+power);}
  hurt(power=.25){this.shake=Math.max(this.shake,power);}
  freeze(ms){this.hitStop=Math.max(this.hitStop,ms);}
  // Aim from the screen centre: enemies first, then cover, then the ground.
  aimAt(local,players,poses,charged,mySlot,teamMode,myTeam){
    const limit=charged?32:24;this.camera.updateMatrixWorld();this.ray.setFromCamera(_center,this.camera);const ray=this.ray.ray;let best=null,near=Infinity;this.aimLocked=false;
    for(const p of players){if(p.slot===mySlot||p.spectator||p.respawnAt||teamMode&&p.team===myTeam)continue;const at=poses.get(p.slot)||p;if(Math.hypot(at.x-local.x,at.z-local.z)>limit+1)continue;
      _sphere.center.set(at.x,p.crouch?.7:1.05,at.z);_sphere.radius=.75;if(ray.intersectSphere(_sphere,_hit)){const d=_hit.distanceToSquared(this.camera.position);if(d<near){near=d;best={x:at.x,z:at.z,y:p.crouch?.6:1,slot:p.slot};}}}
    if(best){this.aimLocked=true;return best;}
    // Ground hit, else a point at full range in the look direction.
    let x,z,y=0;
    if(ray.direction.y<-.01){const t=-ray.origin.y/ray.direction.y;x=ray.origin.x+ray.direction.x*t;z=ray.origin.z+ray.direction.z*t;}
    else{const b=cameraBasis(this.yaw);x=local.x+b.fx*limit;z=local.z+b.fz*limit;y=clamp(1.2+ray.direction.y*limit*.8,0,1.8);}
    const d=Math.hypot(x-local.x,z-local.z);if(d>limit){x=local.x+(x-local.x)/d*limit;z=local.z+(z-local.z)/d*limit;y=Math.max(y,.6);}
    return {x,z,y};
  }
  combatCamera(dt,me,state,ctx){
    const b=cameraBasis(this.yaw),phone=innerWidth<760,crouch=me.crouch&&!ctx.sliding;
    _target.set(me.x,crouch?.95:1.4,me.z);
    this.zoom+=((ctx.aiming?1:0)-this.zoom)*(1-Math.exp(-dt*14));
    const distance=(phone?4.4:4.7)-1.6*this.zoom-(ctx.charge>0?.5:0),shoulder=(phone?.5:.78)+.12*this.zoom;
    const want={x:_target.x-b.fx*distance*Math.cos(this.pitch)+b.rx*shoulder,y:_target.y+.75+Math.sin(this.pitch)*distance,z:_target.z-b.fz*distance*Math.cos(this.pitch)+b.rz*shoulder};
    const clipped=cameraClearance(_target,want,[state.map.props,state.forts]);
    _v1.set(clipped.x,Math.max(.35,clipped.y),clipped.z);
    if(!this.cameraReady){this.camera.position.copy(_v1);this.cameraReady=true;}
    this.camera.position.lerp(_v1,1-Math.exp(-dt*(ctx.diving?14:22)));
    _look.set(_target.x+b.fx*14+b.rx*shoulder,_target.y+.35-this.pitch*14,_target.z+b.fz*14+b.rz*shoulder);
    this.kick*=Math.exp(-dt*12);this.shake*=Math.exp(-dt*9);
    const fx=this.settings.shake!==false&&!ctx.reduced;
    if(fx){_look.y+=this.kick*3;const t=performance.now();this.camera.position.x+=Math.sin(t*.09)*this.shake*.35;this.camera.position.y+=Math.cos(t*.075)*this.shake*.25;}
    this.camera.lookAt(_look);
    const rollWant=fx?(ctx.diving?ctx.diveSide*.12:ctx.sliding?.06:0):0;this.roll+=(rollWant-this.roll)*(1-Math.exp(-dt*10));this.camera.rotateZ(this.roll);
    const fov=(this.settings.fov||72)+(ctx.diving?12:ctx.sliding?9:ctx.sprinting?6:0)-14*this.zoom-(ctx.charge>0?4:0);
    if(Math.abs(this.camera.fov-fov)>.05){this.camera.fov+=(fov-this.camera.fov)*(1-Math.exp(-dt*9));this.camera.updateProjectionMatrix();}
  }
  // While splatted: pull up and slowly circle your own ragdoll.
  deathCamera(dt,pos,face,state){
    // Look from the ragdoll's side, framed low on screen so the death card sits above it.
    this.deathYaw??=face+Math.PI*.5;this.deathYaw+=dt*.28;const b=cameraBasis(this.deathYaw),cx=pos.x-Math.sin(face)*.55,cz=pos.z-Math.cos(face)*.55;
    _target.set(cx,1.25,cz);const c=cameraClearance(_target,{x:cx-b.fx*5.6,y:3.4,z:cz-b.fz*5.6},[state.map.props,state.forts]);_v1.set(clamp(c.x,-state.map.width/2+.4,state.map.width/2-.4),Math.max(1,c.y),clamp(c.z,-state.map.depth/2+.4,state.map.depth/2-.4));this.camera.position.lerp(_v1,1-Math.exp(-dt*3.5));this.camera.lookAt(_target);
    if(Math.abs(this.camera.fov-58)>.05){this.camera.fov+=(58-this.camera.fov)*(1-Math.exp(-dt*5));this.camera.updateProjectionMatrix();}
    this.cameraReady=false;
  }
  menuCamera(dt,state,poses){
    // Cinematic drift around the live demo match behind the menu.
    this.orbit+=dt*.06;const map=state?.map||this.map;if(!map)return;
    let cx=0,cz=0,n=0;if(state)for(const p of state.players){const at=poses.get(p.slot)||p;if(p.respawnAt)continue;cx+=at.x;cz+=at.z;n++;}if(n){cx/=n;cz/=n;}
    this.menuFocus??=new THREE.Vector3();this.menuFocus.lerp(_v2.set(cx*.6,1.2,cz*.6),1-Math.exp(-dt*.6));
    const R=Math.min(map.width,map.depth)*.62;_v1.set(this.menuFocus.x+Math.sin(this.orbit)*R,8.5+Math.sin(this.orbit*.7)*2,this.menuFocus.z+Math.cos(this.orbit)*R);
    if(!this.cameraReady){this.camera.position.copy(_v1);this.cameraReady=true;}this.camera.position.lerp(_v1,1-Math.exp(-dt*2));this.camera.lookAt(this.menuFocus);
    if(Math.abs(this.camera.fov-55)>.05){this.camera.fov=55;this.camera.updateProjectionMatrix();}
  }
  heroCamera(dt){
    const a=this.actors.get('hero');if(!a||!this.map)return;const z=-this.map.depth/2+2.2;a.rig.root.position.set(0,0,z);a.rig.root.rotation.y+=(Math.sin(performance.now()/2400)*.5-a.rig.root.rotation.y)*.05;
    _v1.set(innerWidth<760?0:-.75,1.15,z+4.4);this.camera.position.lerp(_v1,1-Math.exp(-dt*6));_look.set(innerWidth<760?0:-.75,.95,z);this.camera.lookAt(_look);if(Math.abs(this.camera.fov-38)>.05){this.camera.fov=38;this.camera.updateProjectionMatrix();}
  }
  render(dt,now,ctx){
    const {state,poses,mySlot,aim,reduced}=ctx,t=performance.now()/1000;
    if(this.hitStop>0){this.hitStop-=dt*1000;dt*=.12;}
    const me=poses.get(mySlot);
    if(this.mode==='play'&&me&&state&&ctx.dead){const a=this.actors.get(mySlot);this.deathCamera(dt,a?.rig.root.position||me,a?.rag?.face??this.yaw,state);}
    else if(this.mode==='play'&&me&&state){this.deathYaw=null;this.combatCamera(dt,me,state,ctx);}
    else if(this.mode==='hero')this.heroCamera(dt);
    else this.menuCamera(dt,state,poses);
    this.camera.updateMatrixWorld();this.viewProj.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.viewProj);
    if(this.sun.castShadow){const f=me||this.menuFocus||_v3.set(0,0,0);this.sun.position.set(f.x-18,30,f.z+14);this.sun.target.position.set(f.x,0,f.z);this.sun.target.updateMatrixWorld();}
    const hero=this.actors.get('hero');if(hero){hero.rig.root.visible=this.mode==='hero';if(hero.rig.root.visible){hero.rig.play('idle');hero.rig.update(dt,t);}}
    if(state){
      const camX=this.camera.position.x,camZ=this.camera.position.z,q=this.quality,full=q.full,lod0=q.lod0;
      for(const p of state.players){const a=this.actors.get(p.slot);if(!a)continue;const pose=poses.get(p.slot)||p,r=a.rig.root;
        const speed=Math.hypot(pose.vx||0,pose.vz||0),flags=pose.flags??0;
        const dead=!!(p.respawnAt||flags&2);let lift=0,rx=0,rz=0,ox=0,oz=0;
        if(dead){const rag=a.rag??=this.makeRag(p.slot,pose,null,true);const t2=(performance.now()-rag.t0)/1000;this.ragPose(rag,t2,P1);lift=P1.y;rx=P1.rx;rz=P1.rz;ox=P1.x;oz=P1.z;a.facing=rag.face;
          if(!rag.landed&&t2>rag.air){rag.landed=true;this.burst(pose.x+ox,.2,pose.z+oz,18,{color:this.P?.frost?'#ffffff':'#c9b98f',speed:4,up:2,size:.1,life:.5});this.onLand?.(pose.x+ox,pose.z+oz);}
          if(rag.landed&&!reduced&&performance.now()>(rag.nextStar||0)){rag.nextStar=performance.now()+260;const a2=t2*5;this.burst(pose.x+ox-Math.sin(rag.face)*1.1+Math.cos(a2)*.35,.75,pose.z+oz-Math.cos(rag.face)*1.1+Math.sin(a2)*.35,1,{color:'#ffe680',speed:.3,up:.4,size:.09,life:.6,gravity:0});}}
        else if(a.rag)a.rag=null;
        r.position.set(pose.x+ox,lift,pose.z+oz);
        if(!dead){const face=(flags&1||flags&8)&&speed>1?Math.atan2(pose.vx,pose.vz):pose.facing||0;const delta=Math.atan2(Math.sin(face-a.facing),Math.cos(face-a.facing));a.facing+=delta*Math.min(1,dt*20);}
        r.rotation.set(rx,a.facing,rz,'YXZ');
        const dist=Math.hypot(pose.x-camX,pose.z-camZ);_sphere.center.set(pose.x,1,pose.z);_sphere.radius=1.6;const visible=this.frustum.intersectsSphere(_sphere);
        const tier=p.slot===mySlot||dist<full?-1:dist<lod0?0:1;
        let anim='idle';
        if(p.respawnAt||flags&2)anim='splat';else if(state.phase==='results')anim=ctx.winners?.has(p.slot)?'victory':'taunt';else if(flags&1)anim='dive';else if(flags&8)anim='slide';else if(a.animUntil>performance.now())anim=a.anim;else if(flags&16)anim='scoop';else if(speed>.4)anim=speed>3.2?'run':'walk';else if(flags&4||pose.crouch)anim='crouch';
        if(a.rig.state!==anim)a.rig.play(anim);a.rig.setSpeed(speed/1.55);
        r.visible=tier===-1&&visible;if(r.visible)a.rig.update(dt,t+(typeof p.slot==='number'?p.slot:0));
        // Dives, slides and ragdolls rotate the whole body: measure the real geometry and keep it on the ground.
        const tumbling=dead||flags&1||flags&8;
        const shadow=a.rig._rig?.shadow;if(shadow)shadow.visible=!tumbling;
        if(r.visible&&tumbling){const low=this.lowest(r);r.position.y+=dead&&a.rag?.landed?-low:Math.max(0,-low);}
        for(let i=0;i<a.levels.length;i++){const lod=a.levels[i];lod.visible=tier===i&&visible;if(lod.visible){lod.position.copy(r.position);if(dead)lod.rotation.copy(r.rotation);else{lod.rotation.set(flags&1?1.2:flags&8?-.9:0,r.rotation.y,0,'YXZ');lod.position.y=tumbling?0:reduced?0:Math.abs(Math.sin(t*11+p.slot))*.04*Math.min(1,speed/4);}lod.userData.blob??=lod.children.find(c=>c.material?.transparent&&c.material.depthWrite===false)||null;if(lod.userData.blob)lod.userData.blob.visible=!tumbling;if(tumbling){const low=this.lowest(lod);lod.position.y+=dead&&a.rag?.landed?-low:Math.max(0,-low);}}}
      }
      // Pelts, their trails and the charge arc.
      let n=0,s=0,tr=0,gg=0;const night=this.P?.night;
      for(const p of state.pelts){if(now<p.release||now>flightEnd(p)||n>=200)continue;peltAt(p,now,P0);const size=p.giga?.48:p.charge?.32:.2;
        this.dummy.position.set(P0.x,P0.y,P0.z);this.dummy.rotation.set(t*9,t*4,0);this.dummy.scale.set(size,size*.9,size);this.dummy.updateMatrix();this.peltPool.setMatrixAt(n++,this.dummy.matrix);
        if(night){this.dummy.position.y+=size*.85;this.dummy.scale.set(size*.18,size*.5,size*.18);this.dummy.updateMatrix();this.peltStem.setMatrixAt(s++,this.dummy.matrix);}
        if(p.giga&&gg<40){this.dummy.position.set(P0.x,P0.y,P0.z);this.dummy.scale.setScalar(size*1.9);this.dummy.updateMatrix();this.gigaPool.setMatrixAt(gg++,this.dummy.matrix);}
        for(let k=1;k<=4&&tr<800;k++){const at=now-k*(p.charge?14:18);if(at<p.release)break;peltAt(p,at,P1);const sz=size*(1-k*.19)*.75;this.dummy.position.set(P1.x,P1.y,P1.z);this.dummy.scale.setScalar(sz);this.dummy.updateMatrix();this.trailPool.setMatrixAt(tr++,this.dummy.matrix);}}
      this.peltPool.count=n;this.peltStem.count=s;this.trailPool.count=tr;this.gigaPool.count=gg;for(const m of [this.peltPool,this.peltStem,this.trailPool,this.gigaPool])m.instanceMatrix.needsUpdate=true;
      this.arcPool.count=0;this.marker.visible=false;
      if(this.mode==='play'&&me&&aim&&state.phase==='playing'&&(ctx.charge>0||ctx.aiming)&&!me.respawnAt){const arc=makePelt('arc',mySlot,me,aim,ctx.charge>=1,now),end=arc.release+arc.TE*1000;
        for(let i=0;i<32;i++){peltAt(arc,arc.release+(end-arc.release)*i/31,P0);this.dummy.position.set(P0.x,P0.y,P0.z);this.dummy.scale.setScalar(i%4===0?.05:.028);this.dummy.updateMatrix();this.arcPool.setMatrixAt(i,this.dummy.matrix);}
        this.arcPool.count=32;this.arcPool.instanceMatrix.needsUpdate=true;peltAt(arc,end,P0);this.marker.visible=true;this.marker.position.set(P0.x,.05,P0.z);this.marker.scale.setScalar(ctx.charge>=1?(state.players.find(p=>p.slot===mySlot)?.giga?9:6):1.2);}
      // Player-built walls rise out of the ground and shrink as they take hits.
      const clock=Date.now();let w=0;
      for(const f of state.forts){if(w>=120)break;const rise=clamp((clock-(f.born||0))/160,0,1),hp=clamp((f.hp||3)/3,0,1);this.dummy.position.set(f.x,0,f.z);this.dummy.rotation.set(0,f.rot||0,0);this.dummy.scale.set(1,(rise<1?rise*rise*(3-2*rise):1)*(.55+.45*hp),1);this.dummy.updateMatrix();
        for(const part of this.wallParts){_m.multiplyMatrices(this.dummy.matrix,part.userData.local);part.setMatrixAt(w,_m);}w++;}
      for(const part of this.wallParts){part.count=w;part.instanceMatrix.needsUpdate=true;}
      // Pads show which power-up is waiting.
      for(let i=0;i<this.padMeshes.length;i++){const g=this.padMeshes[i],pad=state.pads[i],u=g.userData;if(!pad){g.visible=false;continue;}g.visible=true;const ready=pad.readyAt<=now;u.gem.visible=u.beam.visible=ready;
        if(u.kind!==pad.kind){u.kind=pad.kind;const c=POWERS[pad.kind]?.color||'#ffffff';u.gem.material.color.set(c);u.gem.material.emissive.set(c);u.beam.material.color.set(c);u.ring.material.color.set(c);}
        if(ready&&!reduced){u.gem.rotation.y=t*2;u.gem.position.y=1+Math.sin(t*3+i)*.15;}u.ring.material.opacity=ready?1:.3;}
      this.zone.visible=state.mode==='king'&&state.phase==='playing';if(this.zone.visible){const pad=state.map.pads[Math.floor(Math.max(0,now-state.startAt)/30000)%state.map.pads.length];this.zone.position.set(pad.x,.8,pad.z);this.zone.material.opacity=.18+Math.sin(t*4)*.06;}
    }
    // Particles and decals.
    let sc=0;for(let i=this.sparks.length-1;i>=0;i--){const p=this.sparks[i];p.life-=dt;if(p.life<=0){this.sparks.splice(i,1);continue;}p.vy-=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.03){p.y=.03;p.vy*=-.3;p.vx*=.6;p.vz*=.6;}
      const k=Math.min(1,p.life/p.max*2);this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(p.size*k);this.dummy.updateMatrix();this.sparkPool.setMatrixAt(sc,this.dummy.matrix);_col.setRGB(p.r,p.gC,p.b);this.sparkPool.setColorAt(sc,_col);sc++;}
    this.sparkPool.count=sc;this.sparkPool.instanceMatrix.needsUpdate=true;if(this.sparkPool.instanceColor)this.sparkPool.instanceColor.needsUpdate=true;
    const pn=performance.now();let dc=0;for(const d of this.decals){const age=(pn-d.born)/1000;if(age>9)continue;const k=age<.12?age/.12:age>7?1-(age-7)/2:1;this.dummy.position.set(d.x,.025+dc*.0004,d.z);this.dummy.rotation.set(-Math.PI/2,0,d.rot);this.dummy.scale.set(d.size*k,d.size*k,1);this.dummy.updateMatrix();this.decalPool.setMatrixAt(dc,this.dummy.matrix);this.decalPool.setColorAt(dc,this.decalColor||_col.set('#ffffff'));dc++;}
    this.decalPool.count=dc;this.decalPool.instanceMatrix.needsUpdate=true;if(this.decalPool.instanceColor)this.decalPool.instanceColor.needsUpdate=true;
    if(!reduced)this.stepWeather(dt,t);
    this.renderer.render(this.scene,this.camera);
    if(state)this.updateLabels(state,poses,mySlot,ctx);
  }
  // Name tags: projected every frame (transform only) for the closest visible players.
  updateLabels(state,poses,mySlot,ctx){
    const shown=this.shown??=new Set();shown.clear();if(this.mode==='play'&&state.phase!=='lobby'){
      const camX=this.camera.position.x,camZ=this.camera.position.z,W=innerWidth,H=innerHeight,me=state.players.find(p=>p.slot===mySlot);let count=0;
      for(const p of state.players){if(p.slot===mySlot||p.spectator||p.respawnAt||count>=12)continue;const at=poses.get(p.slot)||p;if(Math.hypot(at.x-camX,at.z-camZ)>38)continue;
        _v1.set(at.x,(at.flags&1||at.flags&8)?1.3:2.25,at.z).project(this.camera);if(_v1.z<-1||_v1.z>1||Math.abs(_v1.x)>1.05||Math.abs(_v1.y)>1.05)continue;count++;shown.add(p.slot);
        let label=this.labels.get(p.slot);if(!label){label=document.createElement('div');label.className='name-tag';label.innerHTML='<b></b><i></i>';this.labels.set(p.slot,label);this.labelLayer.append(label);label._text='';}
        const ally=state.mode!=='ffa'&&p.team===me?.team,text=`${p.name}${p.bot?' ·bot':''}`,hp=`${p.hp}`;
        if(label._text!==text){label._text=text;label.firstChild.textContent=text;}if(label._hp!==hp){label._hp=hp;label.lastChild.style.width=`${clamp(p.hp/3,0,1)*100}%`;}
        const cls=`name-tag ${ally?'ally':state.mode!=='ffa'?'enemy':''} ${p.shieldUntil>state.now?'shield':''} ${ctx.target===p.slot?'targeted':''}`;if(label._cls!==cls){label._cls=cls;label.className=cls;}
        label.style.transform=`translate3d(${((_v1.x*.5+.5)*W)|0}px,${((-_v1.y*.5+.5)*H)|0}px,0) translate(-50%,-100%)`;if(label.hidden)label.hidden=false;}
    }
    for(const [slot,label]of this.labels)if(!shown.has(slot)&&!label.hidden)label.hidden=true;
  }
  get metrics(){return {calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};}
}
