import {CHARACTERS,POWERS,RULES} from '../shared/content.mjs';
import {cameraBasis} from '../shared/controller.mjs';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorOf=id=>CHARACTERS.find(c=>c.id===id)?.color||'#ffffff';
const MODE={ffa:'FREE-FOR-ALL',team:'TEAM PELT',king:'KING OF THE HILL'};
const CAPTIONS=['That’s gonna leave a mark.','Absolutely flattened.','You got PELTED.','Face, meet ground.','Down goes the champ!','Splat-tastic.','Need a hug?','Ouch. Right in the dignity.','Yeet received.','Flat as a pancake.','Certified bonk.','Did you see that?! Everyone did.'];
const FROSTY=['Brain freeze!','Snow way!','Ice to meet you.','Frosty the No-man.','Chill out for a sec.','Somebody get this kid a cocoa.'];
const SPOOKY=['Pumpkin’d!','Gourd-geous splat.','Squashed!','Spooked & smooshed.','You got jack-o’-lanterned.','Boo-hoo.'];
const TIPS=['Dive (SPACE) through a throw — you’re untouchable mid-dive.','Press Q to slam a wall, then crouch behind it.','Charged Big Pelts splash everyone nearby.','Glowing piles refill ammo much faster than scooping.','Keep strafing: moving targets are hard to hit.','Grab pads for Shield, Cocoa, Giga Ball and more.','Sprint, then press C to slide into cover.','Lead your throws: aim where they’re going.'];

// The match HUD is built once per match; per-frame updates only touch text and styles that changed.
export class Hud {
  constructor(root,{touch=false}={}){
    this.root=root;this.touch=touch;this.cache=new Map();this.feed=[];this.lastMini=0;
    root.innerHTML=`<div id="hud" class="${touch?'touch':''}">
      <div class="hud-tl"><div id="killfeed"></div></div>
      <div class="hud-top"><div class="clock"><small id="mode-label"></small><strong id="clock">3:00</strong></div><div id="race"></div></div>
      <div class="hud-tr"><canvas id="minimap" width="168" height="168"></canvas><div id="net"></div></div>
      <div id="crosshair"><svg viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="22"/><circle id="charge-ring" class="charge" cx="32" cy="32" r="22"/></svg><b class="dot"></b><i class="t"></i><i class="r"></i><i class="b"></i><i class="l"></i></div>
      <div id="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div id="damage-dirs"></div>
      <div id="callouts"></div>
      <div id="banner"><strong></strong><small></small></div>
      <div id="death"><div class="d-splat"></div><strong class="d-title">SPLATTED!</strong><p class="d-caption"></p><div class="d-killer"><i></i><span><small>SPLATTED BY</small><b></b><em></em></span></div><div class="d-timer"><svg viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="26"/><circle class="fill" cx="32" cy="32" r="26"/></svg><span></span></div><p class="d-tip"></p></div>
      <div id="vignette"></div><div id="frost-edge"></div>
      <div class="hud-bl">
        <div id="hearts"></div>
        <div class="abilities">
          <div class="ability" id="ab-dive"><span class="key">${touch?'↯':'SPACE'}</span><div class="pips"><i></i><i></i></div><small>DIVE</small></div>
          <div class="ability" id="ab-wall"><span class="key">${touch?'▤':'Q'}</span><div class="cool"><i></i></div><small>WALL</small></div>
          <div class="ability" id="ab-slide"><span class="key">${touch?'⤓':'C'}</span><div class="cool"><i></i></div><small>SLIDE</small></div>
        </div>
        <div id="powers"></div>
      </div>
      <div class="hud-br"><div id="ammo"><strong id="ammo-n">5</strong><div><small id="ammo-label">SNOWBALLS</small><div id="ammo-pips"></div></div></div><div id="ammo-hint"></div></div>
      <div id="scoreboard" hidden></div>
      <div id="hint" hidden></div>
    </div>`;
    const q=s=>root.querySelector(s);
    this.el={clock:q('#clock'),mode:q('#mode-label'),race:q('#race'),net:q('#net'),mini:q('#minimap'),cross:q('#crosshair'),ring:q('#charge-ring'),hit:q('#hitmarker'),dirs:q('#damage-dirs'),callouts:q('#callouts'),banner:q('#banner'),bannerT:q('#banner strong'),bannerS:q('#banner small'),vig:q('#vignette'),frost:q('#frost-edge'),hearts:q('#hearts'),dive:q('#ab-dive'),wall:q('#ab-wall'),slide:q('#ab-slide'),powers:q('#powers'),ammoN:q('#ammo-n'),ammoL:q('#ammo-label'),ammoP:q('#ammo-pips'),ammoHint:q('#ammo-hint'),board:q('#scoreboard'),hint:q('#hint'),feed:q('#killfeed'),death:q('#death'),dCaption:q('#death .d-caption'),dKiller:q('#death .d-killer'),dKillerName:q('#death .d-killer b'),dKillerSub:q('#death .d-killer em'),dKillerDot:q('#death .d-killer i'),dTime:q('#death .d-timer span'),dRing:q('#death .d-timer .fill'),dTip:q('#death .d-tip')};
    this.el.ammoP.innerHTML='<i></i>'.repeat(RULES.maxAmmo);this.pips=[...this.el.ammoP.children];
    this.el.hearts.innerHTML='<i></i>'.repeat(RULES.hp);this.heartEls=[...this.el.hearts.children];
    this.mctx=this.el.mini.getContext('2d');
  }
  set(key,el,value,prop='textContent'){if(this.cache.get(key)===value)return;this.cache.set(key,value);if(prop==='html')el.innerHTML=value;else el[prop]=value;}
  cls(key,el,name,on){const k=key+name;if(this.cache.get(k)===on)return;this.cache.set(k,on);el.classList.toggle(name,on);}
  setMap(map,season,ammoName){
    this.map=map;this.el.ammoL.textContent=ammoName;
    const c=document.createElement('canvas');c.width=c.height=168;const g=c.getContext('2d'),s=150/Math.max(map.width,map.depth);this.ms=s;
    g.fillStyle='rgba(12,18,40,.78)';g.beginPath();g.roundRect(0,0,168,168,22);g.fill();
    g.fillStyle='rgba(255,255,255,.08)';g.fillRect(84-map.width*s/2,84-map.depth*s/2,map.width*s,map.depth*s);
    for(const o of map.ice){g.fillStyle='rgba(150,220,255,.35)';g.beginPath();g.arc(84+o.x*s,84+o.z*s,o.r*s,0,7);g.fill();}
    g.fillStyle='rgba(255,255,255,.45)';for(const o of map.props){g.beginPath();g.arc(84+o.x*s,84+o.z*s,Math.max(1,o.r*s),0,7);g.fill();}
    g.fillStyle='rgba(160,230,255,.9)';for(const p of map.piles){g.beginPath();g.arc(84+p.x*s,84+p.z*s,2.6,0,7);g.fill();}
    this.miniBase=c;
  }
  update(f){
    const {state,me,time}=f,el=this.el;if(!state)return;
    const left=Math.max(0,Math.ceil(((state.phase==='starting'?state.endAt:state.endAt)-Math.max(time,state.startAt))/1000));
    this.set('clock',el.clock,`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`);this.cls('clock',el.clock,'urgent',f.frenzy);
    this.set('mode',el.mode,f.frenzy?'❄ BLIZZARD · FINAL 30 ❄':MODE[state.mode]);
    // Race to the score limit.
    const players=state.players.filter(p=>!p.spectator),limit=f.limit;
    if(state.mode==='ffa'){const sorted=[...players].sort((a,b)=>b.score-a.score||a.slot-b.slot),lead=sorted[0],mine=me?.score||0,rank=me?sorted.findIndex(p=>p.slot===me.slot)+1:0;
      this.set('race',el.race,`<div class="race-ffa"><span class="me"><b>${mine}</b><small>YOU · #${rank||'–'}</small></span><span class="bar"><i style="width:${Math.min(100,mine/limit*100)}%"></i><em style="left:${Math.min(100,(lead?.score||0)/limit*100)}%"></em></span><span class="lead"><b>${lead?.score||0}</b><small>${lead&&lead.slot!==me?.slot?esc(lead.name).toUpperCase():'YOU LEAD'}</small></span></div><small class="limit">FIRST TO ${limit}</small>`,'html');}
    else{const t=[0,1].map(k=>players.filter(p=>p.team===k).reduce((n,p)=>n+p.score,0)),my=me?.team??0;
      this.set('race',el.race,`<div class="race-team"><span class="t0 ${my===0?'mine':''}"><b>${t[0]}</b></span><span class="bar"><i class="t0" style="width:${t[0]/limit*50}%"></i><i class="t1" style="width:${t[1]/limit*50}%"></i></span><span class="t1 ${my===1?'mine':''}"><b>${t[1]}</b></span></div><small class="limit">${state.mode==='king'?'HOLD THE GLOWING HILL · ':''}FIRST TO ${limit}</small>`,'html');}
    // Health, abilities, power-ups, ammo.
    const hp=me?.hp??0;this.heartEls.forEach((h,i)=>this.cls('h'+i,h,'full',i<hp));this.cls('hearts',el.hearts,'low',hp===1);
    const dives=me?.dives??0,rush=(me?.rushUntil||0)>time;[...el.dive.querySelectorAll('.pips i')].forEach((p,i)=>this.cls('d'+i,p,'on',rush||i<dives));this.cls('dive',el.dive,'ready',rush||dives>0);
    const wallLeft=Math.max(0,(me?.buildReady||0)-time);el.wall.querySelector('.cool i').style.width=`${100-Math.min(100,wallLeft/RULES.buildCooldown*100)}%`;this.cls('wall',el.wall,'ready',!wallLeft);
    const slideLeft=Math.max(0,(me?.slideReady||0)-time);el.slide.querySelector('.cool i').style.width=`${100-Math.min(100,slideLeft/(RULES.slideCooldown+RULES.slideTime)*100)}%`;this.cls('slide',el.slide,'ready',!slideLeft);
    const pw=[];if((me?.shieldUntil||0)>time)pw.push(['shield',Math.ceil((me.shieldUntil-time)/1000)+'s']);if(rush)pw.push(['rush',Math.ceil((me.rushUntil-time)/1000)+'s']);if(me?.triple)pw.push(['triple','×'+me.triple]);if(me?.giga)pw.push(['giga','READY']);
    this.set('powers',el.powers,pw.map(([k,v])=>`<span style="--c:${POWERS[k].color}">${POWERS[k].short}<b>${v}</b></span>`).join(''),'html');
    const ammo=me?.ammo??0;this.set('ammo',el.ammoN,String(ammo));
    if(this.touch){const tb=this.tbThrow??=this.root.querySelector('.tb-throw');if(tb){this.set('tbammo',tb,`<span>${me?.giga?'GIGA':'THROW'}</span><b>${ammo}</b>`,'html');this.cls('tb',tb,'empty',ammo===0);}}this.pips.forEach((p,i)=>this.cls('a'+i,p,'on',i<ammo));this.cls('ammoN',el.ammoN,'empty',ammo===0);
    this.set('ahint',el.ammoHint,ammo===0?(this.touch?'HOLD SCOOP':'OUT! HOLD R TO SCOOP'):f.scooping?'SCOOPING…':ammo<=2?(this.touch?'LOW AMMO':'LOW · HOLD R TO SCOOP'):'');
    // Crosshair and charge.
    const c=Math.min(1,f.charge||0);el.ring.style.strokeDashoffset=String(138.2*(1-c));this.cls('cross',el.cross,'charged',c>=1);this.cls('cross',el.cross,'locked',!!f.locked);this.cls('cross',el.cross,'aiming',!!f.aiming);
    this.cls('cross',el.cross,'hidden',state.phase!=='playing'||!me||!!me.respawnAt);
    this.cls('vig',el.vig,'low',hp===1&&state.phase==='playing');this.cls('frost',el.frost,'on',f.frenzy);
    // Phase banners.
    let title='',sub='';
    if(state.phase==='starting'){title=String(Math.max(1,Math.ceil((state.startAt-time)/1000)));sub='GET READY';}

    else if(state.phase==='playing'&&time-state.startAt<1200){title='GO!';sub='';}
    this.set('bt',el.bannerT,title);this.set('bs',el.bannerS,sub);this.cls('banner',el.banner,'show',!!title);this.cls('banner',el.banner,'count',state.phase==='starting');
    this.deathScreen(f,me,time);
    this.set('net',el.net,f.net);
    if(time-this.lastMini>50){this.lastMini=time;this.minimap(f);}
    if(!el.board.hidden)this.scoreboard(state,me);
  }
  deathScreen(f,me,time){
    const el=this.el,dead=!!me?.respawnAt&&f.state.phase==='playing';this.cls('death',el.death,'show',dead);if(!dead){this.deathAt=0;return;}
    if(this.deathAt!==me.respawnAt){this.deathAt=me.respawnAt;const pick=a=>a[Math.floor(Math.random()*a.length)];
      el.dCaption.textContent=pick(f.season==='halloween'?CAPTIONS.concat(SPOOKY):f.season==='frost'?CAPTIONS.concat(FROSTY):CAPTIONS);el.dTip.textContent='TIP · '+pick(TIPS);
      const k=f.killerInfo;el.dKiller.hidden=!k;if(k){el.dKillerName.textContent=k.name;el.dKillerDot.style.background=colorOf(k.character);el.dKillerSub.textContent=k.streak>=2?`🔥 ${k.streak} splat streak`:k.hp?`${'♥'.repeat(k.hp)} left`:'';}
      el.death.classList.remove('pop');void el.death.offsetWidth;el.death.classList.add('pop');}
    const left=Math.max(0,me.respawnAt-time);this.set('dt',el.dTime,String(Math.max(1,Math.ceil(left/1000))));el.dRing.style.strokeDashoffset=String(163.4*(left/RULES.respawn));
  }
  minimap({state,poses,me,mySlot,yaw,local}){
    const g=this.mctx,s=this.ms;if(!this.miniBase)return;g.clearRect(0,0,168,168);g.drawImage(this.miniBase,0,0);
    for(let i=0;i<state.pads.length;i++){const pad=state.pads[i];if(pad.readyAt>Date.now())continue;g.fillStyle=POWERS[pad.kind]?.color||'#fff';g.beginPath();g.arc(84+pad.x*s,84+pad.z*s,3.4,0,7);g.fill();}
    g.fillStyle='rgba(255,255,255,.75)';for(const f of state.forts){g.fillRect(84+f.x*s-1.5,84+f.z*s-1.5,3,3);}
    for(const p of state.players){if(p.spectator||p.respawnAt||p.slot===mySlot)continue;const at=poses.get(p.slot)||p;const ally=state.mode!=='ffa'&&p.team===me?.team;g.fillStyle=ally?'#7fd6ff':'#ff6b5a';g.beginPath();g.arc(84+at.x*s,84+at.z*s,2.8,0,7);g.fill();}
    if(local){const b=cameraBasis(yaw),x=84+local.x*s,z=84+local.z*s;g.fillStyle='#ffffff';g.beginPath();g.moveTo(x+b.fx*7,z+b.fz*7);g.lineTo(x-b.fx*3+b.rx*4,z-b.fz*3+b.rz*4);g.lineTo(x-b.fx*3-b.rx*4,z-b.fz*3-b.rz*4);g.closePath();g.fill();}
  }
  scoreboard(state,me){
    const rows=[...state.players].filter(p=>!p.spectator).sort((a,b)=>(state.mode!=='ffa'?a.team-b.team:0)||b.score-a.score);
    const html=`<h3>SCOREBOARD</h3><table><tr><th></th><th>PLAYER</th><th>SPLATS</th><th>STREAK</th></tr>${rows.map(p=>`<tr class="${p.slot===me?.slot?'me':''} ${state.mode!=='ffa'?'team'+p.team:''}"><td><i style="background:${colorOf(p.character)}"></i></td><td>${esc(p.name)}${p.bot?' <small>BOT</small>':''}</td><td>${p.score}</td><td>${p.streak||0}</td></tr>`).join('')}</table>`;
    this.set('board',this.el.board,html,'html');
  }
  showBoard(on){this.el.board.hidden=!on;}
  killfeed(by,victim,mine,calls=[]){
    const row=document.createElement('div');row.className=`kf ${mine?'mine':''}`;row.innerHTML=`<b style="color:${colorOf(by?.character)}">${esc(by?.name||'?')}</b><i>✹</i><b style="color:${colorOf(victim?.character)}">${esc(victim?.name||'?')}</b>`;
    this.el.feed.prepend(row);while(this.el.feed.children.length>5)this.el.feed.lastChild.remove();setTimeout(()=>row.classList.add('fade'),5000);setTimeout(()=>row.remove(),5600);
  }
  callout(text,big=false){const el=document.createElement('div');el.className=`callout ${big?'big':''}`;el.textContent=text;this.el.callouts.append(el);while(this.el.callouts.children.length>3)this.el.callouts.firstChild.remove();setTimeout(()=>el.remove(),1900);}
  hitmarker(kill=false){const el=this.el.hit;el.classList.remove('show','kill');void el.offsetWidth;el.classList.add('show');if(kill)el.classList.add('kill');}
  damage(angle){const el=document.createElement('i');el.style.transform=`translate(-50%,-50%) rotate(${angle}rad)`;this.el.dirs.append(el);setTimeout(()=>el.remove(),900);this.el.vig.classList.remove('hurt');void this.el.vig.offsetWidth;this.el.vig.classList.add('hurt');}
  hint(text){if(!text){this.el.hint.hidden=true;return;}this.el.hint.hidden=false;if(this.el.hint.textContent!==text)this.el.hint.textContent=text;}
}
