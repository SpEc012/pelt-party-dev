import { Room } from '../shared/room.mjs';
import { CODE,TOKEN,roomCode,encodeWorld } from '../shared/protocol.mjs';
import { rateFor } from '../shared/physics.mjs';
import { seasonFor,SEASONS,BUILD } from '../shared/content.mjs';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const roomStub=(env,code)=>env.ROOMS.get(env.ROOMS.idFromName(code));
async function body(request){if(+(request.headers.get('Content-Length')||0)>4096)throw Error('Request too large.');const s=await request.text();if(s.length>4096)throw Error('Request too large.');return JSON.parse(s||'{}');}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    try{
      if(url.pathname==='/api/health')return json({ok:true,build:BUILD,transport:'websocket-durable-object'});
      if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/ws/')){
        const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'Please open the game directly.'},403);
      }
      if(url.pathname==='/api/rooms'&&request.method==='POST'){
        const input=await body(request);if(!TOKEN.test(input.token||''))return json({error:'Your browser profile is missing. Reload and try again.'},400);
        // Directory serializes allocation and bounds per-profile room creation.
        return env.DIRECTORY.get(env.DIRECTORY.idFromName('public')).fetch(new Request('https://directory/create',{method:'POST',body:JSON.stringify(input)}));
      }
      if(url.pathname==='/api/quick'&&request.method==='POST'){
        const input=await body(request);if(!TOKEN.test(input.token||''))return json({error:'Invalid browser profile.'},400);
        return env.DIRECTORY.get(env.DIRECTORY.idFromName('public')).fetch(new Request('https://directory/quick',{method:'POST',body:JSON.stringify(input)}));
      }
      const match=url.pathname.match(/^\/ws\/([A-Z0-9]{4})$/);
      if(match){if(!CODE.test(match[1]))return json({error:'That room code does not look right.'},400);return roomStub(env,match[1]).fetch(request);}
      if(url.pathname.startsWith('/api/'))return json({error:'Not found.'},404);
      return env.ASSETS.fetch(request);
    }catch(error){console.error(error.message);return json({error:'The room could not be reached. Please try again.'},503);}
  }
};

export class Directory {
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.rooms=new Map();this.limits=new Map();ctx.blockConcurrencyWhile(async()=>{this.rooms=new Map(await ctx.storage.get('rooms')||[]);});}
  async fetch(request){
    const url=new URL(request.url),input=await body(request),now=Date.now();
    if(url.pathname==='/report'){
      if(input.publicRoom&&input.phase==='lobby'&&input.players<20)this.rooms.set(input.code,{...input,updatedAt:now});else this.rooms.delete(input.code);
      await this.ctx.storage.put('rooms',[...this.rooms]);return json({ok:true});
    }
    const key=input.token,last=this.limits.get(key)||0;if(now-last<2000)return json({error:'One moment! Try again in a few seconds.'},429);this.limits.set(key,now);
    for(const [k,t]of this.limits)if(now-t>60000)this.limits.delete(k);
    const season=seasonFor(new Date(),input.season);
    if(url.pathname==='/quick'){
      const candidates=[...this.rooms.values()].filter(r=>r.season===season&&now-r.updatedAt<90000&&r.players<20).sort((a,b)=>b.players-a.players);
      for(const r of candidates){const response=await roomStub(this.env,r.code).fetch(new Request('https://room/status'));const status=await response.json();if(status.phase==='lobby'&&status.players<20)return json({code:r.code});this.rooms.delete(r.code);}
    }
    for(let attempt=0;attempt<10;attempt++){
      const bytes=crypto.getRandomValues(new Uint32Array(4));let i=0;const code=roomCode(()=>bytes[i++]/4294967296);
      const response=await roomStub(this.env,code).fetch(new Request('https://room/init',{method:'POST',body:JSON.stringify({code,season,publicRoom:url.pathname==='/quick',owner:input.token})}));
      if(response.ok)return json({code});
    }
    return json({error:'The pumpkin patch is busy. Please retry.'},503);
  }
}

export class PeltRoom {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.room=null;this.identities=new Map();this.buckets=new WeakMap();this.timer=null;this.lastWorld=0;this.lastPersist=0;this.lastReport=0;
    ctx.blockConcurrencyWhile(async()=>{const saved=await ctx.storage.get('checkpoint');if(saved){this.room=Room.restore(saved.room,m=>this.broadcast(m));this.identities=new Map(saved.identities);this.owner=saved.owner;this.ensureTick();}});
  }
  broadcast(m){const raw=typeof m==='string'||m instanceof ArrayBuffer?m:JSON.stringify(m);for(const ws of this.ctx.getWebSockets())try{ws.send(raw);}catch{ /* close handler owns presence */ }}
  async persist(){if(this.room)await this.ctx.storage.put('checkpoint',{room:this.room.save(),identities:[...this.identities],owner:this.owner});}
  async report(){if(!this.room)return;try{await this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName('public')).fetch(new Request('https://directory/report',{method:'POST',body:JSON.stringify({code:this.room.code,publicRoom:this.room.publicRoom,phase:this.room.phase,players:this.room.humans.length,season:this.room.season})}));}catch(error){console.error('directory',error.message);}}
  ensureTick(){
    if(!this.room?.running||this.timer)return;
    this.timer=setInterval(()=>{
      const now=Date.now();this.room.step(now);
      if(now-this.lastWorld>=1000/rateFor(this.room.active.length)){this.lastWorld=now;this.broadcast(encodeWorld(this.room.players,this.room.round,now));}
      if(now-this.lastPersist>5000){this.lastPersist=now;this.ctx.waitUntil(this.persist());}
      if(now-this.lastReport>10000){this.lastReport=now;this.ctx.waitUntil(this.report());}
      if(!this.room.running||!this.ctx.getWebSockets().length){clearInterval(this.timer);this.timer=null;this.ctx.waitUntil(this.persist());}
    },16);
  }
  async fetch(request){
    const url=new URL(request.url),now=Date.now();
    if(url.pathname==='/init'){
      if(this.room&&now-this.room.createdAt<24*3600000)return json({error:'Reserved'},409);
      const input=await body(request);this.owner=input.owner;this.room=new Room({...input,now,emit:m=>this.broadcast(m)});this.identities=new Map();await this.persist();return json({ok:true});
    }
    if(url.pathname==='/status')return json(this.room?{phase:this.room.phase,players:this.room.humans.length}:{phase:'gone',players:20});
    if(!this.room)return json({error:'That room has expired or does not exist.'},404);
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required'},426);
    const proto=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(s=>s.trim()).find(s=>s.startsWith('tok.'));const token=proto?.slice(4);
    if(!TOKEN.test(token||''))return json({error:'Missing profile'},401);
    let slot=this.identities.get(token),player=slot===undefined?null:this.room.players.find(p=>p.slot===slot&&p.identity===token);
    try{
      if(player){
        // Exactly one active socket per profile; older tab gets an explicit message.
        for(const old of this.ctx.getWebSockets())if(old.deserializeAttachment()?.slot===slot){old.serializeAttachment({...old.deserializeAttachment(),revoked:true});old.send(JSON.stringify({t:'replaced'}));old.close(4001,'Opened in another tab');}
        this.room.reconnect(slot,now);
      }else{
        player=this.room.join({name:url.searchParams.get('name'),character:url.searchParams.get('character'),hat:url.searchParams.get('hat'),spectator:url.searchParams.get('watch')==='1'},now);slot=player.slot;player.identity=token;this.identities.set(token,slot);
      }
      if(token===this.owner&&!player.spectator)this.room.host=slot;
    }catch(error){return json({error:error.message},409);}
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.ctx.acceptWebSocket(server);server.serializeAttachment({slot,token});
    server.send(JSON.stringify({t:'welcome',slot,...this.room.view(now)}));this.room.broadcast(now);await this.persist();this.ensureTick();await this.ctx.storage.setAlarm(now+30000);this.ctx.waitUntil(this.report());
    return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':proto}});
  }
  async webSocketMessage(ws,raw){
    if(typeof raw!=='string'||new TextEncoder().encode(raw).length>4096)return;
    let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m!=='object')return;
    const now=Date.now(),at=ws.deserializeAttachment();if(!at||at.revoked||!this.room||!this.room.players.some(p=>p.slot===at.slot&&p.identity===at.token))return;
    let b=this.buckets.get(ws);if(!b)this.buckets.set(ws,b={tokens:100,time:now});b.tokens=Math.min(100,b.tokens+(now-b.time)*.06);b.time=now;if(b.tokens<1)return;b.tokens--;
    if(m.t==='clk'&&Number.isFinite(m.c)){ws.send(JSON.stringify({t:'clk',c:m.c,now}));return;}
    if(m.t==='ping'){ws.send(JSON.stringify({t:'pong'}));return;}
    if(m.t==='leave'){ws.serializeAttachment({...at,revoked:true});this.room.leave(at.slot,now);this.identities.delete(at.token);ws.close(1000,'Left room');await this.persist();return;}
    this.room.command(at.slot,m,now);this.ensureTick();
    if(['start','ready','fill','settings'].includes(m.t)){await this.persist();this.ctx.waitUntil(this.report());}
  }
  async webSocketClose(ws){
    const at=ws.deserializeAttachment();if(!this.room||!at||at.revoked||!this.room.players.some(p=>p.slot===at.slot&&p.identity===at.token))return;
    // An old replaced tab must not disconnect its replacement.
    if(!this.ctx.getWebSockets().some(other=>other!==ws&&other.deserializeAttachment()?.slot===at.slot))this.room.disconnect(at.slot,Date.now());
    try{ws.close();}catch{}await this.persist();this.ctx.waitUntil(this.report());
  }
  async webSocketError(ws){await this.webSocketClose(ws);}
  async alarm(){if(!this.room)return;const now=Date.now();this.room.step(now);for(const [token,slot]of this.identities)if(!this.room.players.some(p=>p.slot===slot&&p.identity===token))this.identities.delete(token);await this.persist();await this.report();this.ensureTick();if(this.room.players.length)await this.ctx.storage.setAlarm(now+30000);}
}
