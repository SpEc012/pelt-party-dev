// Accounts: one Durable Object per username holds the password hash, sessions and progress.
// Coins only change here, through rules in shared/progress.mjs; clients never send balances.
import {freshProfile,applyMatch,claim,buy,equip,view,checkCredentials,levelOf,roll} from '../shared/progress.mjs';

const enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex=s=>new Uint8Array((s.match(/../g)||[]).map(h=>parseInt(h,16)));
export const ITERATIONS=100000; // the Workers runtime caps PBKDF2 at 100k iterations
const SESSION_DAYS=60,MAX_SESSIONS=8;
export async function hashPassword(password,saltHex,iterations=ITERATIONS){
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(saltHex),iterations},key,256));
}
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const randomHex=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
function same(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
// Session tokens look like "username.<64 hex>"; only a SHA-256 of the secret is stored.
export function parseToken(token){const m=/^([A-Za-z0-9_]{3,16})\.([a-f0-9]{64})$/.exec(typeof token==='string'?token:'');return m?{username:m[1].toLowerCase(),secret:m[2]}:null;}

export class AccountCore {
  constructor(storage,{now=()=>Date.now(),onChange=()=>{}}={}){this.storage=storage;this.now=now;this.onChange=onChange;this.acct=undefined;}
  async load(){if(this.acct===undefined)this.acct=(await this.storage.get('account'))||null;return this.acct;}
  async save(){await this.storage.put('account',this.acct);}
  async session(acct,username){
    const secret=randomHex(32),now=this.now();acct.sessions=(acct.sessions||[]).filter(s=>s.exp>now);acct.sessions.push({h:await sha(secret),exp:now+SESSION_DAYS*86400000});
    while(acct.sessions.length>MAX_SESSIONS)acct.sessions.shift();return `${acct.display}.${secret}`;
  }
  async authed(acct,secret){if(!acct||!secret)return false;const h=await sha(secret),now=this.now();return (acct.sessions||[]).some(s=>s.exp>now&&same(s.h,h));}
  out(acct){return {...view(acct.profile,acct.username,this.now()),lastAward:acct.profile.lastAward||null};}
  async handle(path,body={},secret=null){
    const now=this.now(),acct=await this.load();
    if(path==='/register'){
      const err=checkCredentials(body.username,body.password);if(err)return [400,{error:err}];
      if(acct)return [409,{error:'That username is taken. Try another, or log in.'}];
      const salt=randomHex(16),a={username:body.username.toLowerCase(),display:body.username,salt,iter:ITERATIONS,hash:await hashPassword(body.password,salt),created:now,fails:0,lockUntil:0,sessions:[],profile:freshProfile(body.username,now)};
      if(this.acct)return [409,{error:'That username is taken. Try another, or log in.'}];
      this.acct=a;const token=await this.session(a);await this.save();this.onChange(a);return [200,{token,profile:this.out(a)}];
    }
    if(path==='/login'){
      if(!acct)return [401,{error:'Wrong username or password.'}];
      if(acct.lockUntil>now)return [429,{error:`Too many tries. Wait ${Math.ceil((acct.lockUntil-now)/1000)} seconds.`}];
      const ok=typeof body.password==='string'&&body.password.length<=72&&same(await hashPassword(body.password,acct.salt,acct.iter),acct.hash);
      if(!ok){acct.fails=(acct.fails||0)+1;if(acct.fails>=5)acct.lockUntil=now+30000*2**Math.min(6,acct.fails-5);await this.save();return [401,{error:'Wrong username or password.'}];}
      acct.fails=0;acct.lockUntil=0;const token=await this.session(acct);await this.save();return [200,{token,profile:this.out(acct)}];
    }
    // Internal routes: only the Worker and room objects can reach these, never the public URL.
    if(path==='/verify'){if(!await this.authed(acct,secret))return [401,{error:'Session expired.'}];const p=acct.profile;return [200,{username:acct.username,display:acct.display,character:p.character,hat:p.hat}];}
    if(path==='/award'){
      if(!acct)return [404,{error:'No account.'}];const key=String(body.key||'').slice(0,80),p=acct.profile;p.awards=p.awards||[];
      if(!key||p.awards.includes(key))return [200,{ok:true,duplicate:true}];
      const earned=applyMatch(p,body.report,{now,trusted:true});p.awards.push(key);while(p.awards.length>30)p.awards.shift();p.lastAward={key,coins:earned.coins,xp:earned.xp,levels:earned.levels,at:now};
      await this.save();this.onChange(acct);return [200,{ok:true,earned}];
    }
    if(!await this.authed(acct,secret))return [401,{error:'Please log in again.'}];
    const p=acct.profile;roll(p,now);
    if(path==='/me')return [200,{profile:this.out(acct)}];
    if(path==='/logout'){const h=await sha(secret);acct.sessions=acct.sessions.filter(s=>!same(s.h,h));await this.save();return [200,{ok:true}];}
    if(path==='/equip'){const r=equip(p,body);if(r.error)return [400,r];await this.save();this.onChange(acct);return [200,{profile:this.out(acct)}];}
    if(path==='/buy'){const r=buy(p,body.kind,body.id);if(r.error)return [400,r];await this.save();return [200,{profile:this.out(acct)}];}
    if(path==='/match'){const earned=applyMatch(p,body.report,{now,trusted:false});await this.save();this.onChange(acct);return [200,{earned:{coins:earned.coins,xp:earned.xp,levels:earned.levels,skipped:earned.skipped||null},profile:this.out(acct)}];}
    if(path==='/claim'){const r=claim(p,String(body.id||''),now);if(r.error)return [400,r];await this.save();this.onChange(acct);return [200,{claimed:r,profile:this.out(acct)}];}
    if(path==='/password'){
      const err=checkCredentials(acct.display,body.next);if(err)return [400,{error:err}];
      if(!same(await hashPassword(String(body.current||''),acct.salt,acct.iter),acct.hash))return [401,{error:'Current password is wrong.'}];
      acct.salt=randomHex(16);acct.iter=ITERATIONS;acct.hash=await hashPassword(body.next,acct.salt);acct.sessions=[];const token=await this.session(acct);await this.save();return [200,{token,profile:this.out(acct)}];
    }
    return [404,{error:'Not found.'}];
  }
}

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export class Account {
  constructor(ctx,env){
    this.core=new AccountCore(ctx.storage,{onChange:a=>{const p=a.profile;ctx.waitUntil(env.LEADERBOARD.get(env.LEADERBOARD.idFromName('global')).fetch(new Request('https://board/update',{method:'POST',body:JSON.stringify({username:a.username,display:a.display,xp:p.xp,level:levelOf(p.xp),wins:p.life.wins,splats:p.life.splats,character:p.character,hat:p.hat})})).catch(()=>{}));}});
  }
  async fetch(request){
    const url=new URL(request.url);let body={};try{body=request.method==='POST'?await request.json():{};}catch{return json({error:'Bad request.'},400);}
    const [status,data]=await this.core.handle(url.pathname,body,request.headers.get('X-Pelt-Secret'));return json(data,status);
  }
}

// One global top list, ranked by XP.
export class Leaderboard {
  constructor(ctx){this.ctx=ctx;this.rows=null;}
  async load(){this.rows??=(await this.ctx.storage.get('rows'))||[];return this.rows;}
  async fetch(request){
    const url=new URL(request.url),rows=await this.load();
    if(url.pathname==='/update'){const r=await request.json();if(!r?.username)return json({ok:false},400);const i=rows.findIndex(x=>x.username===r.username);if(i>=0)rows.splice(i,1);
      const row={username:String(r.username).slice(0,16),display:String(r.display).slice(0,16),xp:+r.xp||0,level:+r.level||1,wins:+r.wins||0,splats:+r.splats||0,character:String(r.character||'pip').slice(0,12),hat:String(r.hat||'none').slice(0,12)};
      rows.push(row);rows.sort((a,b)=>b.xp-a.xp||b.wins-a.wins);rows.length=Math.min(rows.length,100);await this.ctx.storage.put('rows',rows);return json({ok:true});}
    if(url.pathname==='/top')return json({rows:rows.slice(0,50).map(({username,...r})=>r)});
    return json({error:'Not found.'},404);
  }
}
