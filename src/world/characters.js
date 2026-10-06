import {THREE,GEO,mesh,mat} from './kit.mjs';
import {createChibi} from './chars/chibi.mjs';
import {STATES} from './chars/chibi-anim.mjs';
import {EYE,MOUTH} from './chars/face.mjs';

// Extend the supplied pose table; keep the original model proportions and rig.
STATES.throw=(p,t)=>{STATES.idle(p,t);const u=Math.min(1,t/.32);p.rFwd=u<.38?-.9:1.8*(1-u);p.rElbow=.6;p.spineRy=Math.sin(u*Math.PI)*-.3;p.eyes=EYE.SQUINT;};
STATES.charge=(p,t)=>{STATES.idle(p,t);p.rFwd=-.8;p.rElbow=1.6;p.hipY=-.045;p.spineRx=.15;p.mouth=MOUTH.O;};
STATES.roll=(p,t)=>{STATES.idle(p,t);p.bodyRx=-Math.min(1,t/.28)*Math.PI*2;p.bodyY=.25;p.lLeg=p.rLeg=1;p.lKnee=p.rKnee=1.8;p.lFwd=p.rFwd=1.5;};
STATES.hit=(p,t)=>{STATES.idle(p,t);p.spineRx=-.35*Math.max(0,1-t/.3);p.eyes=EYE.WIDE;p.mouth=MOUTH.O;};
STATES.splat=(p,t)=>{STATES.idle(p,t);p.hipY=-.13;p.spineRx=-.3;p.headRz=Math.sin(t*8)*.17;p.eyes=EYE.SAD;p.mouth=MOUTH.WOBBLE;};
STATES.victory=(p,t)=>{STATES.idle(p,t);p.lFwd=p.rFwd=2.5;p.bodyY=Math.abs(Math.sin(t*5))*.12;p.eyes=EYE.HAPPY;p.mouth=MOUTH.GRIN;};

const LOOKS={
  pip:{skin:'#f7d0b5',hair:'short',hairColor:'#8d5c38',eyes:'round',top:'hoodie',topColor:'#7fc3c9',bottom:'shorts',bottomColor:'#3f4a5c',shoes:'sneakers',shoeColor:'#f6efe4',hat:'beanie',hatColor:'#f7d77a',extra:'none'},
  dot:{skin:'#f7d0b5',hair:'bun',hairColor:'#f3efe6',eyes:'happy',top:'cardigan',topColor:'#e25b4f',bottom:'skirt',bottomColor:'#3f4a5c',shoes:'flats',shoeColor:'#3f4a5c',hat:'none',extra:'glasses'},
  chad:{skin:'#cf9570',hair:'buzz',hairColor:'#2e211b',eyes:'round',top:'tank',topColor:'#3f4a5c',bottom:'joggers',bottomColor:'#3f4a5c',shoes:'sneakers',shoeColor:'#e25b4f',hat:'none',extra:'sunnies'},
  luna:{skin:'#ffe3d3',hair:'long',hairColor:'#9b86dc',eyes:'sleepy',top:'kimono',topColor:'#b69be0',bottom:'skirt',bottomColor:'#8ea6e6',shoes:'sandals',shoeColor:'#f6efe4',hat:'flower',hatColor:'#f6efe4',extra:'earrings'}
};
export function character(id='pip',hat='none',quality='low'){
  const look={...(LOOKS[id]||LOOKS.pip)};if(hat!=='none')look.hat='none';const c=createChibi(look,{quality});
  if(hat!=='none'){
    const g=new THREE.Group();c.skull.add(g);
    if(hat==='witch'){mesh(GEO.cyl,'#383049',g,[0,1,0],[1.55,.14,1.4]);mesh(GEO.cone,'#383049',g,[.1,1.85,0],[.95,1.8,.95],[0,0,-.13]);mesh(GEO.cyl,'#d99853',g,[0,1.3,0],[.84,.2,.84]);}
    if(hat==='pumpkin'){mesh(GEO.lowSphere,'#df793b',g,[0,1,0],[1.12,.43,1.03]);mesh(GEO.cyl,'#596745',g,[0,1.5,0],[.14,.4,.14],[0,0,-.3]);}
    if(hat==='cat')for(const s of [-1,1]){mesh(GEO.cone,'#3a3442',g,[s*.66,1.22,0],[.4,.8,.25],[0,0,-s*.3]);mesh(GEO.cone,'#d79794',g,[s*.66,1.22,.2],[.23,.48,.08],[0,0,-s*.3]);}
    if(hat==='crown'){mesh(GEO.cyl,'#dca74b',g,[0,1.1,0],[1.1,.35,1.1]);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;mesh(GEO.cone,'#f1ce78',g,[Math.sin(a)*.9,1.5,Math.cos(a)*.9],[.24,.7,.24]);}}
  }
  c.root.traverse(n=>{if(n.isMesh)n.castShadow=false;});return c;
}
