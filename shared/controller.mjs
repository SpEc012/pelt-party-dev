import {clamp} from './physics.mjs';
import {RULES} from './content.mjs';

// Character faces +z. Right is the clockwise perpendicular when viewed from above.
export function cameraBasis(yaw){return {fx:Math.sin(yaw),fz:Math.cos(yaw),rx:-Math.cos(yaw),rz:Math.sin(yaw)};}
export function relativeMove(x,forward,yaw){const b=cameraBasis(yaw),d=Math.max(1,Math.hypot(x,forward));return {x:(b.rx*x+b.fx*forward)/d,z:(b.rz*x+b.fz*forward)/d};}
export function topSpeed({sprint=false,charging=false,crouch=false,rush=false}={}){
 const base=crouch?RULES.crouch:charging?RULES.charging:sprint?RULES.sprint:RULES.run;return base*(rush?RULES.rush:1);
}
// Snappy on grass, floaty on ice. Exponential response keeps it frame-rate independent.
export function driveVelocity(body,input,dt,opts={}){
 const speed=topSpeed(opts)*(opts.ice?1.1:1),moving=Math.hypot(input.x,input.z)>.02;
 const rate=opts.ice?(moving?2.2:.9):(moving?16:24),k=1-Math.exp(-rate*Math.min(dt,.05));
 return {vx:body.vx+(input.x*speed-body.vx)*k,vz:body.vz+(input.z*speed-body.vz)*k};
}
// Speed curve of a dive or slide, u is 0..1 through the move.
export const diveSpeed=u=>RULES.diveSpeed*(1-.42*clamp(u,0,1)**1.4);
export const slideSpeed=u=>RULES.slideSpeed*(1-.55*clamp(u,0,1));
// The fastest legal speed at this moment, used by the room to validate movement.
export function allowedSpeed(p,now){
 if(now<(p.diveMoveUntil||0)+60)return RULES.diveSpeed;
 if(now<(p.slideUntil||0)+60)return RULES.slideSpeed;
 const rush=now<(p.rushUntil||0)+60;
 return RULES.sprint*(rush?RULES.rush:1)*1.1;
}
// Clip the shoulder camera against finite cylindrical cover, independently of render geometry.
export function cameraClearance(target,wanted,lists){
 let fraction=1;const dx=wanted.x-target.x,dz=wanted.z-target.z,dy=wanted.y-target.y,A=dx*dx+dz*dz;
 if(A<.0001)return wanted;
 for(const cover of lists)for(const o of cover){const r=o.r+.28,ox=target.x-o.x,oz=target.z-o.z;if(ox*ox+oz*oz>(Math.sqrt(A)+r)**2)continue;const B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-r*r;
  const disc=B*B-4*A*C;if(disc<0)continue;const sq=Math.sqrt(disc);
  const enter=(-B-sq)/(2*A),exit=(-B+sq)/(2*A);
  const t=clamp(enter,0,1);if(exit<=0||enter>1)continue;
  if(target.y+dy*t<o.h+.3)fraction=Math.min(fraction,Math.max(.12,t-.05));
 }
 return {x:target.x+dx*fraction,y:target.y+dy*fraction,z:target.z+dz*fraction};
}
