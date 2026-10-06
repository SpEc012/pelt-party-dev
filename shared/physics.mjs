export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const rateFor = count => count<=4?30:count<=8?20:count<=14?15:12;
const BODY=.42;
// Circle-vs-cylinder sliding with substeps so a 15 m/s dive cannot tunnel through a wall.
export function moveBody(p, vx, vz, dt, map, forts=[]) {
  let x=p.x,z=p.z;const steps=Math.max(1,Math.ceil(Math.hypot(vx,vz)*dt/.22));
  const halfW=map.width/2-.5,halfD=map.depth/2-.5;
  for(let step=0;step<steps;step++){
    x+=vx*dt/steps;z+=vz*dt/steps;
    for(let pass=0;pass<2;pass++){
      for(const list of [map.props,forts])for(const o of list){
        const r=(o.r??.9)+BODY,dx=x-o.x;if(dx>r||dx<-r)continue;const dz=z-o.z;if(dz>r||dz<-r)continue;
        const d=Math.hypot(dx,dz);if(d<r){x=o.x+(d>.001?dx/d:1)*r;z=o.z+(d>.001?dz/d:0)*r;}
      }
    }
    x=clamp(x,-halfW,halfW);z=clamp(z,-halfD,halfD);
  }
  return {x,z};
}
export const onIce=(map,p)=>!!map.ice?.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r);
// Fast, readable arcs: quick throws are flat lasers at short range, charged throws reach across the map.
export function makePelt(id,by,origin,aim,charge,now) {
  const max=charge?32:24,dx=aim.x-origin.x,dz=aim.z-origin.z,d=Math.min(max,Math.max(.5,Math.hypot(dx,dz))),angle=Math.atan2(dx,dz);
  const T=charge?.14+.017*d:.15+.021*d,y=origin.crouch?.8:1.22,ty=clamp(Number.isFinite(aim.y)?aim.y:0,0,1.8),gravity=charge?9:13;
  const vy=(ty-y+.5*gravity*T*T)/T,TE=Math.min(T*2.5,(vy+Math.sqrt(vy*vy+2*gravity*y))/gravity);
  // T reaches the aim point; a miss keeps flying until it lands at TE.
  return {id,by,x:origin.x,z:origin.z,y,ty,tx:origin.x+Math.sin(angle)*d,tz:origin.z+Math.cos(angle)*d,charge:!!charge,release:now+60,T,TE,gravity,vy};
}
export const flightEnd=p=>p.release+(p.TE??p.T)*1000;
export function peltAt(p,now,out={}) {
  const t=clamp((now-p.release)/1000,0,p.TE??p.T),f=t/p.T;
  out.x=p.x+(p.tx-p.x)*f;out.z=p.z+(p.tz-p.z)*f;out.y=(p.y??1)+p.vy*t-.5*(p.gravity??14)*t*t;return out;
}
// Return first contact time along a segment, including the cover's actual height.
export function coverContact(a,b,o,padding=.18){
 const dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y,ox=a.x-o.x,oz=a.z-o.z,r=o.r+padding;
 const A=dx*dx+dz*dz,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-r*r;
 let lo=0,hi=1;
 if(A<1e-9){if(C>0)return null;}else{const disc=B*B-4*A*C;if(disc<0)return null;const sq=Math.sqrt(disc);lo=Math.max(lo,(-B-sq)/(2*A));hi=Math.min(hi,(-B+sq)/(2*A));}
 if(Math.abs(dy)<1e-9){if(a.y<-.2||a.y>o.h+padding)return null;}else{const t1=(-.2-a.y)/dy,t2=(o.h+padding-a.y)/dy;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
 return lo<=hi&&lo<=1&&hi>=0?Math.max(0,lo):null;
}
// First cover piece hit along a segment, or null. Cheap bounding test before the exact one.
export function firstCover(a,b,lists,padding=.18){
  let best=null,bt=2;const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minZ=Math.min(a.z,b.z),maxZ=Math.max(a.z,b.z);
  for(const list of lists)for(const o of list){const r=o.r+padding;if(o.x+r<minX||o.x-r>maxX||o.z+r<minZ||o.z-r>maxZ)continue;const t=coverContact(a,b,o,padding);if(t!==null&&t<bt){bt=t;best=o;}}
  return best?{o:best,t:bt}:null;
}
export function sweptHit(a,b,p,r=.6) {
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz,t=den?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/den,0,1):0;
  const y=a.y+(b.y-a.y)*t;
  return y>=-.2&&y<=(p.crouch?1.0:1.9)&&Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z)<=r;
}
export function lineBlocked(a,b,map,forts=[]) {
  const aa={x:a.x,y:1.1,z:a.z},bb={x:b.x,y:1.1,z:b.z};
  return !!firstCover(aa,bb,[map.props,forts],.05);
}
export function payout({splats=0,place=9,bots=false,players=8,dailyEarned=0}) {
  let n=20+Math.min(15,Math.max(0,splats))*3+([30,15,8][place-1]||0);
  if(bots||players===2)n=Math.floor(n/2);
  const full=Math.min(n,Math.max(0,400-dailyEarned));
  return full+Math.floor((n-full)/2);
}
