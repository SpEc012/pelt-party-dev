export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const rateFor = count => count<=4?30:count<=8?20:count<=14?15:12;
export function moveBody(p, vx, vz, dt, map, forts=[]) {
  let x=p.x,z=p.z;const steps=Math.max(1,Math.ceil(Math.hypot(vx,vz)*dt/.22));
  // Substeps prevent fast dodge movement from tunnelling through narrow cover.
  for(let step=0;step<steps;step++){
    x+=vx*dt/steps;z+=vz*dt/steps;
    for(let pass=0;pass<2;pass++)for(const o of [...map.props,...forts]){
      const dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz),r=(o.r??.9)+.42;
      if(d<r){x=o.x+(d>.001?dx/d:1)*r;z=o.z+(d>.001?dz/d:0)*r;}
    }
    x=clamp(x,-map.width/2+.5,map.width/2-.5);z=clamp(z,-map.depth/2+.5,map.depth/2-.5);
  }
  return {x,z};
}
export function makePelt(id,by,origin,aim,charge,now) {
  const max=charge?23:16,dx=aim.x-origin.x,dz=aim.z-origin.z,d=Math.min(max,Math.hypot(dx,dz)),angle=Math.atan2(dx,dz),T=.32+.029*d;
  const y=origin.crouch?.78:1.18,ty=clamp(Number.isFinite(aim.y)?aim.y:0,0,1.7),gravity=charge?15:19;
  return {id,by,x:origin.x,z:origin.z,y,ty,tx:origin.x+Math.sin(angle)*d,tz:origin.z+Math.cos(angle)*d,charge:!!charge,release:now+90,T,gravity,vy:(ty-y+.5*gravity*T*T)/T};
}
export function peltAt(p,now) {
  const t=clamp((now-p.release)/1000,0,p.T),f=t/p.T;
  return {x:p.x+(p.tx-p.x)*f,z:p.z+(p.tz-p.z)*f,y:(p.y??1)+p.vy*t-.5*(p.gravity??14)*t*t};
}
// Return first contact time along a segment, including the cover's actual height.
export function coverContact(a,b,o,padding=.18){
 const dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y,ox=a.x-o.x,oz=a.z-o.z,r=o.r+padding;
 const A=dx*dx+dz*dz,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-r*r;
 let lo=0,hi=1;
 if(A<1e-9){if(C>0)return null;}else{const disc=B*B-4*A*C;if(disc<0)return null;lo=Math.max(lo,(-B-Math.sqrt(disc))/(2*A));hi=Math.min(hi,(-B+Math.sqrt(disc))/(2*A));}
 if(Math.abs(dy)<1e-9){if(a.y<-.2||a.y>o.h+padding)return null;}else{const t1=(-.2-a.y)/dy,t2=(o.h+padding-a.y)/dy;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
 return lo<=hi&&lo<=1&&hi>=0?Math.max(0,lo):null;
}
export function sweptHit(a,b,p,r=.6) {
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz,t=den?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/den,0,1):0;
  const y=a.y+(b.y-a.y)*t;
  return y>=-.2&&y<=(p.crouch?1.02:1.9)&&Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z)<=r;
}
export function lineBlocked(a,b,map) {
  const aa={...a,y:1},bb={...b,y:1};
  return map.props.some(o=>o.h>=1.4&&sweptHit(aa,bb,o,o.r+.2));
}
export function payout({splats=0,place=9,bots=false,players=8,dailyEarned=0}) {
  let n=20+Math.min(15,Math.max(0,splats))*3+([30,15,8][place-1]||0);
  if(bots||players===2)n=Math.floor(n/2);
  const full=Math.min(n,Math.max(0,400-dailyEarned));
  return full+Math.floor((n-full)/2);
}
