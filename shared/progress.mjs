// Account progress rules: levels, match rewards, challenges, achievements and streaks.
// Pure functions shared by the Account Durable Object, the client (for display) and tests.
import {CHARACTERS,COSMETICS} from './content.mjs';
import {payout} from './physics.mjs';

export const levelOf=xp=>Math.floor(Math.sqrt(Math.max(0,xp)/60))+1;
export const xpFor=level=>60*(level-1)**2;
export const LEVEL_COINS=50;
export const WELCOME_COINS=150;
const DAY=86400000;
export const dayOf=now=>Math.floor(now/DAY);
// Weeks start on Monday UTC (day 4 of the epoch was a Thursday).
export const weekOf=now=>Math.floor((dayOf(now)+3)/7);
export const nextDay=now=>(dayOf(now)+1)*DAY;
export const nextWeek=now=>((weekOf(now)+1)*7-3)*DAY;

// stat: which match number counts; mode 'max' means "in a single match".
export const DAILY=[
  {id:'d-splat10',stat:'splats',goal:10,coins:80,xp:60,text:'Splat 10 players'},
  {id:'d-hits30',stat:'hits',goal:30,coins:60,xp:50,text:'Land 30 hits'},
  {id:'d-win1',stat:'wins',goal:1,coins:100,xp:80,text:'Win a match'},
  {id:'d-play3',stat:'matches',goal:3,coins:60,xp:50,text:'Play 3 matches'},
  {id:'d-walls8',stat:'built',goal:8,coins:60,xp:50,text:'Build 8 walls'},
  {id:'d-dodge3',stat:'dodges',goal:3,coins:80,xp:60,text:'Dive through 3 throws'},
  {id:'d-power4',stat:'powers',goal:4,coins:70,xp:50,text:'Grab 4 power-ups'},
  {id:'d-streak3',stat:'best',goal:3,mode:'max',coins:90,xp:70,text:'Get a 3-splat streak'},
  {id:'d-online1',stat:'online',goal:1,coins:120,xp:90,text:'Finish an online match'},
  {id:'d-big5',stat:'bigs',goal:5,coins:70,xp:50,text:'Land 5 Big Pelt hits'}
];
export const WEEKLY=[
  {id:'w-splat75',stat:'splats',goal:75,coins:400,xp:300,text:'Splat 75 players'},
  {id:'w-win5',stat:'wins',goal:5,coins:450,xp:350,text:'Win 5 matches'},
  {id:'w-play15',stat:'matches',goal:15,coins:350,xp:250,text:'Play 15 matches'},
  {id:'w-walls40',stat:'built',goal:40,coins:300,xp:200,text:'Build 40 walls'},
  {id:'w-streak5',stat:'best',goal:5,mode:'max',coins:400,xp:300,text:'Get a 5-splat streak'},
  {id:'w-online5',stat:'online',goal:5,coins:500,xp:400,text:'Finish 5 online matches'}
];
// Lifetime milestones. Some unlock an exclusive hat.
export const ACHIEVEMENTS=[
  {id:'a-first',stat:'splats',goal:1,coins:50,text:'First splat'},
  {id:'a-splat100',stat:'splats',goal:100,coins:300,text:'100 splats'},
  {id:'a-splat500',stat:'splats',goal:500,coins:800,hat:'crown',text:'500 splats · unlocks Gourd royalty'},
  {id:'a-win1',stat:'wins',goal:1,coins:100,text:'First victory'},
  {id:'a-win10',stat:'wins',goal:10,coins:400,text:'10 victories'},
  {id:'a-win50',stat:'wins',goal:50,coins:1000,hat:'tophat',text:'50 victories · unlocks Snowman top hat'},
  {id:'a-play50',stat:'matches',goal:50,coins:400,text:'Play 50 matches'},
  {id:'a-walls100',stat:'built',goal:100,coins:300,text:'Build 100 walls'},
  {id:'a-streak8',stat:'best',goal:8,coins:500,hat:'antlers',text:'8-splat streak · unlocks Reindeer antlers'},
  {id:'a-online10',stat:'online',goal:10,coins:500,text:'10 online matches'},
  {id:'a-level10',stat:'level',goal:10,coins:500,hat:'santa',text:'Reach level 10 · unlocks Santa hat'}
];
const STREAK_BONUS=[25,30,35,40,50,60,100];
export const ALL=[...DAILY,...WEEKLY,...ACHIEVEMENTS];
export const findChallenge=id=>ALL.find(c=>c.id===id);

function pickFrom(list,n,seed){const out=[],pool=[...list];let s=(seed*2654435761)>>>0;while(out.length<n&&pool.length){s=(Math.imul(s,1664525)+1013904223)>>>0;out.push(pool.splice(s%pool.length,1)[0]);}return out;}
export const dailyFor=now=>pickFrom(DAILY,3,dayOf(now)+11);
export const weeklyFor=now=>pickFrom(WEEKLY,2,weekOf(now)+97);

export function freshProfile(display,now){
  return {display,created:now,character:'pip',hat:'beanie',coins:WELCOME_COINS,xp:0,
    owned:['none','beanie'],ownedChars:CHARACTERS.filter(c=>!c.price).map(c=>c.id),
    life:{matches:0,wins:0,splats:0,hits:0,throws:0,built:0,dodges:0,powers:0,best:0,online:0,bigs:0},
    daily:{day:dayOf(now),p:{},claimed:[]},weekly:{week:weekOf(now),p:{},claimed:[]},achievements:[],
    streak:{last:-1,count:0},solo:{day:dayOf(now),coins:0,last:0},awards:[]};
}
// Roll daily/weekly progress forward when the period changes.
export function roll(profile,now){
  const d=dayOf(now),w=weekOf(now);
  if(profile.daily.day!==d)profile.daily={day:d,p:{},claimed:[]};
  if(profile.weekly.week!==w)profile.weekly={week:w,p:{},claimed:[]};
  if(profile.solo.day!==d)profile.solo={day:d,coins:0,last:profile.solo.last||0};
  return profile;
}
const STATS=['splats','hits','throws','built','dodges','powers','best','bigs'];
// Untrusted (solo) reports are clamped to what a real 3–4 minute match can produce.
const SOLO_MAX={splats:30,hits:150,throws:400,built:25,dodges:40,powers:20,best:30,bigs:60};
export const SOLO_COIN_CAP=400,SOLO_MATCH_COINS=40,SOLO_GAP=60000;
export function cleanReport(r,trusted){
  const out={};for(const k of STATS){const v=Math.floor(Number(r?.[k])||0);out[k]=Math.max(0,trusted?Math.min(v,10000):Math.min(v,SOLO_MAX[k]));}
  out.hits=Math.min(out.hits,out.throws*3);out.best=Math.min(out.best,out.splats);
  out.place=Math.max(1,Math.min(20,Math.floor(Number(r?.place)||9)));out.players=Math.max(2,Math.min(20,Math.floor(Number(r?.players)||8)));
  out.win=!!r?.win&&out.place===1;out.online=!!trusted&&(Number(r?.humans)||0)>=2;out.bots=trusted?!!r?.bots:true;out.draw=!!r?.draw;
  return out;
}
export function addXp(profile,xp){const before=levelOf(profile.xp);profile.xp+=Math.max(0,Math.floor(xp));const after=levelOf(profile.xp);const ups=Math.max(0,after-before);profile.coins+=ups*LEVEL_COINS;return ups;}
// Apply one finished match. Returns what was earned for the results screen.
export function applyMatch(profile,report,{now,trusted}){
  roll(profile,now);
  if(!trusted&&now-(profile.solo.last||0)<SOLO_GAP)return {coins:0,xp:0,levels:0,skipped:'too-soon'};
  const r=cleanReport(report,trusted);
  let coins=payout({splats:r.splats,place:r.draw?2:r.place,bots:r.bots,players:r.players}),xp=25+r.splats*12+(r.win?40:0)+(r.online?30:0);
  if(!trusted){profile.solo.last=now;coins=Math.min(coins,SOLO_MATCH_COINS,Math.max(0,SOLO_COIN_CAP-profile.solo.coins));profile.solo.coins+=coins;xp=Math.min(xp,400);}
  profile.coins+=coins;
  const gained={matches:1,wins:r.win?1:0,online:r.online?1:0};for(const k of STATS)gained[k]=r[k];
  for(const [k,v]of Object.entries(gained)){if(k==='best'){profile.life.best=Math.max(profile.life.best||0,v);continue;}profile.life[k]=(profile.life[k]||0)+v;}
  for(const [scope,list]of [['daily',dailyFor(now)],['weekly',weeklyFor(now)]])for(const c of list){const p=profile[scope].p;const v=gained[c.stat]||0;p[c.id]=c.mode==='max'?Math.max(p[c.id]||0,v):(p[c.id]||0)+v;}
  const levels=addXp(profile,xp);
  return {coins,xp,levels,report:r};
}
export function progressOf(profile,c,now){
  if(c.id.startsWith('a-'))return c.stat==='level'?levelOf(profile.xp):profile.life[c.stat]||0;
  const scope=c.id.startsWith('d-')?profile.daily:profile.weekly;return scope.p[c.id]||0;
}
export function claim(profile,id,now){
  roll(profile,now);
  if(id==='streak'){const d=dayOf(now);if(profile.streak.last===d)return {error:'Already claimed today. Come back tomorrow!'};profile.streak.count=profile.streak.last===d-1?profile.streak.count+1:1;profile.streak.last=d;const coins=STREAK_BONUS[Math.min(STREAK_BONUS.length,profile.streak.count)-1];profile.coins+=coins;return {coins,xp:0};}
  const c=findChallenge(id);if(!c)return {error:'Unknown challenge.'};
  const active=c.id.startsWith('d-')?dailyFor(now).includes(c):c.id.startsWith('w-')?weeklyFor(now).includes(c):true;if(!active)return {error:'That challenge has rotated out.'};
  const done=c.id.startsWith('d-')?profile.daily.claimed:c.id.startsWith('w-')?profile.weekly.claimed:profile.achievements;
  if(done.includes(id))return {error:'Already claimed.'};if(progressOf(profile,c,now)<c.goal)return {error:'Not finished yet.'};
  done.push(id);profile.coins+=c.coins;if(c.hat&&!profile.owned.includes(c.hat))profile.owned.push(c.hat);const levels=addXp(profile,c.xp||0);return {coins:c.coins,xp:c.xp||0,levels,hat:c.hat};
}
export function buy(profile,kind,id){
  const list=kind==='character'?CHARACTERS:kind==='hat'?COSMETICS:null,item=list?.find(x=>x.id===id);if(!item)return {error:'Unknown item.'};
  const owned=kind==='character'?profile.ownedChars:profile.owned;if(owned.includes(id))return {ok:true};
  if(profile.coins<item.price)return {error:`Need ◈ ${item.price-profile.coins} more coins.`};profile.coins-=item.price;owned.push(id);return {ok:true,spent:item.price};
}
export function equip(profile,{character,hat}){
  if(character!==undefined){if(!profile.ownedChars.includes(character))return {error:'You do not own that chibi yet.'};profile.character=character;}
  if(hat!==undefined){if(!profile.owned.includes(hat))return {error:'You do not own that hat yet.'};profile.hat=hat;}
  return {ok:true};
}
// What the client sees: no password data, plus the active challenge list with progress.
export function view(profile,username,now){
  roll(profile,now);const row=(c,claimed)=>({id:c.id,text:c.text,goal:c.goal,coins:c.coins,xp:c.xp||0,hat:c.hat||null,progress:Math.min(c.goal,progressOf(profile,c,now)),claimed});
  const d=dayOf(now);
  return {username,display:profile.display,character:profile.character,hat:profile.hat,coins:profile.coins,xp:profile.xp,level:levelOf(profile.xp),owned:profile.owned,ownedChars:profile.ownedChars,life:profile.life,
    daily:dailyFor(now).map(c=>row(c,profile.daily.claimed.includes(c.id))),weekly:weeklyFor(now).map(c=>row(c,profile.weekly.claimed.includes(c.id))),
    achievements:ACHIEVEMENTS.map(c=>row(c,profile.achievements.includes(c.id))),
    streak:{count:profile.streak.count,ready:profile.streak.last!==d,next:STREAK_BONUS[Math.min(STREAK_BONUS.length,profile.streak.last===d-1||profile.streak.last===d?profile.streak.count+1:1)-1]},
    resets:{daily:nextDay(now),weekly:nextWeek(now)},solo:{coinsLeft:Math.max(0,SOLO_COIN_CAP-profile.solo.coins)}};
}
export const USERNAME=/^[A-Za-z0-9_]{3,16}$/;
export function checkCredentials(username,password){
  if(typeof username!=='string'||!USERNAME.test(username))return 'Usernames are 3–16 letters, numbers or _.';
  if(/fuck|shit|nigg|bitch|cunt|admin|moderator/i.test(username))return 'Pick a friendlier username.';
  if(typeof password!=='string'||password.length<6||password.length>72)return 'Passwords are 6–72 characters.';
  return null;
}
