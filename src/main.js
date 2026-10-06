import './style.css';
import {World} from './world/scene.js';
import {Sound} from './audio.js';
import {Room} from '../shared/room.mjs';
import {BUILD,SEASONS,CHARACTERS,COSMETICS,MAPS,seasonFor} from '../shared/content.mjs';
import {clamp,moveBody,peltAt,sweptHit,makePelt,rateFor} from '../shared/physics.mjs';
import {RemoteTrack,CODE,safeName} from '../shared/protocol.mjs';
import {connect,api,profileToken} from './network.js';

const $=s=>document.querySelector(s),app=$('#app'),sound=new Sound();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),token=profileToken();
let saved={};try{saved=JSON.parse(localStorage.getItem('pelt-profile')||'{}');}catch{}
let profile={name:saved.name||`Sprout ${token.slice(0,3)}`,character:saved.character||'pip',hat:saved.hat||'none',coins:Number.isFinite(saved.coins)?Math.max(0,saved.coins):40,owned:Array.isArray(saved.owned)?saved.owned:['none'],tutorial:!!saved.tutorial,muted:!!saved.muted,reduced:!!saved.reduced,quality:saved.quality||'mid'};
let season=seasonFor(new Date(params.get('date')||Date.now()),params.get('season')),screen='home',modal=null,state=null,room=null,wire=null,mySlot=0,status='local',errorText='',world;
let local=null,tracks=new Map(),poses=new Map(),keys=new Set(),aim={x:0,z:0},lastSnap=0,lastFrame=performance.now(),fps=60,shotCounter=0,chargeAt=0,lastShot=0,rollEnd=0,rollVec={x:0,z:1},gamepadThrow=false,tutorialUntil=0,paid=new Set(),hitSent=new Map(),socketStats={},debug=params.has('debug'),testMode=params.get('test')==='1',gamepadButtonState=[];
let moveStick={x:0,y:0},aimStick={x:0,y:0},viewVersion='',pendingOnline=false;
const persist=()=>{try{localStorage.setItem('pelt-profile',JSON.stringify(profile));}catch{toast('Progress cannot be saved in this browser session.');}};
function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),4500);}
sound.muted=profile.muted;
try{world=new World($('#world'));world.setQuality(profile.quality);world.heroScene(profile.character,profile.hat,season);}catch(error){app.innerHTML='<main class="unsupported"><h1>A little more graphics power?</h1><p>Pelt Party needs WebGL. Try opening this link in Safari or Chrome with hardware acceleration enabled.</p><button onclick="location.reload()">Try again</button></main>';throw error;}
const pumpkinIcon='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M17 8c0-4 3-5 5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><ellipse cx="11" cy="19" rx="7" ry="10" fill="currentColor"/><ellipse cx="21" cy="19" rx="7" ry="10" fill="currentColor"/><ellipse cx="16" cy="19" rx="6" ry="10" fill="currentColor" stroke="#201b2e" stroke-width="1.5"/></svg>';
function button(action,label,cls='',extra=''){return `<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;}
function nav(){return `<header class="nav"><a class="brand" href="#" data-action="home">${pumpkinIcon}<span>pelt party<span class="brand-dot">✦</span></span></a><div class="nav-right"><span class="edition"><i></i>${SEASONS[season].label}</span>${button('sound',profile.muted?'Sound off':'♪ Sound on','nav-button')}${button('settings','⚙','icon-button','aria-label="Settings"')}</div></header>`;}
function home(){
  const s=SEASONS[season];screen='home';modal=null;document.body.className='home';
  app.innerHTML=`${nav()}<main class="hero"><div class="hero-copy"><div class="eyebrow"><span class="line"></span> LITTLE PELTS. BIG FEELINGS.</div><h1>A little<br>friendly <em>fire.</em></h1><p class="intro">Big heads. Tiny grudges.<br>A cozy ${s.pelt==='pumpkins'?'pumpkin':s.pelt==='snowballs'?'snowball':'seasonal'} fight with your favorite people.</p><div class="play-actions">${button('solo',`${pumpkinIcon}<span>Play vs bots<small>Jump right in · no waiting</small></span><b>↗</b>`,'primary play-main')}${button('quick','<span>Quick Play</span><span>Find your people ↗</span>','secondary')}</div><div class="friend-actions">${button('create','+ Create a room','text-button')}<span></span>${button('join','Join with a code →','text-button')}</div><div class="hero-facts"><span>◷ 3-minute matches</span><span>♧ Up to 20 friends</span><span>↗ No login. Just play.</span></div></div><div class="scene-caption"><span class="scene-tag">${pumpkinIcon} ${s.name}</span><p>A fresh season. A fresh reason to splat.</p></div></main><footer class="home-footer"><div class="profile-chip"><span class="avatar-dot" style="--avatar:${CHARACTERS.find(c=>c.id===profile.character)?.color}">☺</span><div><small>READY TO CAUSE A LITTLE TROUBLE</small><strong>${esc(profile.name)}</strong></div>${button('wardrobe','Edit look ↗','text-button')}</div><div class="footer-links">${button('how','How to play','text-button')}${button('vault','Season Vault','text-button')}${button('wardrobe',`◈ ${profile.coins} <span class="hide-small">Practice coins</span>`,'coin-button')}</div><span class="build">EARLY ACCESS · ${BUILD}</span></footer>${season!=='halloween'?button('halloween','↶ Play the Halloween Edition','halloween-link'):''}`;
  bind();
}
function dialog(kind){
  modal=kind;let title='',eyebrow='',body='';
  if(kind==='solo'){
    eyebrow='YOUR OWN LITTLE PUMPKIN PATCH';title='Make some mischief.';
    body=`<p class="muted">A full match, right in your browser. Bots are clearly labeled and practice rewards stay on this device.</p><label>Your name<input id="name" maxlength="16" value="${esc(profile.name)}" autocomplete="nickname"></label><div class="form-row"><label>Company<select id="size"><option value="4">4 players</option><option value="8" selected>8 players</option><option value="12">12 players</option><option value="20">20 players · stress test</option></select></label><label>Bot difficulty<select id="difficulty"><option value="rookie">Rookie · gentle</option><option value="regular" selected>Regular · playful</option><option value="ace">Ace · quick</option></select></label></div><div class="form-row"><label>Playground<select id="map">${MAPS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}</select></label><label>Game<select id="mode"><option value="ffa">Pelt Party</option><option value="team">Team Pelt</option><option value="king">King of the Patch</option></select></label></div>${button('start-solo','Let’s get splatted →','primary wide')}`;
  }
  if(kind==='join'){
    eyebrow='BETTER TOGETHER';title='Find your friends.';
    body=`<p class="muted">Ask a friend for their four-character room code.</p><label>Room code<input id="code" class="code-input" maxlength="4" placeholder="K7PM" autocapitalize="characters" autocomplete="off"></label><label>Your name<input id="name" maxlength="16" value="${esc(profile.name)}"></label><label class="check"><input id="watch" type="checkbox"> Just watching this time</label>${button('join-room','Join the party →','primary wide')}`;
  }
  if(kind==='settings'){
    eyebrow='GET COMFORTABLE';title='Your kind of cozy.';
    body=`<label>Your nickname<input id="name" maxlength="16" value="${esc(profile.name)}"></label><label>Graphics<select id="quality"><option value="low" ${profile.quality==='low'?'selected':''}>Low · keep it light</option><option value="mid" ${profile.quality==='mid'?'selected':''}>Balanced</option><option value="high" ${profile.quality==='high'?'selected':''}>High</option></select></label><label class="check"><input id="reduced" type="checkbox" ${profile.reduced?'checked':''}> Reduced motion</label><label class="check"><input id="debug-toggle" type="checkbox" ${debug?'checked':''}> Show performance and connection details</label><p class="muted small">Build ${BUILD}. Online progress and Rescue Codes are coming later. Your current wardrobe and practice coins are stored on this browser.</p>${button('save-settings','All comfy →','primary wide')}`;
  }
  if(kind==='how'){
    eyebrow='PUMPKIN 101';title='Scoop. Lob. Laugh.';
    body=`<div class="how-grid"><div><b>01</b><h3>Find your feet</h3><p>WASD / arrows to move. On a phone, use the left stick.</p></div><div><b>02</b><h3>Make it a splat</h3><p>Aim with your mouse and click to lob. Hold for a Big Pelt. On touch, aim and release the right stick.</p></div><div><b>03</b><h3>Duck and restock</h3><p>Space rolls. Stand in a pumpkin pile to refill. Q builds a fort; E uses your pickup.</p></div><div><b>04</b><h3>Be a good sport</h3><p>Three hearts, then a quick respawn. Most splats wins. Gamepad: sticks, right trigger, A roll, X power, Y fort.</p></div></div>${button('close','Got it. Let’s play.','primary wide')}`;
  }
  if(kind==='vault'){
    eyebrow='A PARTY FOR EVERY SEASON';title='Pick your weather.';
    body=`<p class="muted">Season previews share the current three playgrounds. Full seasonal maps and collections are still growing.</p><div class="season-grid">${Object.entries(SEASONS).map(([id,s])=>button(`season:${id}`,`<span style="color:${s.accent}">${id==='halloween'?'◉':id==='harvest'?'♧':id==='frost'?'❄':'✿'}</span><strong>${s.name}</strong><small>${id===season?'Playing now':'Visit season →'}</small>`,'season-card')).join('')}</div>`;
  }
  if(kind==='wardrobe'){
    eyebrow='A SMALL OUTFIT. A BIG PERSONALITY.';title='The dressing patch.';
    body=`<div class="wallet">◈ ${profile.coins} practice coins <small>Saved on this device</small></div><div class="character-grid">${CHARACTERS.map(c=>button(`character:${c.id}`,`<span style="background:${c.color}">☺</span><b>${c.name}</b>`,profile.character===c.id?'selected':'')).join('')}</div><h3>A little something on top</h3><div class="cosmetic-grid">${COSMETICS.map(c=>button(`hat:${c.id}`,`<span>${({none:'☺',pumpkin:'◉',witch:'△',cat:'♧',crown:'♛'})[c.id]}</span><strong>${c.name}</strong><small>${profile.hat===c.id?'Wearing it':profile.owned.includes(c.id)?'Owned · put it on':`◈ ${c.price} · ${c.rarity}`}</small>`,profile.hat===c.id?'selected':'')).join('')}</div><p class="muted small">These are your original chibis. This first build includes four looks; character abilities are still in development.</p>`;
  }
  if(kind==='leave'){eyebrow='HEADING OUT?';title='One more pelt?';body=`<p class="muted">Leaving this match ends your session. You can jump into another whenever you like.</p><div class="form-row">${button('close','Keep playing','primary')}${button('confirm-leave','Leave match','secondary')}</div>`;}
  if(kind==='error'){eyebrow='A LITTLE BUMP IN THE PATCH';title='Let’s try that again.';body=`<p>${esc(errorText)}</p>${button('confirm-leave','Back to the patch','primary wide')}`;}
  $('#modal')?.remove();const el=document.createElement('div');el.id='modal';el.className=`modal-backdrop ${kind==='wardrobe'?'wardrobe-modal':''}`;el.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-heading"><span class="eyebrow">${eyebrow}</span>${button('close','×','close-button','aria-label="Close dialog"')}</div><h2 id="dialog-title">${title}</h2>${body}</section>`;app.append(el);bind(el);el.querySelector('input,select,button')?.focus();
}
function closeDialog(){modal=null;$('#modal')?.remove();}
function getName(){const n=safeName($('#name')?.value||profile.name);if(!n){toast('Choose a friendly nickname with letters and numbers.');return false;}profile.name=n;persist();return true;}
function bind(root=app){root.querySelectorAll('[data-action]').forEach(el=>el.onclick=async e=>{e.preventDefault();sound.unlock();sound.play('tap');await action(el.dataset.action);});}
async function action(a){
  if(a==='home'){if(room||wire)dialog('leave');return;}
  if(['solo','join','settings','wardrobe','vault','how'].includes(a)){dialog(a);return;}
  if(a==='close'){closeDialog();return;}
  if(a==='sound'){profile.muted=!profile.muted;sound.muted=profile.muted;if(!profile.muted)sound.unlock();persist();if(screen==='home')home();return;}
  if(a==='save-settings'){if(!getName())return;profile.quality=$('#quality').value;profile.reduced=$('#reduced').checked;debug=$('#debug-toggle').checked;world.setQuality(profile.quality);persist();closeDialog();if(screen==='home')home();else renderGame();return;}
  if(a==='start-solo'){if(!getName())return;startSolo(+$('#size').value,$('#difficulty').value,$('#map').value,$('#mode').value);return;}
  if(a==='create'||a==='quick'){if(pendingOnline)return;pendingOnline=true;toast(a==='quick'?'Finding a patch for you…':'Growing a room…');try{const result=await api(a==='quick'?'/api/quick':'/api/rooms',{token,season});openRoom(result.code);}catch(e){toast(e.message);}finally{pendingOnline=false;}return;}
  if(a==='join-room'){if(!getName())return;const code=$('#code').value.trim().toUpperCase();if(!CODE.test(code)){toast('Use the four-character code your friend sees.');return;}openRoom(code,$('#watch').checked);return;}
  if(a==='copy'){try{await navigator.clipboard.writeText(`${location.origin}/?room=${state.code}`);toast('Room link copied. Send it to your friends!');}catch{toast(`Your room code is ${state.code}`);}return;}
  if(a==='start'){send({t:'start'});return;}
  if(a==='ready'){const p=state.players.find(p=>p.slot===mySlot);send({t:'ready',on:!p?.ready});return;}
  if(a==='fill'){send({t:'fill'});return;}
  if(a==='leave'){dialog('leave');return;}
  if(a==='confirm-leave'){stop();home();world.heroScene(profile.character,profile.hat,season);return;}
  if(a==='rematch'){if(room){startSolo(room.active.length,room.difficulty,room.mapId,room.mode);}else{closeDialog();toast('The next lobby opens shortly.');}return;}
  if(a==='skip'){tutorialUntil=0;profile.tutorial=true;persist();$('#tutorial')?.remove();return;}
  if(a==='roll'){roll();return;}if(a==='fort'){send({t:'fort'});return;}if(a==='power'){send({t:'use'});return;}
  if(a==='halloween'||a.startsWith('season:')){season=a==='halloween'?'halloween':a.split(':')[1];persist();closeDialog();world.heroScene(profile.character,profile.hat,season);home();return;}
  if(a.startsWith('character:')){profile.character=a.split(':')[1];persist();world.heroScene(profile.character,profile.hat,season);dialog('wardrobe');return;}
  if(a.startsWith('hat:')){const id=a.split(':')[1],item=COSMETICS.find(c=>c.id===id);if(!profile.owned.includes(id)){if(profile.coins<item.price){toast('A few more practice matches will get you there.');return;}profile.coins-=item.price;profile.owned.push(id);}profile.hat=id;persist();world.heroScene(profile.character,profile.hat,season);dialog('wardrobe');}
}
function stop(){wire?.close();wire=null;room=null;state=null;local=null;tracks.clear();poses.clear();hitSent.clear();world.clearActors();keys.clear();closeDialog();try{sessionStorage.removeItem('pelt-room');}catch{}history.replaceState(null,'',location.pathname+location.search.replace(/([?&])room=[^&]*(&?)/,'$1').replace(/[?&]$/,''));}
function startSolo(size=8,difficulty='regular',map='patch',mode='ffa'){
  stop();screen='game';status='local';mySlot=0;const now=Date.now();room=new Room({season,map,now,emit:m=>receive(structuredClone(m))});room.mode=mode;room.join({name:profile.name,character:profile.character,hat:profile.hat},now);room.start(now,{fill:true,size,difficulty});tutorialUntil=profile.tutorial?0:room.startAt+45000;profile.tutorial=true;persist();renderGame();history.pushState({match:true},'',location.href);
}
function openRoom(code,watch=false){
  stop();screen='connecting';status='connecting';document.body.className='in-game';app.innerHTML=`${nav()}<div class="connecting card"><span class="eyebrow">ROOM ${esc(code)}</span><h2>Finding your friends…</h2><p>A little room for a little chaos.</p>${button('confirm-leave','Back','secondary')}</div>`;bind();try{sessionStorage.setItem('pelt-room',JSON.stringify({code,watch}));}catch{}
  wire=connect({code,name:profile.name,character:profile.character,hat:profile.hat,watch,token,onMessage:receive,onStatus:s=>{status=s;},onError:e=>{errorText=e;dialog('error');}});history.pushState({match:true},'',`?room=${code}`);
}
function send(m){if(!state)return;const msg={...m,r:state.round};if(room)room.command(mySlot,msg,Date.now());else wire?.send(msg);}
function receive(m){
  if(m.t==='welcome')mySlot=m.slot;
  if(m.t==='state'||m.t==='welcome'){
    const phase=state?.phase,roundChanged=!state||state.round!==m.round;state=m;season=m.season;const p=m.players.find(p=>p.slot===mySlot);
    if(p&&(!local||roundChanged||m.t==='welcome'))local={x:p.x,z:p.z,facing:p.facing||0,vx:0,vz:0};
    if(roundChanged){tracks.clear();hitSent.clear();lastSnap=0;world.clearActors();}
    world.sync(state,mySlot);screen=m.phase==='lobby'?'lobby':'game';
    if(m.phase==='results'&&phase!=='results'){
      const key=`${m.code}-${m.round}-${m.startAt}`;if(room&&!paid.has(key)){paid.add(key);profile.coins+=m.results.find(r=>r.slot===mySlot)?.coins||0;persist();}sound.play('win');
    }
    renderGame();return;
  }
  if(!state||m.round!==undefined&&m.round!==state.round)return;
  if(m.t==='world'){for(const p of m.players){if(p.slot===mySlot)continue;let tr=tracks.get(p.slot);if(!tr){tr=new RemoteTrack();tracks.set(p.slot,tr);}tr.push(p,m.now,now(),rateFor(state.players.length));}return;}
  if(m.t==='stats'){const p=state.players.find(p=>p.slot===m.player.slot);if(!p)return;const respawned=p.respawnAt&&!m.player.respawnAt;Object.assign(p,m.player);if(p.slot===mySlot&&respawned)local={...local,x:p.x,z:p.z,vx:0,vz:0};return;}
  if(m.t==='throw'){if(m.clientId)state.pelts=state.pelts.filter(p=>p.id!==m.clientId);if(!state.pelts.some(p=>p.id===m.pelt.id))state.pelts.push(m.pelt);world.animate(m.pelt.by,'throw',350);if(m.pelt.by!==mySlot)sound.play('throw');return;}
  if(m.t==='remove'){state.pelts=state.pelts.filter(p=>p.id!==m.id);return;}
  if(m.t==='pads'){state.pads=m.pads;return;}if(m.t==='forts'){state.forts=m.forts;return;}
  if(m.t==='correct'&&m.slot===mySlot){Object.assign(local,{x:m.x,z:m.z});return;}
  if(m.t==='fx'){world.fx(m.x,m.z,m.kind);world.animate(m.slot,m.kind==='hit'?'hit':m.kind==='roll'?'roll':'idle',m.kind==='roll'?280:300);sound.play(m.kind);}
}
function renderGame(){
  if(!state)return;modal=null;document.body.className='in-game';const me=state.players.find(p=>p.slot===mySlot);
  if(state.phase==='lobby'){
    screen='lobby';app.innerHTML=`${nav()}<main class="lobby card"><div class="eyebrow">${state.publicRoom?'AN OPEN INVITATION':'YOUR FRIENDS-ONLY PATCH'}</div><h2>${state.publicRoom?'A party is growing.':'Good company. Bad aim.'}</h2><div class="room-code"><span>ROOM CODE</span><strong>${state.code}</strong>${button('copy','Copy invite ↗','text-button')}</div><div class="lobby-players">${state.players.map(p=>`<div><span class="player-dot" style="background:${CHARACTERS.find(c=>c.id===p.character)?.color}"></span><b>${esc(p.name)}</b><small>${p.spectator?'watching':p.bot?'BOT':p.ready?'READY ✓':p.slot===state.host?'HOST':'HERE'}</small></div>`).join('')}</div><p id="lobby-clock">${state.players.filter(p=>!p.spectator).length} / ${state.minPlayers} players to auto-start</p><div class="form-row">${button('ready',me?.ready?'Ready ✓':'I’m ready','primary')}${!state.publicRoom&&state.host===mySlot?button('start','Start now →','secondary'):''}</div><div id="bot-fill"></div><p class="muted small">${state.publicRoom?'Bots join only when a majority chooses to fill.':'Starting alone fills your room with bots.'}</p>${button('leave','Leave room','text-button')}</main><div id="connection" role="status"></div>`;bind();return;
  }
  screen='game';app.innerHTML=`<header class="game-top"><div class="game-brand">${pumpkinIcon}<span>pelt party</span>${button('leave','↶','icon-button','aria-label="Leave match"')}</div><div class="match-clock"><small>${state.mode==='team'?'TEAM PELT':state.mode==='king'?'KING OF THE PATCH':'PELT PARTY'}</small><strong id="time">3:00</strong></div><div class="room-chip">${room?'PRACTICE MATCH':`ROOM ${state.code}`}<small id="ping">${room?'Browser-only bots':'Connecting…'}</small></div></header><div class="game-status"><div class="health"><span id="hearts">♥ ♥ ♥</span><small id="ammo">● ● ● ○ ○ ○</small></div><div class="score-mini" id="score"></div></div><div id="phase-banner"></div><div id="connection" role="status"></div><div class="game-bottom"><div class="control-guide"><span><kbd>WASD</kbd> move</span><span><kbd>CLICK</kbd> lob · hold to pack</span><span><kbd>SPACE</kbd> roll</span><span><kbd>Q</kbd> fort</span><span><kbd>E</kbd> power</span></div><div class="touch-controls"><div id="move-stick" class="stick" aria-label="Move"><span></span><small>MOVE</small></div><div class="touch-buttons">${button('fort','▤','round-button','aria-label="Build fort"')}${button('power','✦','round-button','aria-label="Use power-up"')}${button('roll','↝','round-button roll-button','aria-label="Roll"')}</div><div id="aim-stick" class="stick aim-stick" aria-label="Aim and release to throw"><span></span><small>AIM + RELEASE</small></div></div><div class="ability-chips"><span id="roll-status">ROLL READY</span><span id="power-status">FIND A MYSTERY GOURD</span></div></div>${tutorialUntil?'<div id="tutorial" class="tutorial"><span class="eyebrow">PUMPKIN 101</span><strong id="tutorial-text">Find your feet. Move with WASD or the left stick.</strong>'+button('skip','Skip hints ×','text-button')+'</div>':''}${debug?'<pre id="debug"></pre>':''}`;
  if(state.phase==='results'){
    const mine=state.results.find(p=>p.slot===mySlot);app.innerHTML+=`<div class="results-wrap"><section class="results card"><span class="eyebrow">A BEAUTIFUL LITTLE MESS</span><h2>${mine?.draw?'A perfect tie.':mine?.place===1?'Gourd almighty!':'Well splatted.'}</h2><p>${mine?(state.mode==='ffa'?`You placed #${mine.place} with ${mine.score} splats.`:`${mine.draw?'Both teams tied':`${mine.team===0?'Pumpkin':'Plum'} team ${mine.place===1?'wins':'finishes second'}`} · ${mine.teamScore} points. Your contribution: ${mine.score}.`):'Thanks for cheering everyone on.'}</p><ol>${state.results.slice(0,5).map(p=>`<li class="${p.slot===mySlot?'you':''}"><span>${p.place}</span><b>${esc(p.name)}</b><strong>${p.score}</strong></li>`).join('')}</ol><div class="reward">◈ +${mine?.coins||0}<small>${room?'practice coins · saved on this device':'match coins · online wallet not yet available'}</small></div><div class="form-row">${button('rematch','Again? Again.','primary')}${button('confirm-leave','Back to the patch','secondary')}</div></section></div>`;
  }
  bind();bindSticks();
}
function bindSticks(){for(const [id,kind]of [['move-stick','move'],['aim-stick','aim']]){const el=$('#'+id);if(!el)continue;let active=null;const update=e=>{const r=el.getBoundingClientRect(),x=clamp((e.clientX-r.left-r.width/2)/(r.width*.35),-1,1),y=clamp((e.clientY-r.top-r.height/2)/(r.height*.35),-1,1),d=Math.hypot(x,y),v={x:x/Math.max(1,d),y:y/Math.max(1,d)};if(kind==='move')moveStick=v;else aimStick=v;el.querySelector('span').style.transform=`translate(${v.x*30}px,${v.y*30}px)`;};el.onpointerdown=e=>{e.preventDefault();active=e.pointerId;el.setPointerCapture(e.pointerId);sound.unlock();update(e);if(kind==='aim')chargeAt=performance.now();};el.onpointermove=e=>{if(e.pointerId===active)update(e);};const up=e=>{if(e.pointerId!==active)return;if(kind==='aim'&&e.type!=='pointercancel')shoot();active=null;if(kind==='move')moveStick={x:0,y:0};else{aimStick={x:0,y:0};chargeAt=0;}el.querySelector('span').style.transform='';};el.onpointerup=up;el.onpointercancel=up;}}
function now(){return wire?wire.now():Date.now();}
function shoot(){if(!state||state.phase!=='playing'||modal)return;const p=state.players.find(p=>p.slot===mySlot),at=now(),charged=chargeAt&&performance.now()-chargeAt>=900;chargeAt=0;if(!p||p.spectator||p.respawnAt||p.ammo<(charged?2:1)||at-lastShot<(charged?1000:420))return;lastShot=at;const id=`pred-${++shotCounter}`;world.animate(mySlot,'throw',350);sound.play('throw');if(wire)state.pelts.push(makePelt(id,mySlot,local,aim,charged,at));send({t:'throw',id,x:aim.x,z:aim.z,charge:!!charged});}
function roll(){const p=state?.players.find(p=>p.slot===mySlot);if(!p||state.phase!=='playing'||p.respawnAt||now()<p.rollReady)return;rollVec={x:Math.sin(local.facing),z:Math.cos(local.facing)};rollEnd=performance.now()+280;send({t:'roll'});world.animate(mySlot,'roll',280);sound.play('roll');}
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.code==='Escape'){if(modal)closeDialog();else if(state)dialog('leave');return;}keys.add(e.code);if(state&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Space')roll();if(e.code==='KeyQ')send({t:'fort'});if(e.code==='KeyE')send({t:'use'});});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();moveStick={x:0,y:0};aimStick={x:0,y:0};chargeAt=0;});
$('#world').addEventListener('pointermove',e=>{if(e.pointerType!=='touch')aim=world.aim(e.clientX,e.clientY);});
$('#world').addEventListener('pointerdown',e=>{sound.unlock();if(e.button===0&&state?.phase==='playing'&&!modal){chargeAt=performance.now();aim=world.aim(e.clientX,e.clientY);}});
window.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'&&chargeAt)shoot();});
window.addEventListener('popstate',()=>{if(state){history.pushState({match:true},'',location.href);dialog('leave');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();chargeAt=0;moveStick={x:0,y:0};aimStick={x:0,y:0};sound.ctx?.suspend();}else if(!sound.muted)sound.ctx?.resume();});

function frame(t){
  requestAnimationFrame(frame);const dt=Math.min(.05,(t-lastFrame)/1000);lastFrame=t;fps=fps*.95+(1/Math.max(.001,dt))*.05;if(document.hidden)return;
  const time=now();if(room){room.step(time);for(const p of room.players)if(p.bot){const sp=state?.players.find(q=>q.slot===p.slot);if(sp)Object.assign(sp,{x:p.x,z:p.z,vx:p.vx,vz:p.vz,facing:p.facing});}}
  if(state&&local){
    const me=state.players.find(p=>p.slot===mySlot);let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+moveStick.x,z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+moveStick.y;
    const gp=navigator.getGamepads?.()[0];if(gp&&!modal){if(Math.abs(gp.axes[0])>.15)x=gp.axes[0];if(Math.abs(gp.axes[1])>.15)z=gp.axes[1];if(Math.hypot(gp.axes[2],gp.axes[3])>.2)aim={x:local.x+gp.axes[2]*10,z:local.z+gp.axes[3]*10};const pressed=gp.buttons[7]?.pressed;if(pressed&&!gamepadThrow)chargeAt=t;if(!pressed&&gamepadThrow)shoot();gamepadThrow=pressed;for(const [index,act]of [[0,'roll'],[2,'power'],[3,'fort']]){if(gp.buttons[index]?.pressed&&!gamepadButtonState[index])action(act);gamepadButtonState[index]=gp.buttons[index]?.pressed;}}
    if(Math.hypot(aimStick.x,aimStick.y)>.1)aim={x:local.x+aimStick.x*12,z:local.z+aimStick.y*12};
    const moving=state.phase==='playing'&&!me?.respawnAt&&!me?.spectator&&!modal&&status!=='reconnecting';const d=Math.max(1,Math.hypot(x,z)),speed=5.2;
    local.vx=moving?x/d*speed:0;local.vz=moving?z/d*speed:0;
    if(moving&&t<rollEnd){local.vx=rollVec.x*15;local.vz=rollVec.z*15;}
    if(moving){Object.assign(local,moveBody(local,local.vx,local.vz,dt,state.map,state.forts));if(Math.hypot(local.vx,local.vz)>.2)local.facing=Math.atan2(local.vx,local.vz);if(chargeAt){local.facing=Math.atan2(aim.x-local.x,aim.z-local.z);world.animate(mySlot,'charge',80);}}
    if(state.phase==='playing'&&!me?.spectator&&time-lastSnap>=1000/rateFor(state.players.filter(p=>!p.spectator).length)){lastSnap=time;send({t:'snap',...local});}
    if(moving&&me){for(const shot of state.pelts){if(shot.by===mySlot||shot.id.startsWith('pred-')||time<shot.release||time>shot.release+shot.T*1000+60||time-(hitSent.get(shot.id)||0)<150)continue;const by=state.players.find(p=>p.slot===shot.by);if(state.mode!=='ffa'&&by?.team===me.team)continue;if(sweptHit(peltAt(shot,time-dt*1000),peltAt(shot,time),local)){hitSent.set(shot.id,time);send({t:'hit',id:shot.id,tm:time});}}}
    for(const [id,at]of hitSent)if(time-at>10000)hitSent.delete(id);
    state.pelts=state.pelts.filter(p=>!p.id.startsWith('pred-')||time<p.release+p.T*1000+500);
    poses.clear();for(const p of state.players){const pose=p.slot===mySlot?local:room?p:tracks.get(p.slot)?.sample(time)||p;poses.set(p.slot,pose);}
    updateHud(time,me);
  }
  world.render(dt,time,state,poses,mySlot,aim,profile.reduced);
}
function updateHud(time,me){
  const set=(id,text)=>{const el=$('#'+id);if(el&&el.textContent!==text)el.textContent=text;};
  if(state.phase==='lobby'){
    set('lobby-clock',state.deadline?`Match starts in ${Math.max(0,Math.ceil((state.deadline-time)/1000))}…`:`${state.players.filter(p=>!p.spectator&&p.connected).length} / ${state.minPlayers} players to auto-start`);
    if(state.publicRoom&&!state.deadline&&time-state.waitSince>=20000&&$('#bot-fill')&&!$('#bot-fill button')){$('#bot-fill').innerHTML=button('fill','Fill with bots →','secondary wide');bind($('#bot-fill'));}
  }
  if(state.phase!=='lobby'){
    const left=Math.max(0,Math.ceil((state.endAt-time)/1000));set('time',`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`);set('hearts',me?.spectator?'WATCHING':'♥ '.repeat(me?.hp||0)+'♡ '.repeat(3-(me?.hp||0)));set('ammo',me?.spectator?'Enjoy the party':'● '.repeat(me?.ammo||0)+'○ '.repeat(6-(me?.ammo||0)));
    set('score',state.mode==='ffa'?`YOUR SPLATS  ${me?.score||0}`:`● ${state.players.filter(p=>p.team===0).reduce((n,p)=>n+p.score,0)}  :  ${state.players.filter(p=>p.team===1).reduce((n,p)=>n+p.score,0)} ▲`);set('roll-status',time<(me?.rollReady||0)?`ROLL  ${((me.rollReady-time)/1000).toFixed(1)}s`:'ROLL READY');set('power-status',me?.power?`${me.power.toUpperCase()} · E TO USE`:'FIND A MYSTERY GOURD');
    set('phase-banner',state.phase==='starting'?`Ready… ${Math.max(1,Math.ceil((state.startAt-time)/1000))}`:me?.respawnAt?`A little splat. Back in ${Math.max(1,Math.ceil((me.respawnAt-time)/1000))}…`:time-state.startAt<1500?'LET’S GET SPLATTED!':'');
    if(tutorialUntil){const left=tutorialUntil-time;if(left<=0){tutorialUntil=0;$('#tutorial')?.remove();}else{const index=clamp(Math.floor((45-left/1000)/9),0,4);set('tutorial-text',['Move with WASD or the left stick. Your character wears a golden ring.','Aim and lob! Click, or drag and release the right stick.','Hold your throw for a Big Pelt. It uses two ammo.','Space or ↝ rolls out of trouble. Stand in a pile to restock.','Q builds a fort. Pick up a glowing gourd, then press E.'][index]);}}
  }
  socketStats=wire?.stats||{};set('ping',wire?`${Math.round(socketStats.rtt||0)} ms · ${status==='online'?'live':status}`:'Local bots · no server');set('connection',status==='reconnecting'?'Connection lost — finding your seat again…':(socketStats.rtt||0)>250?'Slow connection — your own movement stays local.':'');
  if(debug)set('debug',`BUILD ${BUILD}\n${room?'LOOPBACK':'WEBSOCKET'} · ${state.code}\n${Math.round(fps)} FPS · ${world.metrics.calls} calls · ${world.metrics.triangles.toLocaleString()} tris\nRTT ${Math.round(socketStats.rtt||0)} ms · jitter ${Math.round(socketStats.jitter||0)} ms\noffset ${Math.round(socketStats.offset||0)} ms · ${rateFor(state.players.length)} Hz\n${(socketStats.downKB||0).toFixed(2)} KB/s down · ${state.players.length} seats`);
}
home();requestAnimationFrame(frame);
const deepCode=params.get('room')?.toUpperCase();if(deepCode&&CODE.test(deepCode))openRoom(deepCode);else{let resume;try{resume=JSON.parse(sessionStorage.getItem('pelt-room')||'null');}catch{}if(resume&&CODE.test(resume.code))openRoom(resume.code,resume.watch);}
// Test hooks are available only on the explicitly requested local test URL.
if(testMode)window.__pelt={get state(){return state;},get room(){return room;},get local(){return local;},get metrics(){return world.metrics;},startSolo,send,finish(){room?.finish(Date.now());},stop,profile};
