import {BUILD,SEASONS,CHARACTERS,COSMETICS,MAPS,POWERS} from '../shared/content.mjs';
import {FPS_CAPS} from './settings.js';

export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(action,label,cls='',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const SEASON_ICON={halloween:'🎃',harvest:'🍂',frost:'❄️',meadow:'🌼'};
export const levelOf=xp=>Math.floor(Math.sqrt(Math.max(0,xp)/60))+1;
const xpFor=l=>60*(l-1)**2;

export function logo(season){
  return `<div class="logo ${season}"><span class="logo-cap"></span><span class="logo-1">PELT</span><span class="logo-2">PARTY</span><span class="logo-tag">${SEASON_ICON[season]} ${SEASONS[season].name.toUpperCase()}</span></div>`;
}
function profileCard(profile){
  const lvl=levelOf(profile.xp),pct=Math.round((profile.xp-xpFor(lvl))/(xpFor(lvl+1)-xpFor(lvl))*100);
  const c=CHARACTERS.find(c=>c.id===profile.character);
  return `<button class="profile-card" data-action="locker"><span class="avatar" style="--c:${c?.color}">${esc(profile.name[0]||'?')}</span><span class="who"><b>${esc(profile.name)}</b><small>LEVEL ${lvl} · ${c?.name||''}</small><span class="xp"><i style="width:${pct}%"></i></span></span><span class="coins">◈ ${profile.coins}</span></button>`;
}
export function menu({profile,season,muted}){
  return `<main class="menu">
    <nav class="menu-left">
      ${logo(season)}
      <div class="menu-items">
        ${btn('play','<span>PLAY</span><small>vs bots · instant</small>','menu-item primary')}
        ${btn('quick','<span>QUICK PLAY</span><small>online · public match</small>','menu-item')}
        ${btn('create','<span>CREATE ROOM</span><small>invite friends with a code</small>','menu-item')}
        ${btn('join','<span>JOIN ROOM</span><small>enter a 4-letter code</small>','menu-item')}
        <div class="menu-row">${btn('locker','LOCKER','menu-mini')}${btn('settings','SETTINGS','menu-mini')}${btn('how','HOW TO PLAY','menu-mini')}</div>
      </div>
      ${profileCard(profile)}
    </nav>
    <div class="menu-top">${btn('vault',`${SEASON_ICON[season]} ${SEASONS[season].label}`,'chip')}${btn('mute',muted?'🔇':'🔊','chip icon','aria-label="Toggle sound"')}</div>
    <div class="menu-news"><b>NEW</b> Dive, slide and throw up walls. 4 new maps · 10 chibis · up to 20 players.</div>
    <footer class="menu-foot">v${BUILD} · no login · runs in your browser</footer>
    ${season!=='halloween'?btn('season:halloween','🎃 Play the Halloween Edition','halloween-link'):''}
  </main>`;
}
export function panel(kind,title,body,{wide=false,sub=''}={}){
  return `<div class="panel-backdrop" data-close="1"><section class="panel ${wide?'wide':''} panel-${kind}" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header><div><small>${sub}</small><h2 id="panel-title">${title}</h2></div>${btn('close','✕','close','aria-label="Close"')}</header><div class="panel-body">${body}</div></section></div>`;
}
const seg=(name,options,value)=>`<div class="seg" data-seg="${name}">${options.map(([v,l])=>`<button type="button" class="${String(v)===String(value)?'on':''}" data-value="${v}">${l}</button>`).join('')}</div>`;
export function playSetup(last){
  return panel('play','Play vs bots',`
    <h4>ARENA</h4><div class="map-grid">${MAPS.map(m=>`<button type="button" class="map-card ${m.id===last.map?'on':''} map-${m.id}" data-map="${m.id}"><span class="map-icon">${m.icon}</span><b>${m.name}</b><small>${m.caption}</small></button>`).join('')}</div>
    <div class="form-grid">
      <label>MODE${seg('mode',[['ffa','Free-for-all'],['team','Teams'],['king','King of the Hill']],last.mode)}</label>
      <label>PLAYERS${seg('size',[[4,'4'],[8,'8'],[12,'12'],[16,'16'],[20,'20']],last.size)}</label>
      <label>BOTS${seg('difficulty',[['rookie','Rookie'],['regular','Regular'],['ace','Ace']],last.difficulty)}</label>
    </div>
    ${btn('start-solo','START MATCH ▸','big-go')}`,{sub:'BROWSER-ONLY · NO WAITING',wide:true});
}
export function joinPanel(name){
  return panel('join','Join a room',`<label>ROOM CODE<input id="code" class="code-input" maxlength="4" placeholder="K7PM" autocapitalize="characters" autocomplete="off" spellcheck="false"></label><label>YOUR NAME<input id="name" maxlength="16" value="${esc(name)}"></label><label class="check"><input id="watch" type="checkbox"> Just spectate</label>${btn('join-room','JOIN ▸','big-go')}`,{sub:'BETTER TOGETHER'});
}
export function locker(profile,tab='characters'){
  const items=tab==='characters'?CHARACTERS.map(c=>{const owned=profile.ownedChars.includes(c.id),on=profile.character===c.id;return `<button class="item ${on?'on':''} ${owned?'':'locked'}" data-action="character:${c.id}"><span class="swatch" style="--c:${c.color}">${c.name[0]}</span><b>${c.name}</b><small>${on?'EQUIPPED':owned?c.title:`◈ ${c.price}`}</small></button>`;}).join('')
    :COSMETICS.map(c=>{const owned=profile.owned.includes(c.id),on=profile.hat===c.id;return `<button class="item ${on?'on':''} ${owned?'':'locked'} r-${c.rarity.toLowerCase()}" data-action="hat:${c.id}"><span class="swatch">${c.icon}</span><b>${c.name}</b><small>${on?'EQUIPPED':owned?c.rarity.toUpperCase():`◈ ${c.price}`}</small></button>`;}).join('');
  return `<aside class="locker"><header><div><small>LOCKER</small><h2>Look sharp.</h2></div>${btn('close','✕','close','aria-label="Close"')}</header>
    <label class="name-field">NICKNAME<input id="name" maxlength="16" value="${esc(profile.name)}"></label>
    <div class="tabs">${btn('tab:characters','CHIBIS',tab==='characters'?'on':'')}${btn('tab:hats','HATS',tab==='hats'?'on':'')}<span class="wallet">◈ ${profile.coins}</span></div>
    <div class="item-grid">${items}</div><p class="fine">Coins come from matches and are saved on this device.</p></aside>`;
}
const slider=(id,label,value,min,max,step,fmt=v=>v)=>`<label class="slider">${label}<span><input type="range" id="set-${id}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${fmt(value)}</output></span></label>`;
const toggle=(id,label,on)=>`<label class="toggle">${label}<input type="checkbox" id="set-${id}" ${on?'checked':''}><i></i></label>`;
export function settingsPanel(s,tab='graphics'){
  const tabs=[['graphics','GRAPHICS'],['audio','AUDIO'],['controls','CONTROLS'],['game','GAMEPLAY']];
  let body='';
  if(tab==='graphics')body=`<label>QUALITY${seg('quality',[['low','Low'],['medium','Medium'],['high','High'],['ultra','Ultra']],s.quality)}</label>
    <label>FRAME RATE CAP${seg('fpsCap',FPS_CAPS.map(v=>[v,v?v:'Unlimited']),s.fpsCap)}</label>
    ${slider('renderScale','RENDER SCALE',s.renderScale,.5,1.5,.05,v=>`${Math.round(v*100)}%`)}
    ${toggle('shadows','Shadows (High/Ultra)',s.shadows)}${toggle('weather','Falling snow, leaves and embers',s.weather)}${toggle('showFps','Show FPS and ping',s.showFps)}
    <p class="fine">Unlimited follows your monitor (144 / 240 Hz). Antialiasing changes on Low apply after a reload.</p>`;
  if(tab==='audio')body=`${slider('master','MASTER',s.master,0,1,.05,v=>`${Math.round(v*100)}`)}${slider('music','MUSIC',s.music,0,1,.05,v=>`${Math.round(v*100)}`)}${slider('sfx','EFFECTS',s.sfx,0,1,.05,v=>`${Math.round(v*100)}`)}${toggle('muted','Mute everything',s.muted)}`;
  if(tab==='controls')body=`${slider('sens','MOUSE / STICK SENSITIVITY',s.sens,.1,4,.05,v=>Number(v).toFixed(2))}${slider('aimSens','AIM (RIGHT-CLICK) SENSITIVITY',s.aimSens,.2,1,.05,v=>Number(v).toFixed(2))}${slider('fov','FIELD OF VIEW',s.fov,55,100,1,v=>`${v}°`)}
    ${toggle('invertY','Invert look up/down',s.invertY)}${toggle('toggleCrouch','Toggle crouch instead of hold',s.toggleCrouch)}${toggle('toggleSprint','Toggle sprint instead of hold',s.toggleSprint)}${toggle('aimAssist','Aim assist (touch & gamepad)',s.aimAssist)}
    <div class="keys"><span><kbd>WASD</kbd> move</span><span><kbd>SHIFT</kbd> sprint</span><span><kbd>SPACE</kbd> dive</span><span><kbd>C</kbd> crouch · slide while sprinting</span><span><kbd>LMB</kbd> throw · hold to charge</span><span><kbd>RMB</kbd> aim</span><span><kbd>Q</kbd> snow wall</span><span><kbd>R</kbd> hold to scoop ammo</span><span><kbd>TAB</kbd> scores</span><span><kbd>ESC</kbd> pause</span></div>`;
  if(tab==='game')body=`${toggle('shake','Camera shake and hit-stop',s.shake)}${toggle('reduced','Reduced motion',s.reduced)}${toggle('hints','Show tips during matches',s.hints)}<p class="fine">Build ${BUILD}. Settings are stored in this browser.</p>`;
  return panel('settings','Settings',`<div class="tabs">${tabs.map(([k,l])=>btn(`stab:${k}`,l,k===tab?'on':'')).join('')}</div><div class="settings-body">${body}</div>`,{sub:'MAKE IT YOURS',wide:true});
}
export function howPanel(touch){
  return panel('how','How to play',`<div class="how-grid">
    <div><b>01</b><h3>Splat them first</h3><p>${touch?'Tap THROW':'Click'} for a quick throw. ${touch?'Hold':'Hold the mouse'} to charge a <em>Big Pelt</em>: it flies further, hits for two and splashes everyone nearby. Three hearts, then you are splatted.</p></div>
    <div><b>02</b><h3>Dive like a hero</h3><p>${touch?'DIVE':'SPACE'} launches a dive in the direction you move. You are untouchable for a moment, so time it as a throw arrives. You get two, and they recharge.</p></div>
    <div><b>03</b><h3>Wall up</h3><p>${touch?'WALL':'Q'} slams a wall of ${'snow'} in front of you. Duck behind it (${touch?'CROUCH':'C'}). Walls crumble after a few hits. While sprinting, ${touch?'CROUCH':'C'} becomes a slide.</p></div>
    <div><b>04</b><h3>Never stop moving</h3><p>Glowing piles refill ammo fast. Anywhere else, ${touch?'hold SCOOP':'hold R'} to pack ammo by hand. Grab pads for ${Object.values(POWERS).map(p=>p.name).join(', ')}. The final 30 seconds are a blizzard: double refill speed.</p></div>
  </div>${btn('close','GOT IT ▸','big-go')}`,{sub:'60-SECOND CRASH COURSE',wide:true});
}
export function vaultPanel(season){
  return panel('vault','Pick a season',`<div class="season-grid">${Object.entries(SEASONS).map(([id,s])=>btn(`season:${id}`,`<span class="big">${SEASON_ICON[id]}</span><b>${s.name}</b><small>${s.pelt} · ${id===season?'playing now':'visit'}</small>`,`season-card s-${id} ${id===season?'on':''}`)).join('')}</div><p class="fine">The calendar picks the season for you: Halloween in October, Harvest in November, Frost in December and January. Every map works in every season.</p>`,{sub:'SEASON VAULT',wide:true});
}
export function pausePanel(){
  return panel('pause','Paused',`<div class="pause-list">${btn('resume','RESUME ▸','big-go')}${btn('settings','SETTINGS','wide-btn')}${btn('how','HOW TO PLAY','wide-btn')}${btn('confirm-leave','LEAVE MATCH','wide-btn danger')}</div>`,{sub:'TAKE A BREATH'});
}
export function errorPanel(text){return panel('error','Let’s try that again',`<p>${esc(text)}</p>${btn('confirm-leave','BACK TO MENU','big-go')}`,{sub:'A LITTLE BUMP'});}
const AWARD={mvp:['MVP','most splats'],sharpshooter:['SHARPSHOOTER','best accuracy'],architect:['ARCHITECT','most walls built'],streak:['ON FIRE','longest streak'],untouchable:['UNTOUCHABLE','fewest hits taken']};
export function results(state,mySlot,{coins,xp,solo}){
  const mine=state.results.find(r=>r.slot===mySlot),team=state.mode!=='ffa';
  const tied=!team&&mine&&state.results.filter(r=>r.score===mine.score).length>1;
  const head=!mine?'Match over':mine.draw?'A perfect tie!':mine.place===1?(team?'Your team wins!':tied?(mine.score?'Tied for first!':'Nobody scored!'):'VICTORY!'):team?'So close.':`#${mine.place} — well splatted.`;
  const awards=(state.awards||[]).map(a=>{const p=state.results.find(r=>r.slot===a.slot);const [t,d]=AWARD[a.key]||[a.key,''];const v=a.key==='sharpshooter'?`${Math.round(a.value*100)}%`:a.key==='untouchable'?`${-a.value} hits`:a.value;return `<div class="award ${a.slot===mySlot?'me':''}"><small>${t}</small><b>${esc(p?.name)}</b><span>${v} · ${d}</span></div>`;}).join('');
  return `<div class="results-wrap"><section class="results ${mine?.place===1?'win':''}"><small class="kicker">${team?(state.mode==='king'?'KING OF THE HILL':'TEAM PELT'):'FREE-FOR-ALL'} · RESULTS</small><h2>${head}</h2>
    <ol class="standings">${(()=>{const top=state.results.slice(0,6);const mineRow=state.results.find(r=>r.slot===mySlot);if(mineRow&&!top.includes(mineRow))top.push(mineRow);return top;})().map(r=>`<li class="${r.slot===mySlot?'me':''} ${team?'team'+r.team:''}"><span class="place">${r.place}</span><b>${esc(r.name)}${r.bot?' <small>BOT</small>':''}</b><span class="stat">${r.stat?.hits??0}/${r.stat?.throws??0} hits</span><strong>${r.score}</strong></li>`).join('')}</ol>
    <div class="awards">${awards}</div>
    <div class="earned"><span>◈ +${coins}<small>coins</small></span><span>★ +${xp}<small>XP</small></span></div>
    <div class="actions">${solo?btn('rematch','PLAY AGAIN ▸','big-go'):'<p class="fine">Next round starts in the lobby shortly…</p>'}${btn('confirm-leave','MENU','wide-btn')}</div></section></div>`;
}
export function lobby(state,mySlot,{copyText}){
  const me=state.players.find(p=>p.slot===mySlot),host=state.host===mySlot&&!state.publicRoom;
  const humans=state.players.filter(p=>!p.spectator&&!p.bot&&p.connected).length;
  return `<main class="lobby"><section class="lobby-card"><small class="kicker">${state.publicRoom?'PUBLIC MATCH':'PRIVATE ROOM'}</small><h2>${state.publicRoom?'Finding players…':'Your crew'}</h2>
    <div class="room-code"><span>ROOM CODE</span><strong>${state.code}</strong>${btn('copy',copyText,'chip')}</div>
    <div class="lobby-players">${state.players.map(p=>`<div class="lp"><i style="background:${CHARACTERS.find(c=>c.id===p.character)?.color}"></i><b>${esc(p.name)}</b><small>${p.spectator?'WATCHING':p.bot?'BOT':p.ready?'READY ✓':p.slot===state.host?'HOST':'HERE'}</small></div>`).join('')}</div>
    ${host?`<div class="form-grid"><label>ARENA${seg('lobby-map',MAPS.map(m=>[m.id,m.name]),state.mapId)}</label><label>MODE${seg('lobby-mode',[['ffa','Free-for-all'],['team','Teams'],['king','King']],state.mode)}</label></div>`:`<p class="fine">${MAPS.find(m=>m.id===state.mapId)?.name} · ${state.mode==='ffa'?'Free-for-all':state.mode==='team'?'Teams':'King of the Hill'}</p>`}
    <p id="lobby-clock" class="lobby-clock">${humans} / ${state.minPlayers} players to auto-start</p>
    <div class="actions">${btn('ready',me?.ready?'READY ✓':'I’M READY','big-go')}${host?btn('start','START NOW ▸','wide-btn'):''}</div><div id="bot-fill"></div>
    <p class="fine">${state.publicRoom?'Bots join only if most players vote to fill.':'Starting alone fills the room with bots.'}</p>${btn('confirm-leave','LEAVE','text-btn')}</section></main>`;
}
export function connecting(code){return `<main class="lobby"><section class="lobby-card center"><small class="kicker">ROOM ${esc(code)}</small><h2>Connecting…</h2><div class="spinner"></div>${btn('confirm-leave','CANCEL','text-btn')}</section></main>`;}
export function touchControls(){
  return `<div id="touch"><div id="move-zone"><div class="stick"><span></span></div></div><div id="look-zone"></div>
    <div class="tbtns">${['throw:THROW','dive:DIVE','wall:WALL','scoop:SCOOP','crouch:CROUCH'].map(s=>{const [k,l]=s.split(':');return `<button class="tb tb-${k}" data-touch="${k}" aria-label="${l}">${l}</button>`;}).join('')}</div>
    <button class="tb tb-pause" data-action="pause" aria-label="Pause">❚❚</button></div>`;
}
