import {clamp} from './physics.mjs';

// Character faces +z. Right is the clockwise perpendicular when viewed from above.
export function cameraBasis(yaw){return {fx:Math.sin(yaw),fz:Math.cos(yaw),rx:-Math.cos(yaw),rz:Math.sin(yaw)};}
export function relativeMove(x,forward,yaw){const b=cameraBasis(yaw),d=Math.max(1,Math.hypot(x,forward));return {x:(b.rx*x+b.fx*forward)/d,z:(b.rz*x+b.fz*forward)/d};}
export function driveVelocity(body,input,dt,{sprint=false,charging=false,crouch=false}={}){
 const speed=crouch?2.5:charging?3.6:sprint?7.2:5.2;
 const moving=Math.hypot(input.x,input.z)>.02,k=1-Math.exp(-(moving?15:22)*Math.min(dt,.05));
 return {vx:body.vx+(input.x*speed-body.vx)*k,vz:body.vz+(input.z*speed-body.vz)*k};
}
// Clip the shoulder camera against finite cylindrical cover, independently of render geometry.
export function cameraClearance(target,wanted,cover){
 let fraction=1;const dx=wanted.x-target.x,dz=wanted.z-target.z,dy=wanted.y-target.y;
 for(const o of cover){const ox=target.x-o.x,oz=target.z-o.z,r=o.r+.28,A=dx*dx+dz*dz,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-r*r;
  if(A<.0001)continue;const disc=B*B-4*A*C;if(disc<0)continue;
  const enter=(-B-Math.sqrt(disc))/(2*A),exit=(-B+Math.sqrt(disc))/(2*A);
  const t=clamp(enter,0,1);if(exit<=0||enter>1)continue;
  if(target.y+dy*t<o.h+.3)fraction=Math.min(fraction,Math.max(.12,t-.05));
 }
 return {x:target.x+dx*fraction,y:target.y+dy*fraction,z:target.z+dz*fraction};
}
