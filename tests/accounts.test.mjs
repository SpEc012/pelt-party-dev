import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountCore,parseToken} from '../server/accounts.mjs';
import {PeltRoom} from '../server/worker.mjs';
import {Room} from '../shared/room.mjs';
import {dailyFor,weeklyFor,applyMatch,freshProfile,claim,levelOf,SOLO_COIN_CAP,SOLO_MATCH_COINS,SOLO_GAP,WELCOME_COINS,ACHIEVEMENTS} from '../shared/progress.mjs';

const memory=()=>{const m=new Map();return {get:async k=>structuredClone(m.get(k)),put:async(k,v)=>{m.set(k,structuredClone(v));},raw:m};};
function core(t0=Date.UTC(2026,9,6,12)){let t=t0;const storage=memory();const c=new AccountCore(storage,{now:()=>t});return {c,storage,tick:ms=>{t+=ms;},get now(){return t;}};}
const secretOf=token=>parseToken(token).secret;

test('register stores only a salted PBKDF2 hash, returns a session and refuses duplicates',async()=>{
 const {c,storage}=core();const [s,r]=await c.handle('/register',{username:'Dylan_1',password:'snowball!'});assert.equal(s,200);
 assert.ok(parseToken(r.token));assert.equal(r.profile.coins,WELCOME_COINS);assert.equal(r.profile.username,'dylan_1');
 const saved=storage.raw.get('account');assert.ok(!JSON.stringify(saved).includes('snowball!'));assert.match(saved.hash,/^[a-f0-9]{64}$/);assert.match(saved.salt,/^[a-f0-9]{32}$/);assert.ok(saved.sessions.every(x=>x.h!==secretOf(r.token)));
 assert.equal((await c.handle('/register',{username:'Dylan_1',password:'another1'}))[0],409);
 assert.equal((await new AccountCore(memory()).handle('/register',{username:'ab',password:'snowball!'}))[0],400);
 assert.equal((await new AccountCore(memory()).handle('/register',{username:'okname',password:'123'}))[0],400);
});
test('login checks the password, locks out repeated failures and sessions authorise requests',async()=>{
 const {c,tick}=core();await c.handle('/register',{username:'Frosty',password:'correct-horse'});
 assert.equal((await c.handle('/login',{username:'Frosty',password:'wrong-pass'}))[0],401);
 const [ok,r]=await c.handle('/login',{username:'Frosty',password:'correct-horse'});assert.equal(ok,200);
 assert.equal((await c.handle('/me',{},secretOf(r.token)))[0],200);assert.equal((await c.handle('/me',{},'f'.repeat(64)))[0],401);assert.equal((await c.handle('/me',{},null))[0],401);
 for(let i=0;i<5;i++)await c.handle('/login',{username:'Frosty',password:'nope-nope'});
 assert.equal((await c.handle('/login',{username:'Frosty',password:'correct-horse'}))[0],429);tick(10*60000);assert.equal((await c.handle('/login',{username:'Frosty',password:'correct-horse'}))[0],200);
 await c.handle('/logout',{},secretOf(r.token));assert.equal((await c.handle('/me',{},secretOf(r.token)))[0],401);
});
test('purchases spend server coins; equipping requires ownership; clients cannot set balances',async()=>{
 const {c}=core();const [,r]=await c.handle('/register',{username:'Buyer',password:'secret12'});const sec=secretOf(r.token);
 assert.equal((await c.handle('/equip',{hat:'santa'},sec))[0],400);
 const [s,b]=await c.handle('/buy',{kind:'hat',id:'elf',coins:99999},sec);assert.equal(s,200);assert.equal(b.profile.coins,WELCOME_COINS-140);assert.ok(b.profile.owned.includes('elf'));
 assert.equal((await c.handle('/buy',{kind:'character',id:'yuki'},sec))[0],400);
 const [,e]=await c.handle('/equip',{hat:'elf',character:'pip'},sec);assert.equal(e.profile.hat,'elf');
 await c.handle('/equip',{coins:1e9,xp:1e9},sec);const [,me]=await c.handle('/me',{},sec);assert.equal(me.profile.coins,WELCOME_COINS-140);assert.equal(me.profile.xp,0);
});
test('solo reports are clamped, spaced out and capped per day; trusted room awards dedupe',async()=>{
 const {c,tick}=core();const [,r]=await c.handle('/register',{username:'Solo',password:'secret12'});const sec=secretOf(r.token);
 const big={splats:9999,hits:9999,throws:9999,built:999,dodges:999,powers:999,best:999,place:1,win:true,players:20};
 const [,m1]=await c.handle('/match',{report:big},sec);assert.ok(m1.earned.coins<=SOLO_MATCH_COINS);assert.equal(m1.profile.life.splats,30);
 const [,m2]=await c.handle('/match',{report:big},sec);assert.equal(m2.earned.coins,0);assert.equal(m2.earned.skipped,'too-soon');
 let total=m1.earned.coins;for(let i=0;i<20;i++){tick(SOLO_GAP);const [,m]=await c.handle('/match',{report:big},sec);total+=m.earned.coins;}assert.ok(total<=SOLO_COIN_CAP);
 const before=(await c.handle('/me',{},sec))[1].profile.coins;
 const award={key:'ABCD:1:5',report:{splats:6,hits:20,throws:40,place:1,win:true,players:6,humans:3}};
 assert.equal((await c.handle('/award',award))[0],200);const dup=await c.handle('/award',award);assert.equal(dup[1].duplicate,true);
 const after=(await c.handle('/me',{},sec))[1].profile;assert.ok(after.coins>before);assert.equal(after.life.online,1);assert.equal(after.lastAward.key,'ABCD:1:5');
});
test('challenges rotate by UTC day/week, track progress and can be claimed once',()=>{
 const t=Date.UTC(2026,9,6,12),p=freshProfile('X',t);assert.equal(dailyFor(t).length,3);assert.equal(weeklyFor(t).length,2);
 assert.notDeepEqual(dailyFor(t).map(c=>c.id),dailyFor(t+86400000*3).map(c=>c.id));
 const c=dailyFor(t)[0];assert.equal(claim(p,c.id,t).error,'Not finished yet.');
 const report={splats:12,hits:35,throws:60,built:9,dodges:4,powers:5,best:4,bigs:6,place:1,win:true,players:8,humans:2};applyMatch(p,report,{now:t,trusted:true});applyMatch(p,report,{now:t+1,trusted:true});applyMatch(p,report,{now:t+2,trusted:true});
 const coins=p.coins;const got=claim(p,c.id,t);assert.ok(!got.error,got.error);assert.equal(p.coins,coins+c.coins+50*got.levels);assert.equal(claim(p,c.id,t).error,'Already claimed.');
 assert.equal(claim(p,c.id,t+86400000).error,claim(p,c.id,t+86400000).error);
 const s1=claim(p,'streak',t);assert.equal(s1.coins,25);assert.ok(claim(p,'streak',t).error);assert.equal(claim(p,'streak',t+86400000).coins,30);
 assert.ok(ACHIEVEMENTS.some(a=>a.hat));assert.equal(levelOf(0),1);
});

test('a finished online room credits each signed-in human once, from its own results',async()=>{
 const t=Date.UTC(2026,9,6,12),room=new Room({code:'ABCD',now:t});const a=room.join({name:'Alpha'},t),b=room.join({name:'Bravo'},t);a.account='alpha';room.botsTo(4,t);room.start(t);room.step(t+4000);a.score=3;a.stat.splats=3;room.finish(t+60000);
 const calls=[];const fake={room,awarded:null,ctx:{waitUntil:p=>p},env:{ACCOUNTS:{idFromName:n=>n,get:id=>({fetch:async req=>{calls.push({id,body:JSON.parse(await req.text())});return new Response('{}');}})}}};
 PeltRoom.prototype.awardAccounts.call(fake);PeltRoom.prototype.awardAccounts.call(fake);await new Promise(r=>setTimeout(r,10));
 assert.equal(calls.length,1);assert.equal(calls[0].id,'acct:alpha');assert.equal(calls[0].body.key,`ABCD:${room.round}:${room.startAt}`);assert.equal(calls[0].body.report.splats,3);assert.equal(calls[0].body.report.humans,2);
});
