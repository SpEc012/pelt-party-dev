import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {decodeWorld} from '../shared/protocol.mjs';
const base=process.env.PELT_URL||'http://127.0.0.1:8787';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const token=()=>randomBytes(32).toString('hex');
async function waitFor(fn,message,timeout=10000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error(message);await pause(20);}return fn();}
async function create(t){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t,season:'halloween'})});assert.equal(response.status,200);return(await response.json()).code;}
async function seat(code,t,name,watch=false,acct=null){const url=new URL(`/ws/${code}`,base);url.protocol='ws:';url.search=new URLSearchParams({name,watch:watch?'1':'0',character:'pip'});const ws=new WebSocket(url,['tok.'+t,...(acct?['acct.'+acct]:[])]);ws.binaryType='arraybuffer';const c={ws,token:t,name,messages:[],frames:[],bytes:0,state:null,slot:null};ws.onmessage=e=>{c.bytes+=typeof e.data==='string'?Buffer.byteLength(e.data):e.data.byteLength;if(e.data instanceof ArrayBuffer){c.frames.push(decodeWorld(e.data));if(c.frames.length>300)c.frames.shift();return;}const m=JSON.parse(e.data);c.messages.push(m);if(m.t==='welcome')c.slot=m.slot;if(m.t==='state'||m.t==='welcome')c.state=m;};await waitFor(()=>c.slot!==null,'WebSocket welcome missing');return c;}
const clients=[];
try{
 const firstToken=token(),code=await create(firstToken);const a=await seat(code,firstToken,'Host'),b=await seat(code,token(),'Guest');clients.push(a,b);
 a.ws.send(JSON.stringify({t:'clk',c:Date.now()}));const clock=await waitFor(()=>a.messages.find(m=>m.t==='clk'),'clock ping missing');const localRtt=Date.now()-clock.c;
 a.ws.send(JSON.stringify({t:'start'}));await waitFor(()=>a.state.phase==='playing'&&b.state.phase==='playing','match did not start');assert.equal(a.state.startAt,b.state.startAt);assert.equal(a.state.round,b.state.round);
 const player=a.state.players.find(p=>p.slot===a.slot),x=player.x+.2;a.ws.send(JSON.stringify({t:'snap',r:a.state.round,x,z:player.z,vx:0,vz:0,facing:1}));
 await waitFor(()=>b.frames.some(f=>Math.abs(f.players.find(p=>p.slot===a.slot)?.x-x)<.02),'movement not relayed');
 a.ws.send(JSON.stringify({t:'score',r:a.state.round,score:999,by:b.slot}));await pause(100);assert.equal(a.state.players.find(p=>p.slot===a.slot).score,0);
 const original=b.slot;b.ws.close();await pause(100);const rejoined=await seat(code,b.token,b.name);clients.push(rejoined);assert.equal(rejoined.slot,original);assert.equal(rejoined.state.round,a.state.round);
 const replacement=await seat(code,b.token,b.name);clients.push(replacement);await waitFor(()=>rejoined.messages.some(m=>m.t==='replaced'),'old tab was not replaced');await pause(100);replacement.ws.send(JSON.stringify({t:'hi'}));await waitFor(()=>replacement.state.players.find(p=>p.slot===original)?.connected,'replacement seat disconnected');assert.equal(replacement.slot,original);
 console.log(JSON.stringify({test:'two real WebSocket clients',code,localRttMs:localRtt,sharedStart:true,movement:true,sameSeatReconnect:true}));
 for(const c of clients)c.ws.close();clients.length=0;
 const scaleToken=token(),scaleCode=await create(scaleToken);
 for(let i=0;i<30;i++)clients.push(await seat(scaleCode,i===0?scaleToken:token(),`Seat ${i}`,i>=20));
 assert.equal(clients[0].state.players.filter(p=>!p.spectator).length,20);assert.equal(clients[0].state.players.filter(p=>p.spectator).length,10);
 clients[0].ws.send(JSON.stringify({t:'start'}));await waitFor(()=>clients.every(c=>c.state.phase==='playing'),'30-seat room failed to start');for(const c of clients)c.bytes=0;await pause(2500);
 const kb=clients.map(c=>c.bytes/2500);assert.ok(Math.max(...kb)<10,`steady idle bandwidth over target: ${Math.max(...kb)} KB/s`);assert.ok(clients.every(c=>c.frames.length>5));
 console.log(JSON.stringify({test:'20 players + 10 spectators',maxIdleDownKBps:Math.max(...kb),framesReceived:clients[0].frames.length,allFramesDecoded:true}));
 for(const c of clients)c.ws.close();clients.length=0;
 // Accounts: register over HTTP, then join a room with the session; the room must use the verified account name.
 const user='Sock'+randomBytes(3).toString('hex');const reg=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:'snowball1'})});assert.equal(reg.status,200);const {token:acct}=await reg.json();
 assert.equal((await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:'other123'})})).status,409);
 assert.equal((await fetch(base+'/api/account/me',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+user+'.'+'0'.repeat(64)},body:'{}'})).status,401);
 const acctToken=token(),acctCode=await create(acctToken);const signed=await seat(acctCode,acctToken,'Impostor',false,acct);clients.push(signed);
 assert.equal(signed.state.players.find(p=>p.slot===signed.slot).name,user,'room uses the verified account name');
 const forged=await seat(acctCode,token(),'Faker',false,user+'.'+'f'.repeat(64));clients.push(forged);assert.equal(forged.state.players.find(p=>p.slot===forged.slot).name,'Faker','bad session joins as a guest');
 const board=await (await fetch(base+'/api/leaderboard')).json();assert.ok(board.rows.some(r=>r.display===user));
 console.log(JSON.stringify({test:'accounts over HTTP + verified room identity',user,leaderboardRows:board.rows.length}));
}finally{for(const c of clients){if(c.ws.readyState===1)c.ws.send(JSON.stringify({t:'leave'}));c.ws.close();}}
