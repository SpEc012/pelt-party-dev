import {THREE,GEO,mesh} from './kit.mjs';
import {createChibi} from './chars/chibi.mjs';
import {STATES} from './chars/chibi-anim.mjs';
import {EYE,MOUTH} from './chars/face.mjs';

// Extend the supplied pose table; keep the original model proportions and rig.
// Whole-body rotations turn around the feet, then the body is lifted just enough that the
// big head, chest and hips never dip below the ground (rig units: head centre .87 above the soles, radius .29).
const HEAD_Y=.87,HEAD_R=.29,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const lay=(p,rx,hop=0)=>{const c=Math.cos(rx);p.bodyRx=wrap(rx);p.bodyY=Math.max(0,HEAD_R-HEAD_Y*c,.1-.28*c,.15-.45*c)+hop;p.bodyZ=0;p.ground=0;};
const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
STATES.crouch=(p,t)=>{STATES.idle(p,t);p.lLeg=p.rLeg=.85;p.lKnee=p.rKnee=1.45;p.spineRx=.3;p.hipY=-.12;p.lFwd=p.rFwd=.5;p.lElbow=p.rElbow=1.1;p.eyes=EYE.SQUINT;};
STATES.throw=(p,t)=>{STATES.idle(p,t);const u=Math.min(1,t/.3),wind=u<.3?u/.3:1,whip=u<.3?0:sm((u-.3)/.35);
  p.rFwd=-1.5*wind*(1-whip)+2.1*whip*(1-sm((u-.7)/.3)*.6);p.rElbow=1.6*(1-whip)+.2;p.rOut=.5;p.lFwd=.9*wind;p.spineRy=-.45*wind+.7*whip;p.spineRx=.1+.25*whip;p.hipRy=-.2*wind+.25*whip;p.eyes=EYE.SQUINT;p.mouth=MOUTH.GRIN;p.browTilt=.4;};
STATES.charge=(p,t)=>{STATES.idle(p,t);const w=Math.sin(t*16)*.04;p.rFwd=-1.7+w;p.rElbow=1.9;p.rOut=.65;p.lFwd=1.35;p.lOut=.2;p.lElbow=.15;p.spineRy=-.5;p.spineRx=-.05;p.hipY=-.05;p.lLeg=.35;p.rLeg=-.25;p.lKnee=.4;p.rKnee=.3;p.mouth=MOUTH.FLAT;p.eyes=EYE.SQUINT;p.browTilt=.6;};
STATES.dive=(p,t)=>{STATES.idle(p,t);const u=Math.min(1,t/.38);
  // Launch head-first, then tuck into one forward roll and come up on the feet.
  if(u<.4){const k=sm(u/.4);lay(p,1.3*k,.22*Math.sin(u/.4*Math.PI));p.lFwd=p.rFwd=2.9*k;p.lElbow=p.rElbow=.1;p.lLeg=p.rLeg=-.45*k;p.lKnee=p.rKnee=.3;p.headRx=-.5*k;p.mouth=MOUTH.OPEN;p.eyes=EYE.WIDE;}
  else{const k=sm((u-.4)/.6);lay(p,1.3+(Math.PI*2-1.3)*k);p.lFwd=p.rFwd=2.9*(1-k)+.6*k;p.lElbow=p.rElbow=1.6*Math.sin(k*Math.PI);p.lLeg=p.rLeg=1.3*Math.sin(k*Math.PI);p.lKnee=p.rKnee=2.1*Math.sin(k*Math.PI);p.headRx=.5*Math.sin(k*Math.PI);p.mouth=MOUTH.GRIN;p.eyes=EYE.HAPPY;if(k>.92)p.ground=(k-.92)/.08;}};
STATES.slide=(p,t)=>{STATES.idle(p,t);const k=sm(Math.min(1,t/.12));lay(p,-1.05*k);p.lLeg=1.55*k;p.rLeg=1.2*k;p.lKnee=.1;p.rKnee=1.1*k;p.lFwd=-.4;p.rFwd=2.6*k;p.rOut=.4;p.rElbow=.3;p.headRx=.5*k;p.spineRx=.35*k;p.mouth=MOUTH.GRIN;p.eyes=EYE.HAPPY;};
STATES.scoop=(p,t)=>{STATES.crouch(p,t);const pat=Math.abs(Math.sin(t*9));p.spineRx=.62;p.lFwd=p.rFwd=1.1+pat*.4;p.lElbow=p.rElbow=.5+pat*.6;p.lOut=p.rOut=.15;p.headRx=.35;p.eyes=EYE.HAPPY;p.mouth=MOUTH.CAT;};
STATES.build=(p,t)=>{STATES.crouch(p,t);const u=Math.min(1,t/.35);const push=Math.sin(u*Math.PI*2)*.5+.5;p.lFwd=p.rFwd=1.3+push*.5;p.lElbow=p.rElbow=1.2-push;p.spineRx=.5;p.mouth=MOUTH.OPEN;};
STATES.hit=(p,t)=>{STATES.idle(p,t);const k=Math.max(0,1-t/.3);p.spineRx=-.5*k;p.headRx=-.4*k;p.lOut=p.rOut=.32+.9*k;p.eyes=EYE.WIDE;p.mouth=MOUTH.O;p.squash=-.08*k;};
// Ragdoll pose: the whole body is tipped onto its back by the renderer; here the limbs flail in the air, then splay and twitch.
// Physics ragdoll: joint angles come from the renderer's simulation (ctx.rag); the face stays silly.
STATES.ragdoll=(p,t,c)=>{STATES.idle(p,t);p.ground=0;const j=c.rag;p.hipX=p.hipRz=p.spineRz=0;
  if(j){p.lFwd=j.lF;p.rFwd=j.rF;p.lOut=j.lO;p.rOut=j.rO;p.lLeg=j.lL;p.rLeg=j.rL;p.lLegOut=j.lLO;p.rLegOut=j.rLO;p.lKnee=j.lK;p.rKnee=j.rK;p.lElbow=j.lE;p.rElbow=j.rE;p.headRx=j.hx;p.headRz=j.hz;p.spineRx=j.sx;}
  const k=j?.t??t;p.eyes=k<.5?EYE.WIDE:Math.floor(k*1.5)%4===3?EYE.CLOSED:EYE.STAR;p.mouth=k<.5?MOUTH.O:MOUTH.TONGUE;};
STATES.splat=(p,t)=>{STATES.idle(p,t);p.ground=0;
  if(t<.75){const w=t*22;p.lFwd=1.6+Math.sin(w)*1.4;p.rFwd=1.6+Math.sin(w+2)*1.4;p.lOut=p.rOut=.9+Math.sin(w*.7)*.5;p.lElbow=p.rElbow=.4;p.lLeg=.9+Math.sin(w+1)*.9;p.rLeg=.9+Math.sin(w+3)*.9;p.lKnee=p.rKnee=.8+Math.sin(w*1.3)*.6;p.eyes=EYE.WIDE;p.mouth=MOUTH.O;p.headRz=Math.sin(w*.5)*.3;}
  else{const k=t-.75,tw=Math.max(0,Math.sin(k*13))*Math.exp(-k*.9);p.lOut=p.rOut=1.45;p.lFwd=.6;p.rFwd=.9;p.lElbow=.5+tw*.6;p.rElbow=.3;p.lLegOut=.45;p.rLegOut=.5;p.lLeg=.35+tw*.7;p.rLeg=.25+Math.max(0,Math.sin(k*11+1))*Math.exp(-k*.9)*.6;p.lKnee=.25+tw;p.rKnee=.2;p.headRz=Math.sin(k*3)*.18;p.eyes=Math.floor(k*1.5)%3===2?EYE.CLOSED:EYE.STAR;p.mouth=MOUTH.TONGUE;}};
STATES.victory=(p,t)=>{STATES.idle(p,t);const b=Math.abs(Math.sin(t*5));p.lFwd=p.rFwd=2.6+Math.sin(t*10)*.2;p.lOut=p.rOut=.5;p.bodyY=b*.14;p.squash=-.06*b;p.eyes=EYE.HAPPY;p.mouth=MOUTH.GRIN;};
STATES.taunt=(p,t)=>{STATES.idle(p,t);p.rFwd=1.8;p.rOut=.9;p.rElbow=1.5+Math.sin(t*14)*.4;p.headRz=Math.sin(t*6)*.15;p.eyes=EYE.WINK;p.mouth=MOUTH.TONGUE;};

export const LOOKS={
  pip:{skin:'#f7d0b5',hair:'short',hairColor:'#8d5c38',eyes:'round',top:'hoodie',topColor:'#7fc3c9',bottom:'shorts',bottomColor:'#3f4a5c',shoes:'sneakers',shoeColor:'#f6efe4',hat:'beanie',hatColor:'#f7d77a',extra:'none'},
  dot:{skin:'#f7d0b5',hair:'bun',hairColor:'#f3efe6',eyes:'happy',top:'cardigan',topColor:'#e25b4f',bottom:'skirt',bottomColor:'#3f4a5c',shoes:'flats',shoeColor:'#3f4a5c',hat:'none',extra:'glasses'},
  chad:{skin:'#cf9570',hair:'buzz',hairColor:'#2e211b',eyes:'round',top:'tank',topColor:'#3f4a5c',bottom:'joggers',bottomColor:'#3f4a5c',shoes:'sneakers',shoeColor:'#e25b4f',hat:'none',extra:'sunnies'},
  luna:{skin:'#ffe3d3',hair:'long',hairColor:'#9b86dc',eyes:'sleepy',top:'kimono',topColor:'#b69be0',bottom:'skirt',bottomColor:'#8ea6e6',shoes:'sandals',shoeColor:'#f6efe4',hat:'flower',hatColor:'#f6efe4',extra:'earrings'},
  jingle:{skin:'#f7d0b5',hair:'curly',hairColor:'#ecc987',eyes:'sparkle',top:'sweater',topColor:'#3f9b5a',bottom:'leggings',bottomColor:'#f7d77a',shoes:'boots',shoeColor:'#5b3825',hat:'none',extra:'blush'},
  kit:{skin:'#eab792',hair:'pigtails',hairColor:'#d9745f',eyes:'happy',top:'overalls',topColor:'#8ea6e6',bottom:'jeans',bottomColor:'#3f4a5c',shoes:'rainboots',shoeColor:'#f7d77a',hat:'none',extra:'freckles'},
  rex:{skin:'#a9714c',hair:'spiky',hairColor:'#2e211b',eyes:'wink',top:'jersey',topColor:'#d8434f',bottom:'cargo',bottomColor:'#6b8f5e',shoes:'sneakers',shoeColor:'#f6efe4',hat:'none',extra:'bandaid'},
  mabel:{skin:'#ffe3d3',hair:'bob',hairColor:'#f3a9c4',eyes:'lashes',top:'dress',topColor:'#e76f8f',bottom:'skirt',bottomColor:'#f6efe4',shoes:'flats',shoeColor:'#e76f8f',hat:'bow',hatColor:'#f6efe4',extra:'heartpin'},
  ozzy:{skin:'#7b4b33',hair:'afro',hairColor:'#2e211b',eyes:'round',top:'flannel',topColor:'#c98b5a',bottom:'jeans',bottomColor:'#3f4a5c',shoes:'boots',shoeColor:'#5b3825',hat:'none',extra:'scarf'},
  yuki:{skin:'#ffe3d3',hair:'ponytail',hairColor:'#76bccd',eyes:'sparkle',top:'hoodie',topColor:'#f6efe4',bottom:'joggers',bottomColor:'#76bccd',shoes:'sneakers',shoeColor:'#76bccd',hat:'none',extra:'earrings'}
};
const BUILT_IN={beanie:'#e25b4f',frog:'#9fd39a'};
export function character(id='pip',hat='none',quality='low'){
  const look={...(LOOKS[id]||LOOKS.pip)};
  if(BUILT_IN[hat]){look.hat=hat;look.hatColor=BUILT_IN[hat];}else if(hat!=='none')look.hat='none';
  const c=createChibi(look,{quality});
  if(hat!=='none'&&!BUILT_IN[hat]){
    const g=new THREE.Group();c.skull.add(g);
    if(hat==='witch'){mesh(GEO.cyl,'#383049',g,[0,1,0],[1.55,.14,1.4]);mesh(GEO.cone,'#383049',g,[.1,1.85,0],[.95,1.8,.95],[0,0,-.13]);mesh(GEO.cyl,'#d99853',g,[0,1.3,0],[.84,.2,.84]);}
    if(hat==='pumpkin'){mesh(GEO.lowSphere,'#df793b',g,[0,1,0],[1.12,.43,1.03]);mesh(GEO.cyl,'#596745',g,[0,1.5,0],[.14,.4,.14],[0,0,-.3]);}
    if(hat==='cat')for(const s of [-1,1]){mesh(GEO.cone,'#3a3442',g,[s*.66,1.22,0],[.4,.8,.25],[0,0,-s*.3]);mesh(GEO.cone,'#d79794',g,[s*.66,1.22,.2],[.23,.48,.08],[0,0,-s*.3]);}
    if(hat==='crown'){mesh(GEO.cyl,'#dca74b',g,[0,1.1,0],[1.1,.35,1.1]);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;mesh(GEO.cone,'#f1ce78',g,[Math.sin(a)*.9,1.5,Math.cos(a)*.9],[.24,.7,.24]);}}
    if(hat==='elf'){mesh(GEO.cyl,'#e25b4f',g,[0,.98,0],[1.08,.22,1.04]);mesh(GEO.cone,'#3f9b5a',g,[0,1.75,-.25],[.95,1.6,.95],[-.45,0,0]);mesh(GEO.lowSphere,'#f7d77a',g,[0,2.25,-.95],[.2,.2,.2]);}
    if(hat==='santa'){mesh(GEO.cyl,'#ffffff',g,[0,.98,0],[1.12,.28,1.08]);mesh(GEO.cone,'#d8434f',g,[0,1.6,-.15],[1,1.3,1],[-.5,0,0]);mesh(GEO.lowSphere,'#ffffff',g,[0,1.95,-.85],[.26,.26,.26]);}
    if(hat==='antlers')for(const s of [-1,1]){mesh(GEO.lowCyl,'#8a5a3c',g,[s*.55,1.35,0],[.07,.75,.07],[0,0,-s*.35]);mesh(GEO.lowCyl,'#8a5a3c',g,[s*.8,1.55,0],[.06,.4,.06],[0,0,-s*1.1]);mesh(GEO.lowCyl,'#8a5a3c',g,[s*.62,1.75,0],[.05,.35,.05],[0,0,s*.4]);}
    if(hat==='earmuffs'){mesh(GEO.torus,'#f6efe4',g,[0,.45,0],[1.04,1.04,.4],[0,Math.PI/2,0]);for(const s of [-1,1])mesh(GEO.lowSphere,'#f3a9c4',g,[s*1.02,.02,0],[.32,.38,.38]);}
    if(hat==='tophat'){mesh(GEO.cyl,'#25222c',g,[0,1.02,0],[1.25,.08,1.25]);mesh(GEO.cyl,'#25222c',g,[0,1.55,0],[.78,1.05,.78]);mesh(GEO.cyl,'#d8434f',g,[0,1.15,0],[.8,.16,.8]);}
  }
  c.root.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=false;}});return c;
}
