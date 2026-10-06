import {THREE} from './kit.mjs';

// An articulated ragdoll for the supplied chibi rig (Verlet particles + distance constraints).
// Every joint is a physics point that falls, collides with the ground and slides with friction;
// "bones" between them are constraints. Each frame the rig's real joints are rotated to follow the
// simulated points, so arms, legs and the head flop independently, like a GTA-style ragdoll.
const G=20,STEP=1/120,ITER=10;
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_c=new THREE.Vector3(),_q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_m=new THREE.Matrix4(),_m2=new THREE.Matrix4();
// Particle order.
const PELVIS=0,NECK=1,HEAD=2,LS=3,LE=4,LH=5,RS=6,RE=7,RH=8,LHIP=9,LK=10,LF=11,RHIP=12,RK=13,RF=14;
const RADIUS=[.17,.16,.43,.1,.07,.08,.1,.07,.08,.1,.08,.09,.1,.08,.09];
const INV_MASS=[.6,.8,.45,1,1.2,1.4,1,1.2,1.4,1,1.2,1.3,1,1.2,1.3];

function basis(side,up,out){
  const y=_a.copy(up).normalize(),x=_b.copy(side).addScaledVector(y,-side.dot(y)).normalize(),z=_c.crossVectors(x,y);
  return out.makeBasis(x,y,z);
}

export class Ragdoll {
  constructor(rig,{dir,push=3.5,up=5,spin=8}){
    const c=rig._rig;this.rig=rig;this.c=c;
    this.nodes=[c.hips,c.neck,c.skull,c.arms[0].shoulder,c.arms[0].elbow,c.arms[0].hand,c.arms[1].shoulder,c.arms[1].elbow,c.arms[1].hand,c.legs[0].thigh,c.legs[0].knee,c.legs[0].ankle,c.legs[1].thigh,c.legs[1].knee,c.legs[1].ankle];
    rig.root.updateMatrixWorld(true);
    this.p=this.nodes.map(n=>n.getWorldPosition(new THREE.Vector3()));
    this.o=this.p.map(v=>v.clone());
    // Rest frame of the torso in root space, used to orient the root from the simulated torso.
    const inv=_m.copy(rig.root.matrixWorld).invert(),loc=i=>this.p[i].clone().applyMatrix4(inv);
    this.rest=new THREE.Matrix4();basis(loc(LS).sub(loc(RS)),loc(NECK).sub(loc(PELVIS)),this.rest);this.restInv=this.rest.clone().invert();
    // Bones: a rigid torso box, a floppy neck and two-segment limbs with fold limits.
    this.links=[];const link=(a,b,k=1,min=false)=>this.links.push({a,b,len:this.p[a].distanceTo(this.p[b]),k,min});
    const torso=[PELVIS,NECK,LS,RS,LHIP,RHIP];for(let i=0;i<torso.length;i++)for(let j=i+1;j<torso.length;j++)link(torso[i],torso[j]);
    link(NECK,HEAD,1);link(LS,HEAD,.06);link(RS,HEAD,.06);
    for(const [s,e,h] of [[LS,LE,LH],[RS,RE,RH],[LHIP,LK,LF],[RHIP,RK,RF]]){link(s,e);link(e,h);const l=this.links.at(-1);this.links.push({a:s,b:h,len:(this.p[s].distanceTo(this.p[e])+l.len)*.62,k:1,min:true});}
    for(const [a,b] of [[LH,RH],[LF,RF],[LH,PELVIS],[RH,PELVIS],[LF,HEAD],[RF,HEAD]])this.links.push({a,b,len:.22,k:1,min:true});
    // Launch: shove away from the hit plus a tumble, so the limbs trail and whip.
    const com=new THREE.Vector3();for(const v of this.p)com.add(v);com.multiplyScalar(1/this.p.length);
    const w=new THREE.Vector3(dir.z,0,-dir.x).multiplyScalar(-spin);w.y=(Math.random()-.5)*4;
    for(let i=0;i<this.p.length;i++){const r=_a.subVectors(this.p[i],com),v=_b.set(dir.x*push,up,dir.z*push).add(_c.crossVectors(w,r));v.x+=(Math.random()-.5)*.8;v.y+=(Math.random()-.5)*.8;v.z+=(Math.random()-.5)*.8;this.o[i].copy(this.p[i]).addScaledVector(v,-STEP);}
    this.acc=0;this.t=0;this.still=0;this.asleep=false;this.thump=0;this.landed=false;this.center=this.p[PELVIS];
  }
  impulse(x,y,z,strength,radius){
    this.asleep=false;this.still=0;
    for(let i=0;i<this.p.length;i++){const d=_a.set(this.p[i].x-x,this.p[i].y-y+.3,this.p[i].z-z),len=d.length();if(len>radius)continue;const k=strength*(1-len/radius)*STEP;d.normalize();this.o[i].addScaledVector(d,-k);this.o[i].y-=k*.6;}
  }
  lift(dy){for(let i=0;i<this.p.length;i++){this.p[i].y+=dy;this.o[i].y+=dy;}}
  update(dt){
    if(this.asleep)return;this.acc+=Math.min(dt,.05);
    while(this.acc>=STEP){this.acc-=STEP;this.step();}
  }
  step(){
    this.t+=STEP;const p=this.p,o=this.o,drag=this.t>2.2?.985:.998;let energy=0;
    for(let i=0;i<p.length;i++){const vx=(p[i].x-o[i].x)*drag,vy=(p[i].y-o[i].y)*drag,vz=(p[i].z-o[i].z)*drag;o[i].copy(p[i]);p[i].x+=vx;p[i].y+=vy-G*STEP*STEP;p[i].z+=vz;}
    for(let it=0;it<ITER;it++){
      for(const L of this.links){const a=p[L.a],b=p[L.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6;if(L.min&&d>=L.len)continue;
        const wa=INV_MASS[L.a],wb=INV_MASS[L.b],f=(d-L.len)/d/(wa+wb)*L.k;a.x+=dx*f*wa;a.y+=dy*f*wa;a.z+=dz*f*wa;b.x-=dx*f*wb;b.y-=dy*f*wb;b.z-=dz*f*wb;}
      for(let i=0;i<p.length;i++)if(p[i].y<RADIUS[i])p[i].y=RADIUS[i];
    }
    // Ground: bounce a little, then grip with friction so bodies slide and stop.
    for(let i=0;i<p.length;i++){if(p[i].y<=RADIUS[i]+.003){const vy=p[i].y-o[i].y;if(vy<-.04){this.thump=Math.max(this.thump,-vy/STEP);this.landed=true;}if(vy<0)o[i].y=p[i].y+vy*.25;const f=this.t>1.6?.55:.32;o[i].x+=(p[i].x-o[i].x)*f;o[i].z+=(p[i].z-o[i].z)*f;}
      energy+=(p[i].x-o[i].x)**2+(p[i].y-o[i].y)**2+(p[i].z-o[i].z)**2;}
    if(energy/(STEP*STEP)<.08*p.length)this.still+=STEP;else this.still=0;
    if(this.still>.35||this.t>4)this.asleep=true;
  }
  // Orient and place the root from the simulated torso (enough for distant, low-detail models).
  placeRoot(){
    const c=this.c,root=this.rig.root,p=this.p;
    c.body.position.set(0,0,0);c.body.rotation.set(0,0,0);c.body.scale.set(1,1,1);c.hips.rotation.set(0,0,0);c.spine.rotation.set(0,0,0);
    basis(_a.subVectors(p[LS],p[RS]).clone(),_b.subVectors(p[NECK],p[PELVIS]).clone(),_m2);_m.multiplyMatrices(_m2,this.restInv);root.quaternion.setFromRotationMatrix(_m);
    root.position.set(0,0,0);root.updateMatrixWorld(true);c.hips.getWorldPosition(_c);root.position.subVectors(p[PELVIS],_c);root.updateMatrixWorld(true);
  }
  // Rotate one joint so its child lands on the simulated point.
  aim(node,child,target){
    const parent=node.parent;node.updateWorldMatrix(true,true);const at=node.getWorldPosition(_a),now=child.getWorldPosition(_b).sub(at),want=_c.subVectors(target,at);
    if(now.lengthSq()<1e-8||want.lengthSq()<1e-8)return;parent.getWorldQuaternion(_q).invert();now.applyQuaternion(_q).normalize();want.applyQuaternion(_q).normalize();
    node.quaternion.premultiply(_q2.setFromUnitVectors(now,want));node.updateMatrixWorld(true);
  }
  pose(){
    this.placeRoot();const c=this.c,p=this.p;
    this.aim(c.head,c.skull,p[HEAD]);
    for(const [arm,e,h] of [[c.arms[0],LE,LH],[c.arms[1],RE,RH]]){this.aim(arm.shoulder,arm.elbow,p[e]);this.aim(arm.elbow,arm.hand,p[h]);}
    for(const [leg,k,f] of [[c.legs[0],LK,LF],[c.legs[1],RK,RF]]){this.aim(leg.thigh,leg.knee,p[k]);this.aim(leg.knee,leg.ankle,p[f]);}
  }
  get head(){return this.p[HEAD];}
}
