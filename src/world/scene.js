import {THREE,GEO,mat,mesh,mergeStatic,rng,disposeTree} from './kit.mjs';
import {character} from './characters.js';
import {bakeLevels} from './lod.js';
import {SEASONS,makeMap,CHARACTERS} from '../../shared/content.mjs';
import {peltAt} from '../../shared/physics.mjs';

export class World {
  constructor(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,180);this.camera.position.set(24,24,32);
    this.scene.add(new THREE.HemisphereLight('#edddeb','#445837',3));
    this.sun=new THREE.DirectionalLight('#ffe4bd',4);this.sun.position.set(-14,25,12);this.scene.add(this.sun);
    const rim=new THREE.DirectionalLight('#b39aff',2);rim.position.set(10,8,-15);this.scene.add(rim);
    this.actors=new Map();this.shots=new Map();this.fortMeshes=new Map();this.padMeshes=[];this.sparks=[];this.labels=[];this.hero=true;this.focus=new THREE.Vector3(-6,0,0);this.pointer=new THREE.Vector2();this.ray=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.point=new THREE.Vector3();this.quality='mid';this.fxTime=0;this.frame=0;this.dummy=new THREE.Object3D();this.frustum=new THREE.Frustum();this.viewMatrix=new THREE.Matrix4();
    this.peltPool=new THREE.InstancedMesh(GEO.lowSphere,mat('#f2a65f'),120);this.fortPool=new THREE.InstancedMesh(GEO.box,mat('#b7a477'),60);this.sparkPool=new THREE.InstancedMesh(GEO.lowSphere,mat('#f6bf7e'),150);for(const pool of [this.peltPool,this.fortPool,this.sparkPool]){pool.count=0;pool.frustumCulled=false;this.scene.add(pool);}
    this.marker=new THREE.Mesh(new THREE.RingGeometry(.45,.51,32),new THREE.MeshBasicMaterial({color:'#fff0c7',transparent:true,opacity:.8,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.marker.position.y=.045;this.scene.add(this.marker);this.marker.visible=false;
    this.selfRing=new THREE.Mesh(new THREE.RingGeometry(.7,.78,36),new THREE.MeshBasicMaterial({color:'#f9d888',transparent:true,opacity:.8,depthWrite:false}));this.zone=new THREE.Mesh(new THREE.RingGeometry(2.85,3,64),new THREE.MeshBasicMaterial({color:'#cfdf91',transparent:true,opacity:.8,depthWrite:false}));this.zone.rotation.x=-Math.PI/2;this.zone.position.y=.065;this.zone.visible=false;this.scene.add(this.zone);
    this.labelLayer=document.createElement('div');this.labelLayer.id='world-labels';document.body.append(this.labelLayer);this.nameLabels=new Map();
    this.selfRing.rotation.x=-Math.PI/2;this.selfRing.position.y=.04;this.scene.add(this.selfRing);
    this.resize=()=>{this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();};window.addEventListener('resize',this.resize);this.resize();
  }
  setMap(map,season){
    if(this.mapGroup){this.scene.remove(this.mapGroup);disposeTree(this.mapGroup);}this.mapGroup=new THREE.Group();this.scene.add(this.mapGroup);this.map=map;this.season=season;const s=SEASONS[season];this.scene.background=new THREE.Color(s.sky);this.scene.fog=new THREE.Fog(s.fog,45,110);
    const staticRoot=new THREE.Group(),random=rng(1841);this.mapGroup.add(staticRoot);
    mesh(GEO.box,season==='frost'?'#adc5cc':'#464e42',staticRoot,[0,-.36,0],[160,.4,160]);
    this.peltPool.material.color.set(s.accent);
    mesh(GEO.box,'#433b37',staticRoot,[0,-.85,0],[map.width+1,1.4,map.depth+1]);
    mesh(GEO.box,s.ground,staticRoot,[0,-.06,0],[map.width,.12,map.depth]);
    mesh(GEO.box,season==='frost'?'#b8d3da':'#b69b73',staticRoot,[0,.01,0],[map.width,.03,3]);
    mesh(GEO.box,season==='frost'?'#b8d3da':'#b69b73',staticRoot,[0,.012,0],[3,.03,map.depth]);
    for(let i=0;i<220;i++){const x=(random()-.5)*map.width,z=(random()-.5)*map.depth;if(Math.abs(x)<2||Math.abs(z)<2)continue;mesh(GEO.cone,season==='frost'?'#e4eef4':i%2?'#8a9c62':'#79854b',staticRoot,[x,.12,z],[.05,.25+random()*.2,.05],[0,random()*6,0]);}
    const pumpkin=(root,x,z,scale=1,y=0)=>{const color=season==='frost'?'#eff7f8':season==='harvest'?'#dcac43':'#e98a43';for(let l=0;l<6;l++){const a=l/6*Math.PI*2;mesh(GEO.lowSphere,color,root,[x+Math.sin(a)*.16*scale,y+.35*scale,z+Math.cos(a)*.16*scale],[.29*scale,.34*scale,.29*scale]);}mesh(GEO.lowCyl,'#59613b',root,[x,y+.74*scale,z],[.06*scale,.25*scale,.06*scale],[0,0,-.2]);};
    this.pumpkin=pumpkin;
    for(const o of map.props){
      if(o.kind==='pumpkin'){pumpkin(staticRoot,o.x,o.z,3.2);for(const side of [-1,1])mesh(GEO.cone,'#f2c467',staticRoot,[o.x+side*.58,1.36,o.z+.91],[.27,.33,.12],[0,0,Math.PI]);mesh(GEO.box,'#f2c467',staticRoot,[o.x,.85,o.z+1.12],[.7,.18,.1]);}
      else if(o.kind==='cauldron'){mesh(GEO.lowSphere,'#393345',staticRoot,[o.x,1.15,o.z],[2.6,1.3,2.6]);mesh(GEO.cyl,'#b8d772',staticRoot,[o.x,2.2,o.z],[2.1,.1,2.1]);}
      else if(o.kind==='hay'){mesh(GEO.box,'#c9a963',staticRoot,[o.x,.44,o.z],[2.3,.85,1.7]);for(const x of [-.6,.6])mesh(GEO.box,'#9b8352',staticRoot,[o.x+x,.45,o.z],[.09,.89,1.73]);}
      else if(o.kind==='stone'){mesh(GEO.lowSphere,'#99978e',staticRoot,[o.x,.65,o.z],[.75,1,.35]);mesh(GEO.box,'#777875',staticRoot,[o.x,.8,o.z+.34],[.38,.08,.05]);}
      else if(o.kind==='tree')this.tree(staticRoot,o.x,o.z,s.tree,1.1);
    }
    for(let i=0;i<30;i++){const side=i%2?-1:1;const x=(i<16?side*(map.width/2+3+random()*6):(random()-.5)*(map.width+14)),z=i<16?(random()-.5)*(map.depth+10):side*(map.depth/2+4+random()*6);this.tree(staticRoot,x,z,i%3===0?'#696a5b':s.tree,1.2+random());}
    for(let x=-map.width/2;x<=map.width/2;x+=2.5)for(const z of [-map.depth/2-.4,map.depth/2+.4]){mesh(GEO.box,'#bd9e78',staticRoot,[x,.55,z],[.14,1.1,.14]);mesh(GEO.box,'#9c8366',staticRoot,[x,.7,z],[2.6,.12,.12]);}
    for(const p of map.piles){mesh(GEO.cyl,season==='frost'?'#98bcc7':'#b9bc86',staticRoot,[p.x,.025,p.z],[1.4,.04,1.4]);for(let i=0;i<5;i++)pumpkin(staticRoot,p.x+(i%3-1)*.32,p.z+(i>2?.3:-.1),.6);}
    for(let i=0;i<22;i++){const x=(random()-.5)*map.width,z=(random()-.5)*map.depth;if(Math.abs(x)<4||Math.abs(z)<3)continue;pumpkin(staticRoot,x,z,.3+random()*.6);}
    const moon=new THREE.Mesh(GEO.sphere,new THREE.MeshBasicMaterial({color:'#f6dcac'}));moon.position.set(-18,22,-30);moon.scale.setScalar(3.4);staticRoot.add(moon);
    for(let i=0;i<70;i++){const star=new THREE.Mesh(GEO.lowSphere,new THREE.MeshBasicMaterial({color:i%2?'#f5dfb9':'#dabccf'}));star.position.set((random()-.5)*100,14+random()*32,-35-random()*20);star.scale.setScalar(.025+random()*.07);staticRoot.add(star);}
    // Warm lantern posts and a string of lights at the back of the arena.
    for(const x of [-map.width/2+2,map.width/2-2]){mesh(GEO.cyl,'#695347',staticRoot,[x,1.8,-map.depth/2+1],[.1,3.6,.1]);mesh(GEO.box,'#e8b779',staticRoot,[x,3.3,-map.depth/2+1],[.45,.6,.45]);}
    for(let i=0;i<17;i++){const x=(i/16-.5)*(map.width-4),y=3.3-Math.sin(i/16*Math.PI)*1.2;mesh(GEO.lowSphere,mat('#ffc778',{emissive:'#ffaa55',emissiveIntensity:.6}),staticRoot,[x,y,-map.depth/2+1],[.07,.1,.07]);}
    const merged=mergeStatic(staticRoot);this.mapGroup.remove(staticRoot);this.mapGroup.add(merged);
    for(const m of this.padMeshes){m.removeFromParent();m.geometry.dispose();m.material.dispose();}this.padMeshes=[];
    for(const pad of map.pads){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.35),new THREE.MeshStandardMaterial({color:'#b8d889',emissive:'#819347',emissiveIntensity:.5,roughness:.4}));m.position.set(pad.x,.8,pad.z);this.scene.add(m);this.padMeshes.push(m);}
  }
  tree(root,x,z,color,scale){mesh(GEO.lowCyl,'#695140',root,[x,1.1*scale,z],[.25*scale,2.2*scale,.25*scale]);for(let i=0;i<3;i++)mesh(GEO.lowSphere,color,root,[x+(i-1)*.65*scale,(2.5+(i===1?.4:0))*scale,z],[1.15*scale,1.2*scale,1.05*scale]);}
  clearActors(){for(const c of this.actors.values()){for(const lod of c.levels||[])lod.removeFromParent();c.rig.dispose();}this.peltPool.count=this.fortPool.count=this.sparkPool.count=0;this.actors.clear();for(const p of this.shots.values())p.removeFromParent();this.shots.clear();for(const f of this.fortMeshes.values())f.removeFromParent();this.fortMeshes.clear();}
  heroScene(id='pip',hat='pumpkin',season='halloween'){
    this.hero=true;this.clearActors();this.labelLayer.replaceChildren();this.nameLabels.clear();this.zone.visible=false;this.setMap(makeMap('patch'),season);this.addActor({slot:0,character:id,hat,x:4,z:5},true);this.addActor({slot:1,character:'dot',hat:'witch',x:9,z:2},true);this.addActor({slot:2,character:'chad',hat:'cat',x:0,z:9},true);this.marker.visible=false;this.selfRing.visible=false;
  }
  addActor(p,hero=false){const rig=character(p.character,p.hat,hero?'mid':'low');const levels=hero?[]:bakeLevels(rig,p.character+':'+p.hat);rig.root.position.set(p.x,0,p.z);rig.root.scale.setScalar(hero?3.4:1.55);this.scene.add(rig.root);for(const lod of levels){lod.visible=false;lod.scale.setScalar(1.55);this.scene.add(lod);}const a={rig,levels,character:p.character,hat:p.hat,animUntil:0,anim:'idle'};this.actors.set(p.slot,a);return a;}
  sync(state,local){this.hero=false;if(!this.map||this.map.id!==state.map.id||this.map.scale!==state.map.scale||this.season!==state.season)this.setMap(state.map,state.season);for(const p of state.players.filter(p=>!p.spectator)){let a=this.actors.get(p.slot);if(a&&(a.character!==p.character||a.hat!==p.hat)){for(const lod of a.levels)lod.removeFromParent();a.rig.dispose();this.actors.delete(p.slot);a=null;}if(!a)a=this.addActor(p);}
    for(const [id,a]of this.actors)if(!state.players.some(p=>p.slot===id&&!p.spectator)){for(const lod of a.levels)lod.removeFromParent();a.rig.dispose();this.actors.delete(id);}this.local=local;
  }
  animate(slot,state,duration=400){const a=this.actors.get(slot);if(a){a.anim=state;a.animUntil=performance.now()+duration;a.rig.play(state);}}
  fx(x,z,kind='hit'){for(let i=0;i<(this.quality==='low'?5:10);i++){if(this.sparks.length>=150)break;this.sparks.push({x,z,y:.7,size:.06+Math.random()*.08,vx:(Math.random()-.5)*5,vz:(Math.random()-.5)*5,vy:2+Math.random()*3,life:.5+Math.random()*.4});}}
  aim(clientX,clientY){this.pointer.set(clientX/innerWidth*2-1,-clientY/innerHeight*2+1);this.ray.setFromCamera(this.pointer,this.camera);this.ray.ray.intersectPlane(this.plane,this.point);return {x:this.point.x,z:this.point.z};}
  setQuality(q){this.quality=q;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='low'?1:q==='mid'?1.5:2));}
  render(dt,now,state,poses,mySlot,aim,reduced=false){
    this.frame++;const t=performance.now()/1000;
    if(this.hero){
      const phone=innerWidth<760;const target=new THREE.Vector3(phone?3:-7,0,3);this.focus.lerp(target,.06);const pos=phone?new THREE.Vector3(22,26,38):new THREE.Vector3(26,24,36);this.camera.position.lerp(pos,.035);this.camera.lookAt(this.focus);
      for(const [slot,a]of this.actors){a.rig.root.rotation.y=-.4+Math.sin(t*.2+slot)*.15;a.rig.play('idle');a.rig.update(dt,t+slot);}
    }else if(state){
      const mine=poses.get(mySlot),target=new THREE.Vector3(mine?.x||0,0,mine?.z||0);this.focus.lerp(target,1-Math.exp(-dt*5));const phone=innerWidth<760;const pos=this.focus.clone().add(new THREE.Vector3(0,phone?20:23,phone?17:20));this.camera.position.lerp(pos,1-Math.exp(-dt*6));this.camera.lookAt(this.focus);
      for(const p of state.players){const a=this.actors.get(p.slot),pose=poses.get(p.slot)||p;if(!a)continue;const r=a.rig.root;r.position.set(pose.x,0,pose.z);const delta=Math.atan2(Math.sin((pose.facing||0)-r.rotation.y),Math.cos((pose.facing||0)-r.rotation.y));r.rotation.y+=delta*Math.min(1,dt*18);a.rig.setSpeed(Math.hypot(pose.vx||0,pose.vz||0));
        const anim=p.respawnAt?'splat':state.phase==='results'?'victory':a.animUntil>performance.now()?a.anim:Math.hypot(pose.vx||0,pose.vz||0)>.3?'run':'idle';a.rig.play(anim);const dist=mine?Math.hypot(pose.x-mine.x,pose.z-mine.z):0;const full=p.slot===mySlot;const tier=full?-1:dist<9&&this.quality!=='low'?0:1;this.camera.updateMatrixWorld();this.frustum.setFromProjectionMatrix(this.viewMatrix.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse));const visible=this.frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3(pose.x,1,pose.z),2));r.visible=full&&visible;if(r.visible)a.rig.update(dt,t);a.levels.forEach((lod,i)=>{lod.visible=tier===i&&visible;if(lod.visible){lod.position.copy(r.position);lod.rotation.y=r.rotation.y;if(!reduced)lod.position.y=Math.abs(Math.sin(t*10+p.slot))*.025*Math.min(1,Math.hypot(pose.vx||0,pose.vz||0));}});
      }
      this.zone.visible=state.mode==='king'&&state.phase==='playing';if(this.zone.visible){const pad=state.map.pads[Math.floor(Math.max(0,now-state.startAt)/30000)%4];this.zone.position.set(pad.x,.065,pad.z);}
      this.selfRing.visible=!!mine;this.selfRing.position.set(mine?.x||0,.04,mine?.z||0);this.marker.visible=!!mine&&state.phase==='playing';if(aim)this.marker.position.set(aim.x,.05,aim.z);
      let count=0;for(const p of state.pelts){if(now<p.release||now>p.release+p.T*1000||count>=120)continue;const at=peltAt(p,now),size=p.charge?.34:.2;this.dummy.position.set(at.x,at.y,at.z);this.dummy.rotation.set(t*8,0,0);this.dummy.scale.set(size,size*.88,size);this.dummy.updateMatrix();this.peltPool.setMatrixAt(count++,this.dummy.matrix);}this.peltPool.count=count;this.peltPool.instanceMatrix.needsUpdate=true;
      count=0;for(const f of state.forts){if(count>=60)break;this.dummy.position.set(f.x,.43,f.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(1.8,.86,1.5);this.dummy.updateMatrix();this.fortPool.setMatrixAt(count++,this.dummy.matrix);}this.fortPool.count=count;this.fortPool.instanceMatrix.needsUpdate=true;
      for(let i=0;i<this.padMeshes.length;i++)this.padMeshes[i].visible=(state.pads[i]?.readyAt??Infinity)<=now;
    }
    this.padMeshes.forEach((m,i)=>{if(!reduced){m.rotation.y=t;m.position.y=.8+Math.sin(t*2+i)*.14;}});
    this.sparks=this.sparks.filter(s=>s.life>0);let sparkCount=0;for(const s of this.sparks){s.life-=dt;s.vy-=dt*9;s.x+=s.vx*dt;s.z+=s.vz*dt;s.y+=s.vy*dt;this.dummy.position.set(s.x,s.y,s.z);this.dummy.scale.setScalar(s.size);this.dummy.updateMatrix();this.sparkPool.setMatrixAt(sparkCount++,this.dummy.matrix);}this.sparkPool.count=sparkCount;this.sparkPool.instanceMatrix.needsUpdate=true;
    this.renderer.render(this.scene,this.camera);
    if(!this.hero&&state&&this.frame%4===0){const near=state.players.filter(p=>!p.spectator).sort((a,b)=>{const pa=poses.get(a.slot)||a,pb=poses.get(b.slot)||b;return Math.hypot(pa.x-this.focus.x,pa.z-this.focus.z)-Math.hypot(pb.x-this.focus.x,pb.z-this.focus.z);}).slice(0,8);const shown=new Set();for(const p of near){const at=poses.get(p.slot)||p,v=new THREE.Vector3(at.x,2.1,at.z).project(this.camera);if(v.z<0||v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1)continue;shown.add(p.slot);let label=this.nameLabels.get(p.slot);if(!label){label=document.createElement('div');label.className='name-tag';this.nameLabels.set(p.slot,label);this.labelLayer.append(label);}label.textContent=(p.slot===mySlot?'YOU':p.name)+(p.bot?' · BOT':'')+(p.shieldUntil>now?' ◇':'');label.style.transform=`translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;label.style.color=state.mode==='ffa'?'#fff0d4':p.team===0?'#f4c8c0':'#d0e6a5';label.hidden=false;}for(const [slot,label]of this.nameLabels)if(!shown.has(slot))label.hidden=true;}

  }
  get metrics(){return {calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};}
}
