import {clamp} from './physics.mjs';
export const TOKEN=/^[a-f0-9]{64}$/;
export const CODE=/^[BCDFGHJKMNPQRSTVWXYZ23456789]{4}$/;
export const ALPHABET='BCDFGHJKMNPQRSTVWXYZ23456789';
export function roomCode(random=Math.random){return Array.from({length:4},()=>ALPHABET[Math.floor(random()*ALPHABET.length)]).join('');}
export function safeName(value){
  const name=String(value||'').normalize('NFKC').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,16);
  if(!name)return null;
  if(/fuck|shit|nigg|bitch|cunt|https|www/i.test(name))return null;
  return name;
}
// Pose frame: version (1), round (4), shared server time (8), count (1), 11 bytes / player.
// 16-bit velocities avoid clipping the 15 m/s roll; measurements include this larger format.
export function encodeWorld(players,round,now){
  const list=players.filter(p=>!p.spectator),buf=new ArrayBuffer(14+list.length*11),v=new DataView(buf);
  v.setUint8(0,1);v.setUint32(1,round);v.setFloat64(5,now);v.setUint8(13,list.length);
  list.forEach((p,i)=>{const a=14+i*11;v.setUint8(a,p.slot);v.setInt16(a+1,Math.round(p.x*100));v.setInt16(a+3,Math.round(p.z*100));v.setUint8(a+5,Math.round(((p.facing||0)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)/(Math.PI*2)*255));v.setInt16(a+6,Math.round(clamp(p.vx||0,-30,30)*100));v.setInt16(a+8,Math.round(clamp(p.vz||0,-30,30)*100));v.setUint8(a+10,(p.rollUntil>now?1:0)|(p.respawnAt?2:0)|(p.crouch?4:0));});return buf;
}
export function decodeWorld(buf){
  const v=new DataView(buf);if(v.byteLength<14||v.getUint8(0)!==1)return null;
  const n=v.getUint8(13);if(n>20||v.byteLength!==14+n*11)return null;
  return {round:v.getUint32(1),now:v.getFloat64(5),players:Array.from({length:n},(_,i)=>{const a=14+i*11;return {slot:v.getUint8(a),x:v.getInt16(a+1)/100,z:v.getInt16(a+3)/100,facing:v.getUint8(a+5)/255*Math.PI*2,vx:v.getInt16(a+6)/100,vz:v.getInt16(a+8)/100,flags:v.getUint8(a+10)};})};
}
export class RemoteTrack {
  constructor(){this.samples=[];this.delay=125;}
  push(p,now,arrived,hz){const last=this.samples.at(-1);if(last&&now<=last.now)return;if(last&&Math.hypot(p.x-last.x,p.z-last.z)>6)this.samples=[];this.samples.push({...p,now});if(this.samples.length>24)this.samples.shift();const want=clamp(Math.max(1.5*1000/hz,arrived-now+1000/hz+10),100,250);this.delay+=(want-this.delay)*.15;}
  sample(now){if(!this.samples.length)return null;const t=now-this.delay,a=this.samples;let prev=a[0];for(const next of a){if(next.now>=t){const f=clamp((t-prev.now)/(next.now-prev.now||1),0,1);return {...next,x:prev.x+(next.x-prev.x)*f,z:prev.z+(next.z-prev.z)*f};}prev=next;}const dt=clamp(t-prev.now,0,300)/1000;return {...prev,x:prev.x+prev.vx*dt,z:prev.z+prev.vz*dt};}
}
