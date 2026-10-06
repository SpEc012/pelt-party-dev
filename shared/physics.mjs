export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const rateFor = count => count<=4?30:count<=8?20:count<=14?15:12;
export function moveBody(p, vx, vz, dt, map, forts=[]) {
  let x=clamp(p.x+vx*dt,-map.width/2+.6,map.width/2-.6),z=clamp(p.z+vz*dt,-map.depth/2+.6,map.depth/2-.6);
  for(const o of [...map.props,...forts]) {
    const dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz),r=(o.r??.9)+.42;
    if(d<r){ const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0;x=o.x+nx*r;z=o.z+nz*r; }
  }
  return {x:clamp(x,-map.width/2+.5,map.width/2-.5),z:clamp(z,-map.depth/2+.5,map.depth/2-.5)};
}
export function makePelt(id,by,origin,aim,charge,now) {
  const max=charge?14:9,dx=aim.x-origin.x,dz=aim.z-origin.z,d=Math.min(max,Math.hypot(dx,dz)),angle=Math.atan2(dx,dz),T=.45+.04*d;
  return {id,by,x:origin.x,z:origin.z,tx:origin.x+Math.sin(angle)*d,tz:origin.z+Math.cos(angle)*d,charge:!!charge,release:now+120,T,vy:(7*T*T-1)/T};
}
export function peltAt(p,now) {
  const t=clamp((now-p.release)/1000,0,p.T),f=t/p.T;
  return {x:p.x+(p.tx-p.x)*f,z:p.z+(p.tz-p.z)*f,y:1+p.vy*t-7*t*t};
}
export function sweptHit(a,b,p,r=.6) {
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz,t=den?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/den,0,1):0;
  const y=a.y+(b.y-a.y)*t;
  return y>=-.2&&y<=1.5&&Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z)<=r;
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
