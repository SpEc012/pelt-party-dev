import {chromium,devices} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});await server.listen();
let browser;
try{
 let launch={headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
 if(process.env.CHROMIUM_PATH)launch.executablePath=process.env.CHROMIUM_PATH;
 if(process.env.PELT_CHROMIUM){const module=await import('@sparticuz/chromium');launch={...launch,executablePath:process.env.PELT_CHROMIUM,args:module.default.args};}
 browser=await chromium.launch(launch);await fs.mkdir('test-results',{recursive:true});
 const errors=[];const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());};
 const page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await page.goto('http://127.0.0.1:5173/?test=1&debug=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__pelt);await page.waitForTimeout(1200);await page.screenshot({path:'test-results/home-desktop.png'});
 await page.getByRole('button',{name:/^PLAY/}).click();await page.getByRole('button',{name:/START MATCH/}).click();await page.waitForFunction(()=>window.__pelt.state?.phase==='playing',{timeout:15000});
 assert.equal(await page.evaluate(()=>window.__pelt.state.players.length),8);
 const before=await page.evaluate(()=>({...window.__pelt.local}));await page.keyboard.down('KeyD');await page.waitForTimeout(900);await page.keyboard.up('KeyD');const after=await page.evaluate(()=>({...window.__pelt.local}));
 assert.ok(Number.isFinite(after.x)&&Math.hypot(after.x-before.x,after.z-before.z)>.05,'local player moves');
 const cam=await page.evaluate(()=>window.__pelt.camera);assert.ok(Math.hypot(cam.position[0]-after.x,cam.position[2]-after.z)<7,'camera stays close behind player');assert.ok(cam.position[1]<5,'camera at shoulder height');
 const ammo=await page.evaluate(()=>window.__pelt.room.players[0].ammo);await page.mouse.move(720,450);await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await page.waitForTimeout(150);
 assert.ok(await page.evaluate(a=>window.__pelt.room.players[0].ammo<a,ammo),'throw spends ammunition');
 await page.keyboard.press('Space');await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>window.__pelt.room.players[0].dives<2),'dive spends a charge');
 await page.waitForTimeout(500);await page.keyboard.press('KeyQ');await page.waitForTimeout(120);assert.ok(await page.evaluate(()=>window.__pelt.room.forts.some(f=>f.by===0)),'Q builds a wall');
 await page.waitForTimeout(1200);await page.screenshot({path:'test-results/match-desktop.png'});console.log(JSON.stringify({test:'desktop playable loop',metrics:await page.evaluate(()=>window.__pelt.metrics)}));
 const coins=await page.evaluate(()=>window.__pelt.profile.coins);await page.evaluate(()=>window.__pelt.finish());await page.locator('.results h2').waitFor();await page.screenshot({path:'test-results/results.png'});
 assert.ok(await page.evaluate(()=>window.__pelt.profile.coins)>coins,'results pay coins');
 await page.getByRole('button',{name:'MENU'}).click();await page.locator('.menu').waitFor();
 await page.getByRole('button',{name:'LOCKER'}).click();await page.getByRole('button',{name:'HATS'}).click();await page.getByRole('button',{name:/Pumpkin cap/}).click();assert.equal(await page.evaluate(()=>window.__pelt.profile.hat),'pumpkin');await page.screenshot({path:'test-results/locker.png'});
 await page.locator('.locker [data-action=close]').click();await page.getByRole('button',{name:'SETTINGS'}).click();await page.locator('[data-seg=quality] [data-value=medium]').click();assert.equal(await page.evaluate(()=>window.__pelt.settings.quality),'medium');
 await page.locator('[data-seg=fpsCap] [data-value="144"]').click();assert.equal(await page.evaluate(()=>window.__pelt.settings.fpsCap),144);await page.locator('[data-seg=fpsCap] [data-value="0"]').click();
 await page.locator('.panel [data-action=close]').click();await page.getByRole('button',{name:/EDITION/}).click();await page.getByRole('button',{name:/Snowball Showdown/}).click();assert.ok(await page.getByRole('button',{name:/Play the Halloween Edition/}).isVisible());
 await page.evaluate(()=>window.__pelt.startSolo(20,'ace','street','team'));await page.waitForFunction(()=>window.__pelt.state?.phase==='playing',{timeout:15000});await page.waitForTimeout(1500);console.log(JSON.stringify({test:'20-player renderer',metrics:await page.evaluate(()=>window.__pelt.metrics)}));await page.screenshot({path:'test-results/match-20.png'});await page.goto('about:blank');
 const phone=await browser.newPage({...devices['iPhone 14'],defaultBrowserType:undefined});watch(phone);await phone.goto('http://127.0.0.1:5173/?test=1',{waitUntil:'domcontentloaded'});await phone.waitForFunction(()=>window.__pelt);await phone.waitForTimeout(800);await phone.screenshot({path:'test-results/home-iphone14.png'});
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'phone layout fits');
 await phone.getByRole('button',{name:/^PLAY/}).tap();await phone.getByRole('button',{name:/START MATCH/}).tap();await phone.waitForFunction(()=>window.__pelt.state?.phase==='playing',{timeout:15000});await phone.waitForTimeout(600);await phone.screenshot({path:'test-results/match-iphone14.png'});
 for(const b of ['throw','dive','wall','scoop'])assert.ok(await phone.locator(`[data-touch=${b}]`).isVisible(),`${b} button visible`);
 console.log(JSON.stringify({test:'iPhone 14 viewport (Chromium emulation, not Safari hardware)',metrics:await phone.evaluate(()=>window.__pelt.metrics)}));
 assert.deepEqual(errors,[]);console.log('Browser smoke tests passed; no page errors.');
}finally{await browser?.close();await server.close();}
