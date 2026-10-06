import {makeMap,spawnPoint,seasonFor,MAPS,RULES,POWER_IDS,CHARACTER_IDS,HAT_IDS,CHARACTERS} from './content.mjs';
import {clamp,distance,makePelt,peltAt,sweptHit,moveBody,lineBlocked,payout,firstCover,flightEnd} from './physics.mjs';
import {allowedSpeed} from './controller.mjs';
import {safeName} from './protocol.mjs';

const BOT_NAMES=['Bramble','Mochi','Pickle','Waffles','Clover','Acorn','Pudding','Pebble','Miso','Noodle','Maple','Biscuit','Sprout','Muffin','Sage','Button','Nutmeg','Pipkin','Poppy','Crumpet'];
const PUBLIC=['slot','name','character','hat','bot','spectator','connected','ready','team','fill','crouch','x','z','vx','vz','facing','hp','ammo','score','dives','diveAt','diveSafeUntil','diveMoveUntil','slideUntil','slideReady','buildReady','shieldUntil','spawnSafeUntil','rushUntil','triple','giga','respawnAt','streak','scooping'];
const STATS=['slot','hp','ammo','score','dives','diveAt','slideReady','buildReady','shieldUntil','spawnSafeUntil','rushUntil','triple','giga','respawnAt','streak','x','z'];
const pick=(p,keys)=>{const o={};for(const k of keys)o[k]=p[k];return o;};
const MULTI=['', '', 'DOUBLE SPLAT', 'TRIPLE SPLAT', 'SPLATASTROPHE'];
const STREAK={3:'ON A ROLL',5:'SNOWSTORM',8:'ABOMINABLE',12:'LEGENDARY'};

// Pure room model: no sockets, DOM, storage or timers. Used by the Worker, solo mode and tests.
export class Room {
  constructor({code='SOLO',publicRoom=false,season=seasonFor(),map='commons',minPlayers=publicRoom?6:4,now=Date.now(),emit=()=>{},random=Math.random}={}){
    this.code=code;this.publicRoom=publicRoom;this.season=season;this.mapId=MAPS.some(m=>m.id===map)?map:'commons';this.minPlayers=clamp(Math.round(minPlayers),4,8);
    this.players=[];this.phase='lobby';this.round=0;this.host=null;this.deadline=0;this.createdAt=now;this.countdownStarted=0;this.waitSince=now;
    this.mode='ffa';this.duration=180000;this.startAt=0;this.endAt=0;this.results=[];this.pelts=[];this.forts=[];this.pads=[];this.map=makeMap(this.mapId);
    this.emit=emit;this.random=random;this.counter=0;this.seen=new Map();this.lastStep=now;this.lastKing=0;this.difficulty='regular';this.totalSplats=0;
  }
  get humans(){return this.players.filter(p=>!p.bot&&!p.spectator&&p.connected);}
  get active(){return this.players.filter(p=>!p.spectator);}
  get running(){return this.phase==='playing'||this.phase==='starting'||this.phase==='results'||!!this.deadline;}
  get cover(){return [this.map.props,this.forts];}
  frenzy(now){return this.phase==='playing'&&this.endAt-now<=RULES.frenzy;}
  view(now){return {code:this.code,publicRoom:this.publicRoom,season:this.season,mapId:this.mapId,minPlayers:this.minPlayers,mode:this.mode,phase:this.phase,round:this.round,host:this.host,deadline:this.deadline,startAt:this.startAt,endAt:this.endAt,waitSince:this.waitSince,difficulty:this.difficulty,now,map:this.map,players:this.players.map(p=>pick(p,PUBLIC)),pelts:this.pelts,forts:this.forts,pads:this.pads,results:this.results,awards:this.awards||[]};}
  broadcast(now){this.emit({t:'state',...this.view(now)});}
  stats(p){this.emit({t:'stats',round:this.round,player:pick(p,STATS)});}
  fx(m){this.emit({t:'fx',round:this.round,...m});}
  fresh(p,now){Object.assign(p,{hp:RULES.hp,ammo:RULES.startAmmo,vx:0,vz:0,respawnAt:0,dives:RULES.diveCharges,diveAt:0,diveSafeUntil:0,diveMoveUntil:0,slideUntil:0,slideReady:0,buildReady:0,shieldUntil:0,spawnSafeUntil:now+RULES.spawnShield,rushUntil:0,triple:0,giga:false,scooping:false,crouch:false,lastSnap:now,lastRefill:now,lastScoop:now,budget:3,knockUntil:0,kx:0,kz:0});}
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
    const p={slot,name,character:CHARACTER_IDS.includes(character)?character:'pip',hat:HAT_IDS.includes(hat)?hat:'none',bot,spectator,connected:true,ready:false,team,fill:false,...spawnPoint(this.active.length,this.map),facing:0,score:0,streak:0,multi:0,lastSplat:0,lastBy:-1,nextThrow:0,nextThink:0,disconnectedAt:0,stat:{throws:0,hits:0,taken:0,built:0,splats:0,best:0}};
    this.fresh(p,now);
    if(this.phase==='playing'&&!spectator){Object.assign(p,this.spawnFor(p,now));p.team=team;}
    this.players.push(p);if(this.host===null&&!bot&&!spectator)this.host=slot;
    this.lobby(now,true);this.broadcast(now);return p;
  }
  reconnect(slot,now){const p=this.players.find(p=>p.slot===slot);if(!p)return false;p.connected=true;p.disconnectedAt=0;p.lastSnap=now;this.lobby(now);this.broadcast(now);return true;}
  disconnect(slot,now){const p=this.players.find(p=>p.slot===slot);if(!p)return;p.connected=false;p.disconnectedAt=now;p.vx=p.vz=0;p.scooping=false;if(slot===this.host)this.host=this.humans[0]?.slot??null;this.lobby(now);this.broadcast(now);}
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
    this.difficulty=['rookie','regular','ace'].includes(difficulty)?difficulty:'regular';
    const taken=new Set(this.players.map(p=>p.name.toLowerCase()));let k=0;
    for(let i=this.active.length;i<Math.min(n,20);i++){let name;do{name=BOT_NAMES[(k++)%BOT_NAMES.length]+(k>BOT_NAMES.length?` ${Math.ceil(k/BOT_NAMES.length)}`:'');}while(taken.has(name.toLowerCase()));taken.add(name.toLowerCase());
      this.join({name,character:CHARACTERS[(i*3+1)%CHARACTERS.length].id,bot:true,hat:HAT_IDS[(i*5+2)%HAT_IDS.length]},now);}
  }
  start(now,{fill=false,size=this.minPlayers,difficulty=this.difficulty}={}){
    if(this.phase!=='lobby')return;
    if(fill)this.botsTo(size,now,difficulty);
    if(this.active.length<2)return;
    this.round++;this.phase='starting';this.startAt=now+4000;this.endAt=this.startAt+(this.active.length>=12?240000:this.duration);this.deadline=0;
    this.map=makeMap(this.mapId,this.active.length);this.pelts=[];this.forts=[];this.seen.clear();this.results=[];this.totalSplats=0;
    this.pads=this.map.pads.map((p,i)=>({...p,kind:POWER_IDS[(i+this.round)%POWER_IDS.length],readyAt:this.startAt+8000}));
    if(this.publicRoom&&this.active.length>=9)this.mode='team';
    this.active.forEach((p,i)=>{this.fresh(p,now);Object.assign(p,spawnPoint(i,this.map),{team:i%2,score:0,streak:0,multi:0,lastSplat:0,lastBy:-1,ready:false,fill:false,spawnSafeUntil:this.startAt+RULES.spawnShield,facing:i%2?-Math.PI/2:Math.PI/2,stat:{throws:0,hits:0,taken:0,built:0,splats:0,best:0}});});
    this.startedHumans=this.humans.length;this.lastKing=this.startAt;this.lastStep=now;this.broadcast(now);
  }
  command(slot,m,now){
    const p=this.players.find(p=>p.slot===slot);if(!p||!p.connected||!m||typeof m.t!=='string')return false;
    if(m.t==='hi'){this.broadcast(now);return true;}
    if(p.spectator)return false;
    if(m.t==='ready'&&this.phase==='lobby'){p.ready=!!m.on;this.lobby(now);this.broadcast(now);return true;}
    if(m.t==='settings'&&this.phase==='lobby'&&slot===this.host&&!this.publicRoom){if(MAPS.some(x=>x.id===m.map))this.mapId=m.map;if(['ffa','team','king'].includes(m.mode))this.mode=m.mode;if(['rookie','regular','ace'].includes(m.difficulty))this.difficulty=m.difficulty;if(Number.isInteger(m.min))this.minPlayers=clamp(m.min,4,8);this.map=makeMap(this.mapId);this.lobby(now);this.broadcast(now);return true;}
    if(m.t==='start'&&slot===this.host&&!this.publicRoom){this.start(now,{fill:this.humans.length===1,size:8});return true;}
    if(m.t==='fill'&&this.phase==='lobby'&&now-this.waitSince>=20000){p.fill=true;if(this.humans.filter(p=>p.fill).length>this.humans.length/2)this.start(now,{fill:true});else this.broadcast(now);return true;}
    if(this.phase!=='playing'||m.r!==this.round||p.respawnAt)return false;
    if(m.t==='snap')return this.snap(p,m,now);
    if(m.t==='throw')return this.throw(p,m,now);
    if(m.t==='hit')return this.hit(p,m,now);
    if(m.t==='dive')return this.dive(p,m,now);
    if(m.t==='slide'){if(now<p.slideReady)return false;p.slideUntil=now+RULES.slideTime;p.slideReady=p.slideUntil+RULES.slideCooldown;p.crouch=true;this.stats(p);this.fx({kind:'slide',slot,x:p.x,z:p.z});return true;}
    if(m.t==='build')return this.build(p,now);
    if(m.t==='scoop'){p.scooping=!!m.on;if(p.scooping)p.lastScoop=Math.max(p.lastScoop,now-RULES.scoopEvery*.5);return true;}
    return false;
  }
  snap(p,m,now){
    if(![m.x,m.z,m.facing,m.vx,m.vz].every(Number.isFinite))return false;
    const dt=clamp((now-p.lastSnap)/1000,0,.5),max=allowedSpeed(p,now)+(now<p.knockUntil?7:0);
    // A movement budget absorbs network bunching without letting anyone teleport.
    p.budget=Math.min(3.2,(p.budget??3)+max*dt);p.lastSnap=now;
    const moved=distance(p,m);
    if(Math.abs(m.x)>this.map.width/2||Math.abs(m.z)>this.map.depth/2||Math.hypot(m.vx,m.vz)>max+.6||moved>p.budget+.35){this.emit({t:'correct',slot:p.slot,x:p.x,z:p.z,round:this.round});return false;}
    p.budget-=moved;
    Object.assign(p,moveBody(p,m.x-p.x,m.z-p.z,1,this.map,this.forts),{facing:clamp(m.facing,-Math.PI*4,Math.PI*4),vx:m.vx,vz:m.vz,crouch:!!m.crouch||now<p.slideUntil});return true;
  }
  dive(p,m,now){
    const rush=now<p.rushUntil;if(p.dives<1&&!rush)return false;
    if(!rush){p.dives--;if(!p.diveAt)p.diveAt=now+RULES.diveRecharge;}
    p.diveSafeUntil=now+RULES.diveSafe;p.diveMoveUntil=now+RULES.diveMove;p.budget=Math.max(p.budget,1.5);p.scooping=false;
    const d=Math.hypot(m.x||0,m.z||0);p.diveDir=d>.1?{x:m.x/d,z:m.z/d}:{x:Math.sin(p.facing),z:Math.cos(p.facing)};
    this.stats(p);this.fx({kind:'dive',slot:p.slot,x:p.x,z:p.z});return true;
  }
  build(p,now){
    if(now<p.buildReady)return false;
    const fx=Math.sin(p.facing),fz=Math.cos(p.facing),rx=fz,rz=-fx,group=`w${++this.counter}`;let parts=[];
    // Try a few distances so a wall still goes up next to trees and arena edges.
    for(const reach of [1.75,2.5,1.25]){
      const tryParts=[];
      for(const [side,back] of [[-1.02,.32],[0,0],[1.02,.32]]){
        const s={id:`${group}-${tryParts.length}`,group,by:p.slot,team:p.team,kind:'wall',x:p.x+fx*(reach-back)+rx*side,z:p.z+fz*(reach-back)+rz*side,r:.56,h:1.18,hp:RULES.segmentHp,expires:now+RULES.wallLife,rot:p.facing,born:now};
        if(Math.abs(s.x)>this.map.width/2-.6||Math.abs(s.z)>this.map.depth/2-.6)continue;
        if(this.map.props.some(o=>distance(o,s)<o.r+s.r*.6)||this.forts.some(o=>distance(o,s)<o.r+s.r*.6))continue;
        if(this.active.some(o=>!o.respawnAt&&distance(o,s)<s.r+.44)||this.map.piles.some(o=>distance(o,s)<1.3))continue;
        tryParts.push(s);
      }
      if(tryParts.length>parts.length)parts=tryParts;if(parts.length===3)break;
    }
    if(!parts.length){this.fx({kind:'nobuild',slot:p.slot,x:p.x,z:p.z});return false;}
    const mine=[...new Set(this.forts.filter(f=>f.by===p.slot).map(f=>f.group))];
    if(mine.length>=RULES.wallsPerPlayer){const old=mine[0];this.forts=this.forts.filter(f=>f.group!==old);}
    this.forts.push(...parts);p.buildReady=now+RULES.buildCooldown;p.stat.built++;
    this.stats(p);this.emit({t:'forts',round:this.round,forts:this.forts});const mid=parts[Math.floor(parts.length/2)];this.fx({kind:'build',slot:p.slot,x:mid.x,z:mid.z});return true;
  }
  throw(p,m,now){
    if(![m.x,m.z].every(Number.isFinite)||now<p.nextThrow)return false;
    const charge=!!m.charge,giga=charge&&p.giga,cost=giga?0:charge?(this.frenzy(now)?1:2):1;if(p.ammo<cost||this.pelts.length>=160)return false;
    p.ammo-=cost;p.nextThrow=now+(charge?RULES.chargedCooldown:RULES.throwCooldown);p.spawnSafeUntil=0;p.scooping=false;if(giga)p.giga=false;p.stat.throws++;
    const id=`${this.round}-${p.slot}-${++this.counter}`,shot=makePelt(id,p.slot,p,{x:m.x,z:m.z,y:m.y},charge,now);if(giga)shot.giga=true;
    this.pelts.push(shot);this.emit({t:'throw',round:this.round,pelt:shot,clientId:typeof m.id==='string'?m.id.slice(0,50):null});
    if(p.triple>0&&!charge){p.triple--;for(const angle of [-.16,.16]){const dx=shot.tx-p.x,dz=shot.tz-p.z,extra=makePelt(`${id}${angle>0?'r':'l'}`,p.slot,p,{x:p.x+dx*Math.cos(angle)-dz*Math.sin(angle),z:p.z+dx*Math.sin(angle)+dz*Math.cos(angle),y:m.y},false,now);this.pelts.push(extra);this.emit({t:'throw',round:this.round,pelt:extra});}}
    this.stats(p);return true;
  }
  hit(victim,m,now){
    const shot=this.pelts.find(p=>p.id===m.id);if(!shot||this.seen.has(shot.id)||!Number.isFinite(m.tm)||m.tm>now+80||now-m.tm>500)return false;
    const by=this.players.find(p=>p.slot===shot.by);if(!by||victim.slot===by.slot||(this.mode!=='ffa'&&victim.team===by.team)||victim.respawnAt)return false;
    if(m.tm<shot.release||m.tm>flightEnd(shot)+100)return false;
    const a=peltAt(shot,m.tm-50),b=peltAt(shot,m.tm);
    if(!sweptHit(a,b,victim,.9))return false;
    // Check the entire ballistic path so a delayed report cannot pass through cover.
    for(let t=shot.release;t<m.tm;t+=25){if(firstCover(peltAt(shot,t),peltAt(shot,Math.min(t+25,m.tm)),this.cover))return false;}
    if(victim.diveSafeUntil>m.tm){this.fx({kind:'dodge',slot:victim.slot,x:victim.x,z:victim.z});return false;}
    this.damage(victim,by,shot.charge?2:1,now,shot);this.impact(shot,b,now,victim.slot);return true;
  }
  damage(victim,by,n,now,shot){
    if(victim.respawnAt||victim.spawnSafeUntil>now||victim.diveSafeUntil>now)return;
    if(victim.shieldUntil>now){this.fx({kind:'block',slot:victim.slot,by:by.slot,x:victim.x,z:victim.z});return;}
    victim.hp=Math.max(0,victim.hp-n);victim.stat.taken+=n;by.stat.hits++;victim.scooping=false;
    const dx=victim.x-(shot?.x??by.x),dz=victim.z-(shot?.z??by.z),d=Math.hypot(dx,dz)||1;victim.knockUntil=now+450;
    if(victim.bot){victim.kx=dx/d*7;victim.kz=dz/d*7;}
    this.fx({kind:'hit',slot:victim.slot,x:victim.x,z:victim.z,by:by.slot,dx:dx/d,dz:dz/d,n,hp:victim.hp});
    if(victim.hp===0)this.splat(victim,by,now);
    this.stats(victim);
  }
  splat(victim,by,now){
    victim.respawnAt=now+RULES.respawn;victim.vx=victim.vz=0;victim.scooping=false;
    const ended=victim.streak;victim.streak=0;victim.lastBy=by.slot;
    if(this.mode!=='king')by.score++;by.stat.splats++;by.streak++;by.stat.best=Math.max(by.stat.best,by.streak);
    by.multi=now-by.lastSplat<3500?by.multi+1:1;by.lastSplat=now;
    const calls=[];
    if(this.totalSplats++===0)calls.push('FIRST SPLAT');
    if(by.multi>=2)calls.push(MULTI[Math.min(4,by.multi)]);
    if(STREAK[by.streak])calls.push(STREAK[by.streak]);
    if(ended>=3)calls.push('SHUTDOWN');
    if(by.lastBy===victim.slot){calls.push('PAYBACK');by.lastBy=-1;}
    this.fx({kind:'splat',slot:victim.slot,by:by.slot,x:victim.x,z:victim.z,streak:by.streak,calls});
    this.stats(by);
  }
  impact(shot,at,now,direct=-1){
    if(this.seen.has(shot.id))return;
    this.fx({kind:shot.charge?'burst':'impact',x:at.x,z:at.z,y:at.y,by:shot.by,giga:!!shot.giga});
    if(shot.charge){const by=this.players.find(p=>p.slot===shot.by),radius=shot.giga?4.6:3;if(by)for(const victim of this.active){
      if(victim.slot===direct||victim.slot===by.slot||victim.respawnAt||(this.mode!=='ffa'&&victim.team===by.team)||distance(victim,at)>radius)continue;
      if(firstCover({x:at.x,y:Math.max(.3,at.y),z:at.z},{x:victim.x,y:.8,z:victim.z},this.cover,0))continue;
      this.damage(victim,by,1,now,{x:at.x,z:at.z});
    }}
    this.consume(shot,now);
  }
  consume(shot,now){this.seen.set(shot.id,now);this.pelts=this.pelts.filter(p=>p.id!==shot.id);this.emit({t:'remove',round:this.round,id:shot.id});}
  spawnFor(p,now){
    const enemies=this.active.filter(q=>q.slot!==p.slot&&!q.respawnAt&&(this.mode==='ffa'||q.team!==p.team));
    let list=this.map.spawns;if(this.mode!=='ffa')list=list.filter(s=>s.side===(p.team?1:-1));
    let best=list[0],score=-1;for(const s of list){const d=Math.min(60,...enemies.map(q=>distance(q,s)))+this.random()*3;if(d>score){score=d;best=s;}}
    return {x:best.x,z:best.z};
  }
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
    const frenzy=this.frenzy(now);
    for(const p of this.active){
      if(p.respawnAt){if(now>=p.respawnAt){this.fresh(p,now);Object.assign(p,this.spawnFor(p,now));this.stats(p);this.fx({kind:'spawn',slot:p.slot,x:p.x,z:p.z});}else continue;}
      if(p.diveAt&&now>=p.diveAt){p.dives=Math.min(RULES.diveCharges,p.dives+1);p.diveAt=p.dives<RULES.diveCharges?now+RULES.diveRecharge:0;this.stats(p);}
      if(p.bot)this.bot(p,now,dt);
      if(p.ammo<RULES.maxAmmo){
        const atPile=this.map.piles.some(o=>Math.abs(o.x-p.x)<1.9&&Math.abs(o.z-p.z)<1.9&&distance(o,p)<1.9);
        if(atPile&&now-p.lastRefill>=RULES.pileEvery*(frenzy?.5:1)){p.lastRefill=now;p.ammo++;this.stats(p);}
        else if(p.scooping&&Math.hypot(p.vx||0,p.vz||0)<RULES.crouch+.6&&now-p.lastScoop>=RULES.scoopEvery*(frenzy?.6:1)){p.lastScoop=now;p.ammo++;this.stats(p);}
      }else if(p.scooping)p.lastScoop=now;
      for(const pad of this.pads)if(pad.readyAt<=now&&distance(pad,p)<1.35)this.pickup(p,pad,now);
    }
    const before=this.forts.length;this.forts=this.forts.filter(f=>f.expires>now&&f.hp>0);if(this.forts.length!==before)this.emit({t:'forts',round:this.round,forts:this.forts});
    const a={},b={};
    for(const shot of [...this.pelts]){
      if(now<shot.release)continue;
      peltAt(shot,now-dt*1000-1,a);peltAt(shot,now,b);
      const contact=firstCover(a,b,this.cover);
      if(contact){const {o:cover,t}=contact,at={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
        if(cover.hp){cover.hp-=shot.charge?3:1;this.fx({kind:cover.hp<=0?'break':'thud',x:cover.x,z:cover.z,y:at.y});if(cover.hp<=0)this.forts=this.forts.filter(f=>f.hp>0);this.emit({t:'forts',round:this.round,forts:this.forts});}
        this.impact(shot,at,now);continue;}
      for(const p of this.active)if(p.bot&&!p.respawnAt&&p.slot!==shot.by&&sweptHit(a,b,p)){if(this.hit(p,{id:shot.id,tm:now},now))break;}
      if(!this.seen.has(shot.id)&&now>=flightEnd(shot))this.impact(shot,peltAt(shot,flightEnd(shot)),now);
    }
    if(this.mode==='king'&&now-this.lastKing>=1000){this.lastKing=now;const point=this.hill(now);const inside=this.active.filter(p=>!p.respawnAt&&distance(p,point)<3.2);
      if(inside.length&&inside.every(p=>p.team===inside[0].team)){const p=inside.sort((a,b)=>a.slot-b.slot)[0];p.score++;this.stats(p);}}
    const limit=this.scoreLimit();
    const best=this.mode==='ffa'?Math.max(0,...this.active.map(p=>p.score)):Math.max(...[0,1].map(team=>this.active.filter(p=>p.team===team).reduce((n,p)=>n+p.score,0)));
    if(now>=this.endAt||best>=limit)this.finish(now);
  }
  scoreLimit(){return this.mode==='ffa'?Math.min(25,10+this.active.length):this.mode==='king'?120:Math.min(60,15+2*this.active.length);}
  hill(now){return this.map.pads[Math.floor(Math.max(0,now-this.startAt)/30000)%this.map.pads.length];}
  pickup(p,pad,now){
    const kind=pad.kind;
    if(kind==='heal'&&p.hp>=RULES.hp)return;
    if(kind==='triple')p.triple=3;if(kind==='shield')p.shieldUntil=now+RULES.shieldTime;if(kind==='heal')p.hp=RULES.hp;if(kind==='giga'){p.giga=true;p.ammo=Math.max(p.ammo,2);}if(kind==='rush'){p.rushUntil=now+RULES.rushTime;p.dives=RULES.diveCharges;p.diveAt=0;}
    const options=POWER_IDS.filter(k=>k!==kind);pad.kind=options[Math.floor(this.random()*options.length)];pad.readyAt=now+RULES.padRespawn;
    this.stats(p);this.emit({t:'pads',round:this.round,pads:this.pads});this.fx({kind:'power',power:kind,slot:p.slot,x:pad.x,z:pad.z});
  }
  // Bots play by the same rules as people: they move, dive, build, scoop and must have ammo.
  bot(p,now,dt){
    const tier=this.difficulty==='ace'?2:this.difficulty==='rookie'?0:1;
    const enemies=this.active.filter(q=>q.slot!==p.slot&&!q.respawnAt&&(this.mode==='ffa'||q.team!==p.team));
    if(now>=(p.retarget||0)){p.retarget=now+700+this.random()*500;let best=null,bs=Infinity;for(const q of enemies){const d=distance(q,p),blocked=d>26||lineBlocked(p,q,this.map,this.forts);const s=d+(blocked?14:0)+q.hp*2+(q.slot===p.targetSlot?-4:0);if(s<bs){bs=s;best=q;}}p.targetSlot=best?.slot??-1;p.targetSeen=best&&!lineBlocked(p,best,this.map,this.forts);}
    const target=enemies.find(q=>q.slot===p.targetSlot);
    if(now>=(p.strafeAt||0)){p.strafe=this.random()<.5?-1:1;p.strafeAt=now+1200+this.random()*1800;}
    let goal=null,mode='fight';
    const pad=this.pads.filter(o=>o.readyAt<=now&&distance(o,p)<11&&!(o.kind==='heal'&&p.hp>=RULES.hp)).sort((a,b)=>distance(a,p)-distance(b,p))[0];
    if(p.ammo<=1||p.reloading&&p.ammo<5){p.reloading=p.ammo<5;const pile=[...this.map.piles].sort((a,b)=>distance(a,p)-distance(b,p))[0];if(pile&&distance(pile,p)<15){goal=pile;mode='pile';}else mode='scoop';}else p.reloading=false;
    if(mode==='fight'&&pad)goal=pad,mode='pad';
    if(mode==='fight'&&this.mode==='king')goal=this.hill(now),mode='hill';
    let wx=0,wz=0;
    if(now<(p.holdUntil||0)){p.crouch=true;}
    else if(mode==='scoop'){p.crouch=true;}
    else{
      p.crouch=false;
      if(goal){const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz)||1;wx=dx/d;wz=dz/d;if(d<(mode==='hill'?1.6:.6)){wx*=.2;wz*=.2;}}
      else if(target){const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1,want=[8,10,12][tier],radial=d>want+3?1:d<want-3?-.8:0,sw=d>want+8||!p.targetSeen?.25:.9;wx=dx/d*radial-dz/d*p.strafe*sw;wz=dz/d*radial+dx/d*p.strafe*sw;}
      else{const wander=this.map.pads[(p.slot+Math.floor(now/6000))%this.map.pads.length];wx=wander.x-p.x;wz=wander.z-p.z;}
      if(now<(p.detourUntil||0)){wx=p.detour.x;wz=p.detour.z;}
      const m=Math.hypot(wx,wz)||1;wx/=m;wz/=m;
      // Steer around cover in the way.
      for(const list of this.cover)for(const o of list){const ox=o.x-p.x,oz=o.z-p.z,od=Math.hypot(ox,oz);if(od>o.r+1.7||ox*wx+oz*wz<=0)continue;if(p.avoidId!==o.id){p.avoidId=o.id;p.avoidSide=(ox*wz-oz*wx)>0?-1:1;}const side=p.avoidSide;wx+=-oz/od*side*1.4;wz+=ox/od*side*1.4;const n=Math.hypot(wx,wz)||1;wx/=n;wz/=n;break;}
    }
    p.scooping=(mode==='scoop'||now<(p.holdUntil||0)&&p.ammo<4)&&p.ammo<RULES.maxAmmo;
    const far=goal?distance(goal,p)>12:target?distance(target,p)>18:false;
    const speed=(p.crouch?RULES.crouch:far?RULES.sprint*.95:RULES.run*.92)*(now<p.rushUntil?RULES.rush:1)*[.82,.92,1][tier];
    let tvx=wx*speed,tvz=wz*speed;
    if(now<p.diveMoveUntil){const u=1-(p.diveMoveUntil-now)/RULES.diveMove;tvx=p.diveDir.x*RULES.diveSpeed*(1-.42*u);tvz=p.diveDir.z*RULES.diveSpeed*(1-.42*u);p.vx=tvx;p.vz=tvz;}
    else{const k=1-Math.exp(-10*dt);p.vx+=(tvx-p.vx)*k;p.vz+=(tvz-p.vz)*k;}
    let mvx=p.vx,mvz=p.vz;if(now<p.knockUntil){mvx+=p.kx;mvz+=p.kz;p.kx*=Math.exp(-8*dt);p.kz*=Math.exp(-8*dt);}
    Object.assign(p,moveBody(p,mvx,mvz,dt,this.map,this.forts));
    if(target)p.facing=Math.atan2(target.x-p.x,target.z-p.z);else if(Math.hypot(p.vx,p.vz)>.5)p.facing=Math.atan2(p.vx,p.vz);
    p.lastSnap=now;
    // Unstick: if a bot barely moves while trying to, pick a new strafe.
    if(!p.anchor||now-p.anchor.t>900){const moved=p.anchor?Math.hypot(p.x-p.anchor.x,p.z-p.anchor.z):9;p.stuckT=moved<1.2&&Math.hypot(wx,wz)>.5&&!p.crouch?1:0;p.anchor={x:p.x,z:p.z,t:now};}else p.stuckT=0;if(p.stuckT){p.strafe*=-1;p.stuckT=0;p.strafeAt=now+1500;const a=this.random()*Math.PI*2;p.detour={x:Math.sin(a)-p.x/this.map.width,z:Math.cos(a)-p.z/this.map.depth};p.detourUntil=now+700;}
    // Dodge incoming pelts with a dive.
    if(now>=(p.dodgeThink||0)&&now>=p.diveMoveUntil&&(p.dives>0||now<p.rushUntil)){p.dodgeThink=now+120;
      for(const shot of this.pelts){if(shot.by===p.slot||now<shot.release)continue;const by=this.players.find(q=>q.slot===shot.by);if(this.mode!=='ffa'&&by?.team===p.team)continue;
        const future=peltAt(shot,now+260);if(future.y<2&&distance(future,p)<1.5&&this.random()<[.05,.14,.26][tier]){const sx=shot.tx-shot.x,sz=shot.tz-shot.z,sd=Math.hypot(sx,sz)||1,side=this.random()<.5?-1:1;this.dive(p,{x:-sz/sd*side,z:sx/sd*side},now);break;}}}
    // Throw a quick wall when under fire.
    if(target&&now>=p.buildReady&&now>=(p.botBuildAt||0)&&p.targetSeen&&distance(target,p)<17&&now<p.knockUntil+800){p.botBuildAt=now+7000+this.random()*7000;if(this.random()<.35+.15*tier){p.facing=Math.atan2(target.x-p.x,target.z-p.z);if(this.build(p,now))p.holdUntil=now+700+this.random()*600;}}
    if(now>=p.nextThink){p.nextThink=now+[560,340,200][tier]+this.random()*120;
      if(target&&p.ammo&&now>=p.nextThrow&&distance(target,p)<[18,22,26][tier]&&p.targetSeen&&now>=(p.holdUntil||0)-500){
        const d=distance(target,p),charge=(p.giga||tier>=1&&p.ammo>=3&&d>13&&this.random()<[0,.18,.3][tier]),T=charge?.14+.017*d:.15+.021*d,lead=[.35,.7,.95][tier];
        const err=[.07,.04,.02][tier]*(this.random()*2-1),aimX=target.x+(target.vx||0)*T*lead,aimZ=target.z+(target.vz||0)*T*lead,ang=Math.atan2(aimX-p.x,aimZ-p.z)+err,dist=Math.hypot(aimX-p.x,aimZ-p.z)*(1+(this.random()-.5)*[.12,.07,.035][tier]);
        p.scooping=false;this.throw(p,{x:p.x+Math.sin(ang)*dist,z:p.z+Math.cos(ang)*dist,y:target.crouch?.6:.95,charge},now);}}
  }
  finish(now){
    if(this.phase==='results')return;
    this.phase='results';this.deadline=now+14000;this.pelts=[];
    const totals=[0,1].map(team=>this.active.filter(p=>p.team===team).reduce((sum,p)=>sum+p.score,0));
    const teamGame=this.mode!=='ffa',draw=teamGame&&totals[0]===totals[1];
    const ordered=[...this.active].sort((a,b)=>(teamGame?totals[b.team]-totals[a.team]:0)||b.score-a.score||a.slot-b.slot);
    const award=(key,fn,min=1)=>{let best=null,v=-Infinity;for(const p of this.active){const n=fn(p);if(n>v){v=n;best=p;}}return best&&v>=min?{key,slot:best.slot,value:Math.round(v*100)/100}:null;};
    const awards=[award('mvp',p=>p.stat.splats),award('sharpshooter',p=>p.stat.throws>=5?p.stat.hits/p.stat.throws:0,.01),award('architect',p=>p.stat.built),award('streak',p=>p.stat.best,3),award('untouchable',p=>-p.stat.taken,-Infinity)].filter(Boolean);
    this.results=ordered.map((p,i)=>{
      const place=teamGame?(draw||totals[p.team]>totals[1-p.team]?1:2):i+1;
      return {slot:p.slot,name:p.name,bot:p.bot,character:p.character,score:p.score,team:p.team,teamScore:totals[p.team],draw,place,stat:{...p.stat},coins:payout({splats:p.score,place:draw?2:place,bots:this.active.some(p=>p.bot),players:this.active.length})};
    });this.awards=awards;this.broadcast(now);
  }
  save(){return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(this).filter(([k])=>!['emit','random','seen'].includes(k)))));}
  static restore(data,emit){const r=new Room({emit});Object.assign(r,data);r.emit=emit;r.seen=new Map();r.random=Math.random;return r;}
}
