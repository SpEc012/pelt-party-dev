import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../shared/room.mjs';
import {encodeWorld} from '../shared/protocol.mjs';

function rng(seed){let s=seed;return()=>((s=Math.imul(s,1664525)+1013904223)>>>0)/4294967296;}
test('independent replicas receive matching results over delayed ordered events and recover from a disconnect',()=>{
 for(const count of [2,8,20])for(const latency of [0,50,100,200,300]){
  const random=rng(count+latency),epoch=1800000000000;let time=epoch,events=0;
  const views=Array.from({length:count},()=>null),inbox=[],tails=Array(count).fill(epoch);let disconnect=false;
  function enqueue(m,i){
   // WebSocket application events are reliable and ordered; pose loss is tested separately.
   if(disconnect&&i===0)return;
   const at=Math.max(tails[i]+.001,time+latency+random()*60);tails[i]=at;
   inbox.push({at,i,m:structuredClone(m)});
  }
  function deliver(until){
   inbox.sort((a,b)=>a.at-b.at);
   while(inbox.length&&inbox[0].at<=until){const {i,m}=inbox.shift();
    if(m.t==='state'){views[i]=m;continue;}
    const v=views[i];if(!v||m.round!==v.round)continue;
    if(m.t==='stats'){const p=v.players.find(p=>p.slot===m.player.slot);if(p)Object.assign(p,m.player);}
    if(m.t==='throw'&&!v.pelts.some(p=>p.id===m.pelt.id))v.pelts.push(m.pelt);
    if(m.t==='remove')v.pelts=v.pelts.filter(p=>p.id!==m.id);
   }
  }
  const room=new Room({now:epoch,random,emit:m=>{events++;for(let i=0;i<count;i++)enqueue(m,i);}});
  const watcher=room.join({name:'Observer',spectator:true},time);room.botsTo(count,time);room.start(time);room.endAt=epoch+64000;
  for(time=epoch;time<epoch+65000;time+=50){
   if(time===epoch+20000)disconnect=true;
   if(time===epoch+30000){disconnect=false;room.command(watcher.slot,{t:'hi'},time);}
   room.step(time);deliver(time);
  }
  room.finish(time);deliver(time+1000);
  assert.ok(events>20,'bots generated gameplay events');
  for(const v of views){assert.equal(v.phase,'results');assert.deepEqual(v.results,room.results);assert.equal(v.pelts.length,0);}
  assert.ok(encodeWorld(room.players,room.round,time).byteLength<400);
 }
});
test('ten full bot rooms run ten simulated minutes with bounded projectile and dedupe storage',()=>{
 const start=1800000000000;const rooms=Array.from({length:10},(_,i)=>new Room({now:start,random:rng(i+1)}));
 for(const r of rooms){r.join({name:'Observer',spectator:true},start);r.botsTo(20,start);r.start(start);r.endAt=start+601000;}
 for(let t=start;t<start+600000;t+=100)for(const r of rooms){r.step(t);assert.ok(r.pelts.length<=120);assert.ok(r.seen.size<2000);assert.ok(r.forts.length<=60);}
 for(const r of rooms)assert.ok(r.save().players.length<=30);
});
