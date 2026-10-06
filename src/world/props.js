import {THREE,GEO,mat,mesh,rng,canvasTexture} from './kit.mjs';

// Seasonal palettes for the static world. Everything here is merged into a handful of draw calls.
export function palette(season){
  const frost=season==='frost',night=season==='halloween',fall=season==='harvest';
  return {
    frost,night,fall,
    snow:frost?'#f4f9fc':night?'#c7cbd9':fall?'#e9dcc0':'#f1f4e8',
    cap:frost?'#ffffff':null,
    wood:'#8a5f43',dark:'#5b4033',stone:night?'#7d7f8f':'#a7a9a6',stone2:night?'#666879':'#8e908d',
    leaf:frost?'#3d7064':night?'#c8642c':fall?'#d0612f':'#6aa35f',leaf2:frost?'#2f5c55':night?'#8f3c2c':fall?'#e0a33a':'#86b960',
    hedge:frost?'#4c7a64':night?'#4a5b3f':fall?'#7b7a3a':'#5e9a52',
    metal:'#3b4150',brick:night?'#6a3f45':'#b05a4a',hay:'#d6b064',pumpkin:'#ec8a34',glow:night?'#ffb35c':'#ffe6a6',
    car:['#d8434f','#3f7fc9','#f2c94c','#5aa36b','#e9e4da','#7a5fb0']
  };
}

const cap=(P,parent,pos,scale)=>{if(P.cap)mesh(GEO.lowSphere,P.cap,parent,pos,scale);};

export function buildProp(o,P,root){
  const g=new THREE.Group();g.position.set(o.x,0,o.z);g.rotation.y=o.rot||0;root.add(g);
  const r=o.r,h=o.h;
  switch(o.kind){
    case 'fountain':
      mesh(GEO.cyl,P.stone,g,[0,.35,0],[r+.4,.7,r+.4]);mesh(GEO.cyl,P.frost?'#bfe6f5':'#6d9fc0',g,[0,.72,0],[r,.06,r]);
      mesh(GEO.cyl,P.stone2,g,[0,1.3,0],[.45,1.6,.45]);mesh(GEO.cyl,P.stone,g,[0,2.05,0],[1.3,.25,1.3]);mesh(GEO.lowSphere,P.stone2,g,[0,2.45,0],[.35,.5,.35]);
      cap(P,g,[0,2.2,0],[1.25,.2,1.25]);cap(P,g,[0,.78,0],[r+.35,.12,r+.35]);break;
    case 'hedge':
      mesh(GEO.box,P.hedge,g,[0,h/2,0],[1.25,h,r*1.5]);mesh(GEO.lowSphere,P.hedge,g,[0,h,0],[.66,.25,r*.78]);cap(P,g,[0,h+.08,0],[.62,.16,r*.7]);break;
    case 'bench':
      for(const s of [-.5,.5])mesh(GEO.box,P.metal,g,[s,.25,0],[.08,.5,.5]);mesh(GEO.box,P.wood,g,[0,.48,0],[1.4,.08,.48]);mesh(GEO.box,P.wood,g,[0,.8,-.22],[1.4,.32,.07]);cap(P,g,[0,.54,0],[.68,.06,.22]);break;
    case 'pine':
      mesh(GEO.lowCyl,P.dark,g,[0,1,0],[.22,2,.22]);
      for(let i=0;i<3;i++){mesh(GEO.cone,i%2?P.leaf2:P.leaf,g,[0,2.35+i*.95,0],[1.45-i*.36,1.5,1.45-i*.36]);cap(P,g,[0,2.75+i*.95,0],[(1-i*.27),.22,(1-i*.27)]);}break;
    case 'oak':
      mesh(GEO.lowCyl,P.dark,g,[0,1.3,0],[.28,2.6,.28]);
      for(const [x,y,z,s]of [[0,3.4,0,1.45],[.8,3.05,.3,1],[-.7,3.15,-.2,1.05],[.1,4,-.3,.95]]){mesh(GEO.lowSphere,P.leaf,g,[x,y,z],[s,s*.9,s]);cap(P,g,[x,y+s*.55,z],[s*.75,s*.3,s*.75]);}break;
    case 'deadtree':
      mesh(GEO.lowCyl,'#4b3c3a',g,[0,1.6,0],[.24,3.2,.24]);
      for(const [y,rz,ry]of [[2.6,.9,0],[3,-.8,1.2],[2.2,-.9,2.4],[3.4,.6,3.8]]){const b=new THREE.Group();b.position.y=y;b.rotation.set(0,ry,rz);g.add(b);mesh(GEO.lowCyl,'#4b3c3a',b,[0,.5,0],[.08,1,.08]);}break;
    case 'snowman':
      mesh(GEO.lowSphere,P.snow,g,[0,.5,0],[.72,.62,.72]);mesh(GEO.lowSphere,P.snow,g,[0,1.18,0],[.52,.46,.52]);mesh(GEO.lowSphere,P.snow,g,[0,1.66,0],[.36,.34,.36]);
      mesh(GEO.cone,'#f08a3c',g,[0,1.66,.38],[.07,.3,.07],[Math.PI/2,0,0]);for(const s of [-1,1])mesh(GEO.lowSphere,'#25222c',g,[s*.12,1.76,.3],[.045,.045,.03]);
      mesh(GEO.cyl,'#25222c',g,[0,2.02,0],[.3,.36,.3]);mesh(GEO.cyl,'#25222c',g,[0,1.85,0],[.44,.04,.44]);mesh(GEO.torus,'#d8434f',g,[0,1.42,0],[.38,.38,.6],[Math.PI/2,0,0]);
      for(const s of [-1,1])mesh(GEO.lowCyl,P.dark,g,[s*.65,1.3,0],[.04,.7,.04],[0,0,s*1.1]);break;
    case 'lamp':
      mesh(GEO.lowCyl,P.metal,g,[0,h/2,0],[.09,h,.09]);mesh(GEO.lowCyl,P.metal,g,[0,.1,0],[.22,.2,.22]);mesh(GEO.box,P.metal,g,[0,h,0],[.36,.1,.36]);
      mesh(GEO.lowSphere,mat(P.glow,{emissive:P.glow,emissiveIntensity:1.6}),g,[0,h-.22,0],[.2,.26,.2]);cap(P,g,[0,h+.06,0],[.2,.06,.2]);break;
    case 'rock':
      mesh(GEO.lowSphere,P.stone,g,[0,h*.45,0],[r,h*.6,r*.85],[0,.6,.15]);mesh(GEO.lowSphere,P.stone2,g,[r*.5,h*.3,r*.3],[r*.5,h*.4,r*.45]);cap(P,g,[0,h*.85,0],[r*.75,.2,r*.65]);break;
    case 'sled':
      mesh(GEO.box,'#d8434f',g,[0,.42,0],[.7,.12,1.3]);for(const s of [-.3,.3])mesh(GEO.box,P.metal,g,[s,.18,0],[.05,.3,1.35]);mesh(GEO.box,'#d8434f',g,[0,.62,-.55],[.7,.4,.1]);break;
    case 'crate':
      mesh(GEO.box,'#b98a58',g,[0,.6,0],[1.15,1.2,1.15]);for(const y of [.12,1.08])mesh(GEO.box,'#8a6240',g,[0,y,0],[1.2,.12,1.2]);mesh(GEO.box,'#8a6240',g,[0,.6,.58],[.12,1.1,.05],[0,0,.78]);cap(P,g,[0,1.22,0],[.55,.1,.55]);break;
    case 'fort':
      mesh(GEO.box,P.frost?P.snow:P.night?'#d9d6cf':'#c9b98f',g,[0,h/2,0],[1.1,h,.62]);
      for(let i=-1;i<=1;i+=2)mesh(GEO.box,P.frost?'#e4eef4':'#bfb49b',g,[i*.28,h+.12,0],[.42,.26,.6]);break;
    case 'car':{
      if(o.seg!==1)break;const color=P.car[Math.abs(Math.round(o.x*7+o.z*3))%P.car.length];
      const c=new THREE.Group();c.rotation.y=Math.PI/2;g.add(c);
      mesh(GEO.box,color,c,[0,.62,0],[1.75,.62,3.9]);mesh(GEO.box,color,c,[0,1.12,-.15],[1.55,.55,2.1]);mesh(GEO.box,'#a9d3e8',c,[0,1.12,-.15],[1.6,.42,1.9]);
      for(const x of [-.8,.8])for(const z of [-1.25,1.25])mesh(GEO.cyl,'#22232a',c,[x,.32,z],[.34,.22,.34],[0,0,Math.PI/2]);
      for(const x of [-.55,.55])mesh(GEO.box,mat('#fff6cf',{emissive:'#fff2b0',emissiveIntensity:.8}),c,[x,.66,1.96],[.3,.14,.04]);
      cap(P,c,[0,1.42,-.15],[.75,.1,1]);cap(P,c,[0,.95,1.3],[.8,.06,.6]);break;}
    case 'fence':
      mesh(GEO.box,'#f2ece2',g,[0,.5,0],[.1,1,.12]);mesh(GEO.box,'#f2ece2',g,[0,.72,0],[.05,.09,.95]);mesh(GEO.box,'#f2ece2',g,[0,.38,0],[.05,.09,.95]);mesh(GEO.cone,'#f2ece2',g,[0,1.05,0],[.07,.12,.07]);break;
    case 'ironfence':
      mesh(GEO.box,'#2b2a33',g,[0,.7,0],[.06,1.4,.06]);mesh(GEO.box,'#2b2a33',g,[0,1.25,0],[.04,.05,.75]);mesh(GEO.box,'#2b2a33',g,[0,.3,0],[.04,.05,.75]);mesh(GEO.cone,'#2b2a33',g,[0,1.48,0],[.06,.16,.06]);break;
    case 'mailbox':
      mesh(GEO.box,P.wood,g,[0,.5,0],[.1,1,.1]);mesh(GEO.box,'#3f7fc9',g,[0,1.08,0],[.32,.3,.5]);mesh(GEO.box,'#d8434f',g,[.18,1.2,.1],[.03,.22,.06]);break;
    case 'shelter':
      for(const x of [-1.1,1.1])mesh(GEO.box,P.metal,g,[x,1.2,0],[.1,2.4,.1]);mesh(GEO.box,'#a9d3e8',g,[0,1.3,-.5],[2.4,1.7,.06]);mesh(GEO.box,P.metal,g,[0,2.45,0],[2.6,.12,1.3]);mesh(GEO.box,P.wood,g,[0,.5,-.3],[2,.08,.4]);cap(P,g,[0,2.55,0],[1.25,.12,.6]);break;
    case 'jack':{
      const pk=P.night?'#f08a34':P.frost?'#e9934a':'#e98a43',lit=mat('#ffd36b',{emissive:'#ffb347',emissiveIntensity:P.night?2.2:1.2});
      for(let l=0;l<8;l++){const a=l/8*Math.PI*2;mesh(GEO.lowSphere,pk,g,[Math.sin(a)*.95,1.6,Math.cos(a)*.95],[1.55,1.6,1.55]);}
      mesh(GEO.lowCyl,'#59613b',g,[0,3.3,0],[.22,.6,.22],[0,0,-.2]);
      for(const s of [-1,1])mesh(GEO.cone,lit,g,[s*.95,2.05,2.42],[.42,.5,.12],[0,0,Math.PI]);mesh(GEO.box,lit,g,[0,1.2,2.48],[1.5,.32,.12]);cap(P,g,[0,3.05,0],[1.2,.3,1.2]);break;}
    case 'hay':
      mesh(GEO.box,P.hay,g,[0,h/2,0],[1.35,h,1.75]);for(const z of [-.45,.45])mesh(GEO.box,'#a8884a',g,[0,h/2,z],[1.38,h+.02,.08]);cap(P,g,[0,h+.04,0],[.6,.08,.8]);break;
    case 'scarecrow':
      mesh(GEO.lowCyl,P.wood,g,[0,1.1,0],[.07,2.2,.07]);mesh(GEO.box,P.wood,g,[0,1.65,0],[1.5,.07,.07]);mesh(GEO.box,'#6b8f5e',g,[0,1.5,0],[.55,.65,.3]);
      mesh(GEO.lowSphere,'#e8d09a',g,[0,2.05,0],[.25,.27,.25]);mesh(GEO.cone,'#8a5f43',g,[0,2.35,0],[.42,.4,.42]);mesh(GEO.cyl,'#8a5f43',g,[0,2.2,0],[.55,.04,.55]);break;
    case 'gourds':
      for(const [x,z,s,c]of [[0,0,.55,P.pumpkin],[.65,.3,.4,'#f2c94c'],[-.55,.35,.42,P.pumpkin],[.2,-.6,.36,'#e9e4da'],[-.3,-.45,.3,'#5aa36b']]){mesh(GEO.lowSphere,c,g,[x,s*.85,z],[s,s*.85,s]);mesh(GEO.lowCyl,'#59613b',g,[x,s*1.7,z],[.04,.14,.04]);}break;
    case 'cart':
      mesh(GEO.box,P.wood,g,[0,.75,0],[1.3,.5,2]);for(const s of [-.72,.72])mesh(GEO.cyl,'#5b4033',g,[s,.42,0],[.42,.08,.42],[0,0,Math.PI/2]);mesh(GEO.box,P.wood,g,[0,.6,1.6],[.08,.08,1.4],[.2,0,0]);
      for(let i=0;i<4;i++)mesh(GEO.lowSphere,P.pumpkin,g,[(i%2-.5)*.6,1.15,(i>>1)*.8-.4],[.32,.27,.32]);break;
    case 'crypt':
      mesh(GEO.box,P.stone2,g,[0,1.4,0],[3.6,2.8,3.6]);mesh(GEO.cone,P.stone,g,[0,3.25,0],[2.9,1.2,2.9],[0,Math.PI/4,0]);mesh(GEO.box,'#2b2a33',g,[0,1,1.81],[1.2,2,.04]);
      for(const x of [-1.5,1.5])mesh(GEO.lowCyl,P.stone,g,[x,1.4,1.85],[.18,2.8,.18]);mesh(GEO.box,mat('#b9ff9e',{emissive:'#7dff6b',emissiveIntensity:1.5}),g,[0,2.3,1.83],[.4,.25,.03]);break;
    case 'tomb':
      mesh(GEO.box,P.stone,g,[0,.55,0],[.8,1.1,.22]);mesh(GEO.cyl,P.stone,g,[0,1.1,0],[.4,.22,.4],[Math.PI/2,0,0]);mesh(GEO.box,'#62705a',g,[0,.04,.45],[.8,.08,.7]);cap(P,g,[0,1.27,0],[.36,.07,.12]);break;
    case 'obelisk':
      mesh(GEO.box,P.stone2,g,[0,.25,0],[1,.5,1]);mesh(GEO.cyl,P.stone,g,[0,1.5,0],[.32,2.2,.32]);mesh(GEO.cone,P.stone,g,[0,2.8,0],[.34,.5,.34]);break;
    default:mesh(GEO.lowCyl,P.stone,g,[0,h/2,0],[r,h,r]);
  }
  return g;
}

// Ground texture: painted once per map on a canvas (paths, lawn noise, roads).
export function groundTexture(map,S,P){
  const W=1024,H=Math.round(1024*map.depth/map.width),sx=W/map.width,sz=H/map.depth,X=x=>(x+map.width/2)*sx,Z=z=>(z+map.depth/2)*sz,random=rng(77);
  return canvasTexture(W,H,(g)=>{
    g.fillStyle=S.ground;g.fillRect(0,0,W,H);
    for(let i=0;i<5000;i++){g.fillStyle=random()<.5?S.ground2:shadeHex(S.ground,.06);g.globalAlpha=.35;const s=2+random()*7;g.fillRect(random()*W,random()*H,s,s);}g.globalAlpha=1;
    g.strokeStyle=S.path;g.lineCap='round';
    if(map.id==='commons'){g.lineWidth=3.4*sx;g.beginPath();g.moveTo(0,Z(0));g.lineTo(W,Z(0));g.moveTo(X(0),0);g.lineTo(X(0),H);g.stroke();g.lineWidth=2.6*sx;g.beginPath();g.arc(X(0),Z(0),6.5*sx,0,7);g.stroke();
      g.fillStyle=S.path;g.beginPath();g.arc(X(0),Z(0),4*sx,0,7);g.fill();
      for(const o of map.ice){const gr=g.createRadialGradient(X(o.x),Z(o.z),0,X(o.x),Z(o.z),o.r*sx);gr.addColorStop(0,'#cfeeff');gr.addColorStop(.8,'#a9dcf5');gr.addColorStop(1,'#e8f6ff');g.fillStyle=gr;g.beginPath();g.arc(X(o.x),Z(o.z),o.r*sx,0,7);g.fill();g.strokeStyle='#ffffff99';g.lineWidth=2;for(let k=0;k<6;k++){g.beginPath();g.arc(X(o.x)+(random()-.5)*o.r*sx,Z(o.z)+(random()-.5)*o.r*sx,random()*o.r*sx*.5,0,2);g.stroke();}}}
    if(map.road){g.fillStyle=P.frost?'#9aa6b2':'#4a4d57';g.fillRect(0,Z(-4.6*map.scale),W,9.2*map.scale*sz);g.fillStyle=P.frost?'#e9f1f6':'#9a9da5';g.fillRect(0,Z(-6.2*map.scale),W,1.6*map.scale*sz);g.fillRect(0,Z(4.6*map.scale),W,1.6*map.scale*sz);
      g.fillStyle='#f2c94c';for(let x=0;x<W;x+=60)g.fillRect(x,Z(-.12),32,.24*sz);if(P.frost){g.fillStyle='#ffffffaa';for(let i=0;i<300;i++)g.fillRect(random()*W,Z(-4.6)+random()*9.2*sz,random()*30,random()*6);}}
    if(map.id==='patch'){g.strokeStyle=shadeHex(S.ground,-.12);g.lineWidth=.9*sx;for(let z=-map.depth/2+2;z<map.depth/2;z+=2.2){g.beginPath();g.moveTo(0,Z(z));g.lineTo(W,Z(z));g.stroke();}g.strokeStyle=S.path;g.lineWidth=3*sx;g.beginPath();g.moveTo(0,Z(0));g.lineTo(W,Z(0));g.stroke();}
    if(map.id==='hollow'){g.lineWidth=2.4*sx;g.beginPath();g.moveTo(0,Z(0));for(let x=-map.width/2;x<=map.width/2;x+=2)g.lineTo(X(x),Z(Math.sin(x*.18)*4));g.stroke();g.beginPath();g.moveTo(X(0),0);g.lineTo(X(0),H);g.stroke();}
    for(const p of map.piles){const gr=g.createRadialGradient(X(p.x),Z(p.z),0,X(p.x),Z(p.z),2*sx);gr.addColorStop(0,'#ffffffcc');gr.addColorStop(1,'#ffffff00');g.fillStyle=gr;g.beginPath();g.arc(X(p.x),Z(p.z),2*sx,0,7);g.fill();}
  },{});
}
export function shadeHex(hex,k){const c=new THREE.Color(hex);if(k>0)c.lerp(new THREE.Color('#ffffff'),k);else c.lerp(new THREE.Color('#000000'),-k);return '#'+c.getHexString();}

// Scenery outside the arena bounds (not collidable): skyline, houses, fields, forest.
export function buildBackdrop(map,S,P,root){
  const random=rng(311),W=map.width/2,D=map.depth/2;
  const ring=(n,R1,R2,fn)=>{for(let i=0;i<n;i++){const a=random()*Math.PI*2,R=R1+random()*(R2-R1);const x=Math.sin(a)*R*W/Math.max(W,D)*1.4,z=Math.cos(a)*R*D/Math.max(W,D)*1.4;if(Math.abs(x)<W+3&&Math.abs(z)<D+3)continue;fn(x,z,random);}};
  // A low wall or hedge marks the boundary so players read the edge instantly.
  for(let x=-W;x<=W;x+=2)for(const z of [-D-.5,D+.5]){mesh(GEO.box,P.frost?'#e4eef4':P.stone2,root,[x,.35,z],[2.05,.7,.6]);}
  for(let z=-D;z<=D;z+=2)for(const x of [-W-.5,W+.5]){mesh(GEO.box,P.frost?'#e4eef4':P.stone2,root,[x,.35,z],[.6,.7,2.05]);}
  if(map.id==='commons'){
    // City skyline beyond the park trees, windows glowing at dusk.
    const win=mat('#ffe6a6',{emissive:'#ffd27a',emissiveIntensity:P.night?1.4:.5});
    for(let i=0;i<46;i++){const a=i/46*Math.PI*2,R=Math.max(W,D)+28+random()*20,x=Math.sin(a)*R*1.15,z=Math.cos(a)*R*.85,h=12+random()*34,w=6+random()*7;
      const b=new THREE.Group();b.position.set(x,0,z);b.lookAt(0,0,0);root.add(b);mesh(GEO.box,['#56607a','#6a7290','#4a5068','#7d7f99'][i%4],b,[0,h/2,0],[w,h,w]);
      for(let k=0;k<6;k++)mesh(GEO.box,win,b,[(random()-.5)*w*.8,2+random()*(h-3),w/2+.02],[.8,1.1,.05]);if(P.frost)mesh(GEO.box,'#ffffff',b,[0,h+.1,0],[w+.1,.25,w+.1]);}
    ring(70,1.05,1.5,(x,z,r)=>buildProp({kind:r()<.6?'pine':'oak',x,z,r:.8,h:4,rot:r()*6},P,root));
  }else if(map.id==='street'){
    for(const side of [-1,1])for(let x=-W-6;x<=W+6;x+=11){const h=new THREE.Group();h.position.set(x+random()*2,0,side*(D+7.5));h.rotation.y=side>0?Math.PI:0;root.add(h);
      const wall=['#e9d7c0','#c9dbe6','#f2c7b5','#d7e4c4','#efe2a8'][Math.abs(Math.round(x))%5];mesh(GEO.box,wall,h,[0,2.2,0],[8,4.4,7]);
      const roof=new THREE.Group();roof.position.y=4.4;h.add(roof);mesh(GEO.cone,P.brick,roof,[0,1.4,0],[6.4,2.8,5.4],[0,Math.PI/4,0]);if(P.frost)mesh(GEO.cone,'#ffffff',roof,[0,1.55,0],[6,2.5,5],[0,Math.PI/4,0]);
      mesh(GEO.box,P.wood,h,[0,1.1,3.52],[1.2,2.2,.1]);const lit=mat('#ffe6a6',{emissive:'#ffd27a',emissiveIntensity:P.night?1.6:.6});for(const wx of [-2.4,2.4])mesh(GEO.box,lit,h,[wx,2.6,3.52],[1.4,1.2,.08]);
      if(P.frost||P.night)for(let k=0;k<9;k++)mesh(GEO.lowSphere,mat(['#ff5a5a','#7dff9b','#ffd25e','#6bc7ff'][k%4],{emissive:['#ff3a3a','#4dff7a','#ffc23a','#3aaaff'][k%4],emissiveIntensity:2}),h,[-3.6+k*.9,4.35,3.6],[.09,.12,.09]);}
    ring(30,1.3,1.6,(x,z,r)=>buildProp({kind:'oak',x,z,r:.8,h:4,rot:r()*6},P,root));
  }else if(map.id==='patch'){
    for(const side of [-1,1])for(let x=-W-8;x<=W+8;x+=1.6)for(let row=0;row<3;row++)mesh(GEO.cone,P.frost?'#d9c79a':'#c9a64e',root,[x+random()*.5,1.1,side*(D+3+row*1.6+random())],[.35,2.2+random(),.35]);
    for(const z of [-D-12,D+12])for(let i=0;i<3;i++){const b=new THREE.Group();b.position.set((i-1)*24,0,z);root.add(b);mesh(GEO.box,'#b0413e',b,[0,3,0],[9,6,7]);mesh(GEO.cone,'#6b3a35',b,[0,7.2,0],[7,2.6,6],[0,Math.PI/4,0]);mesh(GEO.box,'#f2ece2',b,[0,2,3.52],[3,4,.1]);}
    ring(40,1.3,1.6,(x,z,r)=>buildProp({kind:'oak',x,z,r:.8,h:4,rot:r()*6},P,root));
  }else{
    for(let x=-W;x<=W;x+=.75)for(const z of [-D-1.2,D+1.2])buildProp({kind:'ironfence',x,z,r:.25,h:1.4,rot:Math.PI/2},P,root);
    ring(60,1.1,1.6,(x,z,r)=>buildProp({kind:r()<.7?'deadtree':'pine',x,z,r:.5,h:4,rot:r()*6},P,root));
    for(let i=0;i<5;i++){const b=new THREE.Group();b.position.set((i-2)*14,0,-D-16-random()*6);root.add(b);mesh(GEO.box,'#4a4458',b,[0,5,0],[6,10,6]);mesh(GEO.cone,'#3a3448',b,[0,12,0],[4.6,4,4.6],[0,Math.PI/4,0]);mesh(GEO.box,mat('#b9ff9e',{emissive:'#7dff6b',emissiveIntensity:1.6}),b,[0,6,3.02],[1,1.4,.05]);}
  }
  // Scatter seasonal dressing inside the arena where it does not block anything.
  for(let i=0;i<70;i++){const x=(random()-.5)*map.width*.96,z=(random()-.5)*map.depth*.96;if(map.props.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+1.2)||map.piles.some(o=>Math.hypot(o.x-x,o.z-z)<2.4)||map.road&&Math.abs(z)<6)continue;
    if(P.night||map.id==='patch'){const s=.18+random()*.22;mesh(GEO.lowSphere,P.pumpkin,root,[x,s*.8,z],[s,s*.8,s]);}
    else if(P.frost){mesh(GEO.lowSphere,'#ffffff',root,[x,.05,z],[.4+random()*.8,.12,.3+random()*.6]);}
    else if(P.fall){mesh(GEO.lowSphere,['#d0612f','#e0a33a','#b8452a'][i%3],root,[x,.04,z],[.5+random()*.6,.06,.4+random()*.5]);}
    else{mesh(GEO.lowSphere,['#ffd25e','#f3a9c4','#ffffff'][i%3],root,[x,.12,z],[.1,.1,.1]);}}
}
