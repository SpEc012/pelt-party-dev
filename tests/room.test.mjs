import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../shared/room.mjs';
import {makeMap,seasonFor} from '../shared/content.mjs';
import {encodeWorld,decodeWorld,RemoteTrack} from '../shared/protocol.mjs';
import {makePelt,peltAt,payout,rateFor} from '../shared/physics.mjs';

const epoch=Date.UTC(2026,9,5,18);
const fill=(r,n)=>{for(let i=0;i<n;i++)r.join({name:`Player ${i}`},epoch);};
function playing(n=2){const r=new Room({now:epoch});fill(r,n);r.start(epoch);r.step(epoch+4000);for(const p of r.players)p.shieldUntil=0;return r;}
test('countdown starts at minimum, extends with joins, shortens ready, cancels below minimum',()=>{
 const r=new Room({publicRoom:true,now:epoch});fill(r,5);assert.equal(r.deadline,0);r.join({name:'Six'},epoch+500);assert.equal(r.deadline,epoch+20500);r.join({name:'Seven'},epoch+19000);assert.equal(r.deadline,epoch+29000);
 for(const p of r.humans)r.command(p.slot,{t:'ready',on:true},epoch+19500);assert.equal(r.deadline,epoch+24500);
 r.disconnect(0,epoch+20000);r.disconnect(1,epoch+20000);assert.equal(r.deadline,0);
});
test('bot fill waits twenty seconds and requires a strict human majority',()=>{const r=new Room({publicRoom:true,now:epoch});fill(r,3);r.command(0,{t:'fill'},epoch+19000);assert.equal(r.phase,'lobby');r.command(0,{t:'fill'},epoch+20001);assert.equal(r.phase,'lobby');r.command(1,{t:'fill'},epoch+20002);assert.equal(r.phase,'starting');assert.equal(r.active.length,6);assert.equal(r.active.filter(p=>p.bot).length,3);});
test('private host can start with one human, spectators cannot start or score',()=>{const r=new Room({now:epoch});fill(r,1);const watcher=r.join({name:'Watcher',spectator:true},epoch);assert.equal(r.command(watcher.slot,{t:'start'},epoch),false);r.command(0,{t:'start'},epoch);assert.equal(r.active.length,4);assert.equal(r.phase,'starting');});
test('disconnect migrates host and reconnect keeps seat',()=>{const r=new Room({now:epoch});fill(r,3);r.disconnect(0,epoch+100);assert.equal(r.host,1);assert.equal(r.reconnect(0,epoch+200),true);assert.equal(r.players[0].slot,0);assert.equal(r.players[0].connected,true);});
test('room rejects malformed poses, teleporting, old rounds and foreign score writes',()=>{const r=playing();assert.equal(r.command(0,{t:'snap',r:r.round,x:NaN,z:0,vx:0,vz:0,facing:0},epoch+5000),false);assert.equal(r.command(0,{t:'snap',r:r.round,x:10,z:10,vx:0,vz:0,facing:0},epoch+5000),false);assert.equal(r.command(0,{t:'throw',r:0,x:0,z:0},epoch+5000),false);assert.equal(r.command(0,{t:'score',score:1000},epoch+5000),false);assert.equal(r.players[0].score,0);});
test('a valid victim report damages once; forged geometry and teammates are rejected',()=>{
 const r=playing();const [a,b]=r.players;Object.assign(a,{x:-7,z:0});Object.assign(b,{x:-2,z:0});const tm=epoch+5000;
 assert.equal(r.command(0,{t:'throw',r:r.round,x:-2,z:0},tm),true);const p=r.pelts[0],impact=p.release+p.T*1000-60;
 assert.equal(r.command(1,{t:'hit',r:r.round,id:p.id,tm:impact},impact),true);assert.equal(b.hp,2);assert.equal(r.command(1,{t:'hit',r:r.round,id:p.id,tm:impact},impact),false);assert.equal(b.hp,2);
 a.nextThrow=0;r.command(0,{t:'throw',r:r.round,x:8,z:0},impact+500);const far=r.pelts.at(-1);assert.equal(r.hit(b,{id:far.id,tm:far.release+150},far.release+150),false);
 r.mode='team';b.team=a.team;assert.equal(r.hit(b,{id:far.id,tm:far.release+far.T*1000},far.release+far.T*1000),false);
});
test('forts charge ammunition and cannot overlap the builder or an ammo pile',()=>{const r=playing();const p=r.players[0];p.ammo=6;Object.assign(p,{x:-8,z:0,facing:0});assert.equal(r.command(0,{t:'fort',r:r.round},epoch+5000),true);assert.equal(p.ammo,3);assert.equal(r.forts.length,1);});
test('capacity is twenty players and ten spectators',()=>{const r=new Room({now:epoch,minPlayers:8});fill(r,30);assert.equal(r.active.length,20);assert.equal(r.players.filter(p=>p.spectator).length,10);assert.throws(()=>r.join({name:'Extra'},epoch),/full/);});
test('seasons respect UTC boundaries and January; override is allowlisted',()=>{assert.equal(seasonFor(new Date('2026-11-01T00:00:00Z')),'harvest');assert.equal(seasonFor(new Date('2026-10-31T23:59:59Z')),'halloween');assert.equal(seasonFor(new Date('2027-01-10T00:00:00Z')),'frost');assert.equal(seasonFor(new Date('2027-02-01T00:00:00Z')),'meadow');assert.equal(seasonFor(new Date(),'__proto__') in {halloween:1,harvest:1,frost:1,meadow:1},true);});
test('binary movement preserves a fast roll, rejects truncation, and fits the position budget',()=>{const r=playing(20);r.players[0].vx=15;const frame=encodeWorld(r.players,r.round,epoch);const decoded=decodeWorld(frame);assert.equal(decoded.players.length,20);assert.equal(decoded.players[0].vx,15);assert.equal(frame.byteLength,234);assert.ok(frame.byteLength*12<10000);assert.equal(decodeWorld(frame.slice(0,20)),null);assert.deepEqual([2,8,14,20].map(rateFor),[30,20,15,12]);});
test('remote motion has bounded extrapolation and snaps on teleports',()=>{const t=new RemoteTrack();t.push({x:0,z:0,vx:2,vz:0},1000,1000,20);t.push({x:.2,z:0,vx:2,vz:0},1100,1100,20);assert.ok(t.sample(10000).x<=.81);t.push({x:20,z:0,vx:0,vz:0},1200,1200,20);assert.equal(t.sample(1200).x,20);});
test('economy limits counted splats and halves bot rewards',()=>{assert.equal(payout({splats:100,place:1}),95);assert.equal(payout({splats:100,place:1,bots:true}),47);assert.equal(payout({splats:0,place:9,dailyEarned:395}),12);});
test('ballistic pelts reach the requested landing point and never need per-frame network positions',()=>{const p=makePelt('a',0,{x:0,z:0},{x:9,z:0},false,epoch);const end=peltAt(p,p.release+p.T*1000);assert.ok(Math.abs(end.y)<.001);assert.equal(end.x,9);});
test('map piles and spawns remain within bounds and outside cover at both sizes',()=>{for(const id of ['patch','hollow','cove'])for(const n of [8,20]){const m=makeMap(id,n);for(const p of m.piles){assert.ok(Math.abs(p.x)<m.width/2);assert.ok(Math.abs(p.z)<m.depth/2);assert.ok(m.props.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>o.r+.4));}}});
test('room checkpoint restores phases and rewards without serializing callbacks',()=>{const r=playing();r.players[0].score=4;const restored=Room.restore(r.save(),()=>{});assert.equal(restored.round,r.round);assert.equal(restored.players[0].score,4);restored.finish(epoch+10000);assert.equal(restored.phase,'results');assert.equal(restored.results[0].slot,0);});
test('team results award the team victory even when an opponent has the most individual points',()=>{
 const r=playing(4);r.mode='team';[4,7,4,0].forEach((n,i)=>r.players[i].score=n);r.finish(epoch+10000);
 assert.deepEqual(r.results.filter(p=>p.place===1).map(p=>p.slot).sort(),[0,2]);
 assert.equal(r.results.find(p=>p.slot===1).place,2);assert.equal(r.results[0].teamScore,8);
 const tie=playing(4);tie.mode='king';[2,4,2,0].forEach((n,i)=>tie.players[i].score=n);tie.finish(epoch+10000);
 assert.ok(tie.results.every(p=>p.draw&&p.place===1));
});
