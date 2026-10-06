import {makeMap,spawnPoint,seasonFor,CHARACTERS,MAPS} from './content.mjs';
import {clamp,distance,makePelt,peltAt,sweptHit,moveBody,lineBlocked,payout,coverContact} from './physics.mjs';
import {safeName} from './protocol.mjs';

// Pure room model: no sockets, DOM, storage or timers. Used by the Worker, solo mode and tests.
export class Room {
  constructor({code='SOLO',publicRoom=false,season=seasonFor(),map='patch',minPlayers=publicRoom?6:4,now=Date.now(),emit=()=>{},random=Math.random}={}){
    this.code=code;this.publicRoom=publicRoom;this.season=season;this.mapId=map;this.minPlayers=clamp(Math.round(minPlayers),4,8);
    this.players=[];this.phase='lobby';this.round=0;this.host=null;this.deadline=0;this.createdAt=now;this.countdownStarted=0;this.waitSince=now;
    this.mode='ffa';this.duration=180000;this.startAt=0;this.endAt=0;this.results=[];this.pelts=[];this.forts=[];this.pads=[];this.map=makeMap(map);
    this.emit=emit;this.random=random;this.counter=0;this.seen=new Map();this.lastStep=now;this.lastKing=0;this.lastPulse=0;
  }
  get humans(){return this.players.filter(p=>!p.bot&&!p.spectator&&p.connected);}
  get active(){return this.players.filter(p=>!p.spectator);}
  get running(){return this.phase==='playing'||this.phase==='starting'||this.phase==='results'||!!this.deadline;}
  view(now){return {code:this.code,publicRoom:this.publicRoom,season:this.season,mapId:this.mapId,minPlayers:this.minPlayers,mode:this.mode,phase:this.phase,round:this.round,host:this.host,deadline:this.deadline,startAt:this.startAt,endAt:this.endAt,waitSince:this.waitSince,now,map:this.map,players:this.players.map(({slot,name,character,hat,bot,spectator,connected,ready,x,z,vx,vz,facing,hp,ammo,score,rollUntil,rollReady,shieldUntil,respawnAt,power,team,fill,crouch})=>({slot,name,character,hat,bot,spectator,connected,ready,x,z,vx,vz,facing,hp,ammo,score,rollUntil,rollReady,shieldUntil,respawnAt,power,team,fill,crouch})),pelts:this.pelts,forts:this.forts,pads:this.pads,results:this.results};}
  broadcast(now){this.emit({t:'state',...this.view(now)});}
  stats(p){this.emit({t:'stats',round:this.round,player:{slot:p.slot,hp:p.hp,ammo:p.ammo,score:p.score,rollUntil:p.rollUntil,rollReady:p.rollReady,shieldUntil:p.shieldUntil,respawnAt:p.respawnAt,power:p.power,x:p.x,z:p.z}});}
  join({name='Friend',character='pip',hat='none',spectator=false,bot=false},now){
    name=safeName(name);if(!name)throw Error('Pick a friendly name using letters and numbers.');
    if(this.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw Error('That name is already here. Try another.');
    if(this.active.length>=20)spectator=true;
    if(this.phase!=='lobby'&&this.phase!=='playing')spectator=true;
    if(this.phase==='playing'&&now>this.startAt+(this.endAt-this.startAt)*2/3)spectator=true;
    if(spectator&&this.players.filter(p=>p.spectator).length>=10)throw Error('This room is full, including the watch seats.');
    let slot=0;while(this.players.some(p=>p.slot===slot))slot++;
    if(slot>29)throw Error('This room is full.');
    const team=this.active.filter(p=>p.team===0).length<=this.active.filter(p=>p.team===1).length?0:1;
    const p={slot,name,character:CHARACTERS.some(c=>c.id===character)?character:'pip',hat:['none','pumpkin','witch','cat','crown'].includes(hat)?hat:'none',bot,spectator,connected:true,ready:false,team,fill:false,crouch:false,...spawnPoint(this.active.length,this.map),vx:0,vz:0,facing:0,hp:3,ammo:3,score:0,rollUntil:0,rollReady:0,shieldUntil:now+2000,respawnAt:0,power:null,nextThrow:0,nextThink:0,lastSnap:now,lastRefill:now,disconnectedAt:0};
    this.players.push(p);if(this.host===null&&!bot&&!spectator)this.host=slot;
    this.lobby(now,true);this.broadcast(now);return p;
  }
  reconnect(slot,now){const p=this.players.find(p=>p.slot===slot);if(!p)return false;p.connected=true;p.disconnectedAt=0;p.lastSnap=now;this.lobby(now);this.broadcast(now);return true;}
  disconnect(slot,now){const p=this.players.find(p=>p.slot===slot);if(!p)return;p.connected=false;p.disconnectedAt=now;p.vx=p.vz=0;if(slot===this.host)this.host=this.humans[0]?.slot??null;this.lobby(now);this.broadcast(now);}
  leave(slot,now){this.players=this.players.filter(p=>p.slot!==slot);if(slot===this.host)this.host=this.humans[0]?.slot??null;this.lobby(now);this.broadcast(now);}
  lobby(now,joined=false){
    if(this.phase!=='lobby')return;
    const n=this.humans.length;
    if(n<this.minPlayers){if(this.deadline)this.waitSince=now;this.deadline=0;this.countdownStarted=0;return;}
    if(!this.deadline){this.countdownStarted=now;this.deadline=now+20000;}
    else if(joined)this.deadline=Math.min(this.countdownStarted+45000,Math.max(this.deadline,now+10000));
    if(n===20||this.humans.every(p=>p.ready))this.deadline=Math.min(this.deadline,now+5000);
  }
  botsTo(n,now,difficulty='regular'){
    this.difficulty=difficulty;for(let i=this.active.length;i<Math.min(n,20);i++)this.join({name:['Bramble','Mochi','Pickle','Waffles','Clover','Acorn','Pudding','Pebble','Miso','Noodle','Maple','Biscuit','Sprout','Muffin','Sage','Button','Nutmeg','Pipkin','Poppy','Crumpet'][i]+' bot',character:CHARACTERS[i%4].id,bot:true,hat:i%3===0?'witch':i%3===1?'pumpkin':'none'},now);
  }
  start(now,{fill=false,size=this.minPlayers,difficulty='regular'}={}){
    if(this.phase!=='lobby')return;
    if(fill)this.botsTo(size,now,difficulty);
    if(this.active.length<2)return;
    this.round++;this.phase='starting';this.startAt=now+4000;this.endAt=this.startAt+(this.active.length>=12?240000:this.duration);this.deadline=0;
    this.map=makeMap(this.mapId,this.active.length);this.pelts=[];this.forts=[];this.seen.clear();this.results=[];this.pads=this.map.pads.map(p=>({...p,readyAt:this.startAt+15000}));
    this.mode=this.publicRoom&&this.active.length>=9?'team':this.mode;
    this.active.forEach((p,i)=>Object.assign(p,spawnPoint(i,this.map),{team:i%2,hp:3,ammo:3,score:0,vx:0,vz:0,ready:false,fill:false,respawnAt:0,rollUntil:0,rollReady:0,power:null,shieldUntil:this.startAt+2000,lastSnap:now,lastRefill:now}));
    this.startedHumans=this.humans.length;this.lastKing=this.startAt;this.lastStep=now;this.broadcast(now);
  }
  command(slot,m,now){
    const p=this.players.find(p=>p.slot===slot);if(!p||!p.connected||!m||typeof m.t!=='string')return false;
    if(m.t==='hi'){this.broadcast(now);return true;}
    if(p.spectator)return false;
    if(m.t==='ready'&&this.phase==='lobby'){p.ready=!!m.on;this.lobby(now);this.broadcast(now);return true;}
    if(m.t==='settings'&&this.phase==='lobby'&&slot===this.host&&!this.publicRoom){if(MAPS.some(x=>x.id===m.map))this.mapId=m.map;if(['ffa','team','king'].includes(m.mode))this.mode=m.mode;if(Number.isInteger(m.min))this.minPlayers=clamp(m.min,4,8);this.map=makeMap(this.mapId);this.lobby(now);this.broadcast(now);return true;}
    if(m.t==='start'&&slot===this.host&&!this.publicRoom){this.start(now,{fill:this.humans.length===1});return true;}
    if(m.t==='fill'&&this.phase==='lobby'&&now-this.waitSince>=20000){p.fill=true;if(this.humans.filter(p=>p.fill).length>this.humans.length/2)this.start(now,{fill:true});else this.broadcast(now);return true;}
    if(this.phase!=='playing'||m.r!==this.round||p.respawnAt)return false;
    if(m.t==='snap'){
      if(![m.x,m.z,m.facing,m.vx,m.vz].every(Number.isFinite))return false;
      const dt=clamp((now-p.lastSnap)/1000,0,.5),max=now<(p.rollMoveUntil||0)?18:m.crouch?3:7.5;
      if(Math.abs(m.x)>this.map.width/2||Math.abs(m.z)>this.map.depth/2||Math.hypot(m.vx,m.vz)>max+.5||distance(p,m)>max*dt+.65){this.emit({t:'correct',slot,x:p.x,z:p.z,round:this.round});return false;}
      const moved=moveBody(p,m.x-p.x,m.z-p.z,1,this.map,this.forts);
      Object.assign(p,moved,{facing:clamp(m.facing,-Math.PI*2,Math.PI*2),vx:m.vx,vz:m.vz,crouch:!!m.crouch,lastSnap:now});return true;
    }
    if(m.t==='throw')return this.throw(p,m,now);
    if(m.t==='hit')return this.hit(p,m,now);
    if(m.t==='roll'&&now>=p.rollReady){p.rollUntil=now+200;p.rollMoveUntil=now+280;p.rollReady=now+2200;this.stats(p);this.emit({t:'fx',kind:'roll',slot,x:p.x,z:p.z});return true;}
    if(m.t==='fort'&&p.ammo>=3&&this.forts.filter(f=>f.by===slot).length<3){const f={id:`f${++this.counter}`,by:slot,x:p.x+Math.sin(p.facing)*1.6,z:p.z+Math.cos(p.facing)*1.6,r:.9,h:1.3,hp:6,expires:now+20000};if(Math.abs(f.x)>this.map.width/2-1||Math.abs(f.z)>this.map.depth/2-1||this.map.props.some(o=>distance(o,f)<o.r+f.r)||this.active.some(o=>distance(o,f)<f.r+.5)||this.map.piles.some(o=>distance(o,f)<2))return false;p.ammo-=3;this.forts.push(f);this.stats(p);this.emit({t:'forts',round:this.round,forts:this.forts});return true;}
    if(m.t==='use'&&p.power){const power=p.power;p.power=null;if(power==='heal')p.hp=Math.min(3,p.hp+1);if(power==='shield')p.shieldUntil=now+8000;if(power==='triple')p.tripleUntil=now+8000;this.stats(p);this.emit({t:'fx',kind:power,slot,x:p.x,z:p.z});return true;}
    return false;
  }
  throw(p,m,now){
    if(![m.x,m.z].every(Number.isFinite)||now<p.nextThrow)return false;
    const charge=!!m.charge,cost=charge?2:1;if(p.ammo<cost||this.pelts.length>=120)return false;
    p.ammo-=cost;p.nextThrow=now+(charge?1000:420);p.shieldUntil=0;
    const id=`${this.round}-${p.slot}-${++this.counter}`,shot=makePelt(id,p.slot,p,{x:m.x,z:m.z,y:m.y},charge,now);
    this.pelts.push(shot);this.emit({t:'throw',round:this.round,pelt:shot,clientId:typeof m.id==='string'?m.id.slice(0,50):null});
    if(p.tripleUntil>now){p.tripleUntil=0;for(const angle of [-.18,.18]){const dx=shot.tx-p.x,dz=shot.tz-p.z,extra=makePelt(`${id}-${angle}`,p.slot,p,{x:p.x+dx*Math.cos(angle)-dz*Math.sin(angle),z:p.z+dx*Math.sin(angle)+dz*Math.cos(angle)},false,now);this.pelts.push(extra);this.emit({t:'throw',round:this.round,pelt:extra});}}
    this.stats(p);return true;
  }
  hit(victim,m,now){
    const shot=this.pelts.find(p=>p.id===m.id);if(!shot||this.seen.has(shot.id)||!Number.isFinite(m.tm)||m.tm>now+80||now-m.tm>500)return false;
    const by=this.players.find(p=>p.slot===shot.by);if(!by||victim.slot===by.slot||(this.mode!=='ffa'&&victim.team===by.team)||victim.respawnAt||victim.shieldUntil>m.tm||victim.rollUntil>m.tm)return false;
    if(m.tm<shot.release||m.tm>shot.release+shot.T*1000+100)return false;
    const a=peltAt(shot,m.tm-50),b=peltAt(shot,m.tm);
    if(!sweptHit(a,b,victim,.85))return false;
    // Check the entire ballistic path so a delayed report cannot pass through cover.
    for(let t=shot.release;t<m.tm;t+=25){const aa=peltAt(shot,t),bb=peltAt(shot,Math.min(t+25,m.tm));if([...this.map.props,...this.forts].some(o=>coverContact(aa,bb,o)!==null))return false;}
    this.damage(victim,by,shot.charge?2:1,now);this.impact(shot,b,now,victim.slot);return true;
  }
  damage(victim,by,n,now){
    if(victim.respawnAt||victim.shieldUntil>now||victim.rollUntil>now)return;
    victim.hp=Math.max(0,victim.hp-n);this.emit({t:'fx',kind:'hit',slot:victim.slot,x:victim.x,z:victim.z,by:by.slot});
    if(victim.hp===0){victim.respawnAt=now+3000;victim.vx=victim.vz=0;victim.power=null;if(this.mode!=='king')by.score++;this.stats(by);this.emit({t:'fx',kind:'splat',slot:victim.slot,by:by.slot,x:victim.x,z:victim.z});}
    else {const dx=victim.x-by.x,dz=victim.z-by.z,d=Math.hypot(dx,dz)||1;Object.assign(victim,moveBody(victim,dx/d*1.1,dz/d*1.1,1,this.map,this.forts));this.emit({t:'correct',slot:victim.slot,x:victim.x,z:victim.z,round:this.round});}
    this.stats(victim);
  }
  impact(shot,at,now,direct=-1){
    if(this.seen.has(shot.id))return;
    this.emit({t:'fx',kind:shot.charge?'burst':'impact',x:at.x,z:at.z,y:at.y,by:shot.by});
    if(shot.charge){const by=this.players.find(p=>p.slot===shot.by);if(by)for(const victim of this.active){
      if(victim.slot===direct||victim.slot===by.slot||victim.respawnAt||(this.mode!=='ffa'&&victim.team===by.team)||distance(victim,at)>2.7)continue;
      const a={x:at.x,y:Math.max(.3,at.y),z:at.z},b={x:victim.x,y:.8,z:victim.z};
      if([...this.map.props,...this.forts].some(o=>coverContact(a,b,o,0)!==null))continue;
      this.damage(victim,by,1,now);
    }}
    this.consume(shot,now);
  }
  consume(shot,now){this.seen.set(shot.id,now);this.pelts=this.pelts.filter(p=>p.id!==shot.id);this.emit({t:'remove',round:this.round,id:shot.id});}
  step(now){
    const dt=clamp((now-this.lastStep)/1000,0,.05);this.lastStep=now;
    for(const p of [...this.players])if(!p.connected&&!p.bot&&now-p.disconnectedAt>60000)this.leave(p.slot,now);
    for(const [id,time] of this.seen)if(now-time>10000)this.seen.delete(id);
    if(this.phase==='lobby'){this.lobby(now);if(this.deadline&&now>=this.deadline)this.start(now);return;}
    if(this.phase==='starting'){if(now>=this.startAt){this.phase='playing';this.broadcast(now);}else return;}
    if(this.phase==='results'){if(now>=this.deadline){this.phase='lobby';this.deadline=0;this.waitSince=now;this.players=this.players.filter(p=>!p.bot);for(const p of this.players)p.ready=false;this.lobby(now);this.broadcast(now);}return;}
    if(this.phase!=='playing')return;
    // Deliberate bot sessions continue; human-only games get a reconnect grace period.
    if(!this.active.some(p=>p.bot)&&this.startedHumans>=2&&this.humans.length<2){this.shortSince??=now;if(now-this.shortSince>60000){this.finish(now);return;}}else this.shortSince=null;
    for(const p of this.active){
      if(p.respawnAt){if(now>=p.respawnAt){Object.assign(p,spawnPoint(p.slot,this.map),{hp:3,ammo:3,respawnAt:0,shieldUntil:now+2000,lastSnap:now});this.stats(p);}else continue;}
      if(p.bot)this.bot(p,now,dt);
      if(this.map.piles.some(o=>distance(o,p)<1.4)&&p.ammo<6&&now-p.lastRefill>=(Math.floor((now-this.startAt)/1000)%45>=35?200:400)){p.lastRefill=now;p.ammo++;this.stats(p);}
      for(const pad of this.pads)if(pad.readyAt<=now&&!p.power&&distance(pad,p)<1){p.power=['triple','shield','heal'][Math.floor(this.random()*3)];pad.readyAt=now+20000;this.stats(p);this.emit({t:'pads',round:this.round,pads:this.pads});}
    }
    const fortsBefore=this.forts.length;this.forts=this.forts.filter(f=>f.expires>now&&f.hp>0);if(this.forts.length!==fortsBefore)this.emit({t:'forts',round:this.round,forts:this.forts});
    for(const shot of [...this.pelts]){
      if(now<shot.release)continue;
      const a=peltAt(shot,now-dt*1000),b=peltAt(shot,now);
      const contacts=[...this.map.props,...this.forts].map(o=>({o,t:coverContact(a,b,o)})).filter(c=>c.t!==null).sort((a,b)=>a.t-b.t);
      const contact=contacts[0];
      if(contact){const {o:cover,t}=contact,at={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};if(cover.hp){cover.hp-=shot.charge?3:1;this.emit({t:'fx',kind:cover.hp<=0?'break':'impact',x:cover.x,z:cover.z});this.forts=this.forts.filter(f=>f.hp>0);this.emit({t:'forts',round:this.round,forts:this.forts});}this.impact(shot,at,now);continue;}
      for(const p of this.active.filter(p=>p.bot))if(!p.respawnAt&&sweptHit(a,b,p))if(this.hit(p,{id:shot.id,tm:now},now))break;
      if(!this.seen.has(shot.id)&&now>=shot.release+shot.T*1000+(shot.charge?0:250))this.impact(shot,peltAt(shot,shot.release+shot.T*1000),now);
    }
    if(this.mode==='king'&&now-this.lastKing>=1000){this.lastKing=now;const k=Math.floor((now-this.startAt)/30000)%4,point=this.map.pads[k];const inside=this.active.filter(p=>!p.respawnAt&&distance(p,point)<3);if(inside.length&&inside.every(p=>p.team===inside[0].team)){const p=inside.sort((a,b)=>a.slot-b.slot)[0];p.score++;this.stats(p);}}
    const limit=this.mode==='ffa'?Math.min(30,8+this.active.length):this.mode==='king'?120:Math.min(60,15+2*this.active.length);
    const best=this.mode==='ffa'?Math.max(0,...this.active.map(p=>p.score)):Math.max(...[0,1].map(team=>this.active.filter(p=>p.team===team).reduce((n,p)=>n+p.score,0)));
    if(now>=this.endAt||best>=limit)this.finish(now);
  }
  bot(p,now,dt){
    const enemies=this.active.filter(q=>q.slot!==p.slot&&!q.respawnAt&&(this.mode==='ffa'||q.team!==p.team));
    const visible=enemies.filter(q=>!lineBlocked(p,q,this.map));const target=(visible.length?visible:enemies).sort((a,b)=>distance(a,p)-distance(b,p))[0];
    let goal=p.ammo<=1?[...this.map.piles].sort((a,b)=>distance(a,p)-distance(b,p))[0]:target;
    if(this.mode==='king'&&p.ammo>1)goal=this.map.pads[Math.floor(Math.max(0,now-this.startAt)/30000)%4];
    if(!goal)goal=this.map.piles[(p.slot+Math.floor(now/7000))%this.map.piles.length];
    const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),approach=p.ammo<=1||d>7?1:d<4?-1:.1;
    const sway=p.ammo>1?Math.sin(now/700+p.slot)*1.7:0;
    p.vx=(d?dx/d:0)*4*approach+(d?-dz/d:0)*sway;p.vz=(d?dz/d:0)*4*approach+(d?dx/d:0)*sway;
    const obstacle=[...this.map.props,...this.forts].find(o=>distance(o,p)<o.r+1.6&&((o.x-p.x)*p.vx+(o.z-p.z)*p.vz)>0);
    if(obstacle){const turn=p.slot%2?1:-1,ox=p.x-obstacle.x,oz=p.z-obstacle.z,od=Math.hypot(ox,oz)||1;p.vx=turn*-oz/od*4+ox/od;p.vz=turn*ox/od*4+oz/od;}
    if(now>=p.rollReady&&this.difficulty!=='rookie')for(const shot of this.pelts){if(shot.by===p.slot)continue;const future=peltAt(shot,now+180);if(distance(future,p)<1.8&&future.y<2){this.command(p.slot,{t:'roll',r:this.round},now);p.dodgeX=-Math.cos(p.facing)*(p.slot%2?1:-1);p.dodgeZ=Math.sin(p.facing)*(p.slot%2?1:-1);break;}}
    if(now<(p.rollMoveUntil||0)){p.vx=p.dodgeX*13;p.vz=p.dodgeZ*13;}
    Object.assign(p,moveBody(p,p.vx,p.vz,dt,this.map,this.forts));p.facing=target?Math.atan2(target.x-p.x,target.z-p.z):Math.atan2(dx,dz);p.lastSnap=now;
    if(now>=p.nextThink){const tier=this.difficulty==='ace'?2:this.difficulty==='rookie'?0:1;p.nextThink=now+[600,350,150][tier];if(target&&distance(target,p)<18&&p.ammo&&!lineBlocked(p,target,this.map)){const err=[.31,.16,.052][tier]*(this.random()*2-1),ang=Math.atan2(target.x-p.x,target.z-p.z)+err;this.throw(p,{x:target.x+(target.vx||0)*.3+Math.sin(ang)*err*3,z:target.z+(target.vz||0)*.3+Math.cos(ang)*err*3,y:.8,charge:tier===2&&p.ammo>=4&&this.random()<.22},now);}if(p.power)this.command(p.slot,{t:'use',r:this.round},now);}
  }
  finish(now){
    if(this.phase==='results')return;
    this.phase='results';this.deadline=now+12000;this.pelts=[];
    const totals=[0,1].map(team=>this.active.filter(p=>p.team===team).reduce((sum,p)=>sum+p.score,0));
    const teamGame=this.mode!=='ffa',draw=teamGame&&totals[0]===totals[1];
    const ordered=[...this.active].sort((a,b)=>(teamGame?totals[b.team]-totals[a.team]:0)||b.score-a.score||a.slot-b.slot);
    this.results=ordered.map((p,i)=>{
      const place=teamGame?(draw||totals[p.team]>totals[1-p.team]?1:2):i+1;
      return {slot:p.slot,name:p.name,score:p.score,team:p.team,teamScore:totals[p.team],draw,place,coins:payout({splats:p.score,place:draw?2:place,bots:this.active.some(p=>p.bot),players:this.active.length})};
    });this.broadcast(now);
  }
  save(){return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(this).filter(([k])=>!['emit','random','seen'].includes(k)))));}
  static restore(data,emit){const r=new Room({emit});Object.assign(r,data);r.emit=emit;r.seen=new Map();r.random=Math.random;return r;}
}
