import {chromium,devices} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});await server.listen();
let browser;
try{
 let launch={headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
 if(process.env.PELT_CHROMIUM){const module=await import('@sparticuz/chromium');launch={...launch,executablePath:process.env.PELT_CHROMIUM,args:module.default.args};}
 browser=await chromium.launch(launch);await fs.mkdir('test-results',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/?test=1&debug=1');await page.waitForFunction(()=>window.__pelt);await page.screenshot({path:'test-results/home-desktop.png'});
 await page.getByRole('button',{name:/Play vs bots/}).click();await page.getByRole('button',{name:/Let’s get splatted/}).click();await page.waitForFunction(()=>window.__pelt.state?.phase==='playing',{timeout:12000});
 assert.equal(await page.evaluate(()=>window.__pelt.state.players.length),8);
 await page.getByRole('button',{name:'Skip hints ×'}).click();await page.waitForTimeout(250);const before=await page.evaluate(()=>({...window.__pelt.local}));await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD',bubbles:true})));await page.waitForTimeout(650);await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD',bubbles:true})));const after=await page.evaluate(()=>({...window.__pelt.local}));assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.4,'camera-relative keyboard movement advances local player');const cam=await page.evaluate(()=>window.__pelt.camera);assert.ok(Math.hypot(cam.position[0]-after.x,cam.position[2]-after.z)<7,'camera stays close behind player');assert.ok(cam.position[1]<4.5,'camera is at shoulder height');
 await page.mouse.move(700,450);await page.mouse.click(700,450);await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.__pelt.room.players[0].ammo<3),'throw spends ammunition');
 await page.keyboard.press('Space');await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>window.__pelt.room.players[0].rollReady>Date.now()),'roll cooldown starts');
 await page.waitForTimeout(1500);await page.screenshot({path:'test-results/match-desktop.png'});const metrics=await page.evaluate(()=>window.__pelt.metrics);console.log(JSON.stringify({test:'desktop playable loop',metrics}));
 const coins=await page.evaluate(()=>window.__pelt.profile.coins);await page.evaluate(()=>{document.exitPointerLock?.();window.__pelt.finish();});await page.getByRole('heading',{name:/Well splatted|Gourd almighty/}).waitFor();assert.ok(await page.evaluate(()=>window.__pelt.profile.coins)>coins);await page.getByRole('button',{name:'Back to the patch'}).click();await page.getByRole('button',{name:'Edit look ↗'}).click();await page.getByRole('button',{name:/Pumpkin cap/}).click();assert.equal(await page.evaluate(()=>window.__pelt.profile.hat),'pumpkin');
 await page.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('button',{name:'Season Vault'}).click();await page.getByRole('button',{name:/Snowball Showdown/}).click();assert.ok(await page.getByRole('button',{name:/Play the Halloween Edition/}).isVisible());
 await page.evaluate(()=>window.__pelt.startSolo(20,'regular','patch','ffa'));await page.waitForFunction(()=>window.__pelt.state?.phase==='playing');await page.waitForTimeout(1200);console.log(JSON.stringify({test:'20-player renderer',metrics:await page.evaluate(()=>window.__pelt.metrics)}));await page.screenshot({path:'test-results/match-20.png'});await page.goto('about:blank');
 const phone=await browser.newPage({...devices['iPhone 14'],defaultBrowserType:undefined});phone.on('pageerror',e=>errors.push(e.message));await phone.goto('http://127.0.0.1:5173/?test=1');await phone.waitForFunction(()=>window.__pelt);await phone.screenshot({path:'test-results/home-iphone14.png'});assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'phone layout fits');
 await phone.getByRole('button',{name:/Play vs bots/}).tap();await phone.getByRole('button',{name:/Let’s get splatted/}).tap();await phone.waitForFunction(()=>window.__pelt.state?.phase==='playing',{timeout:12000});await phone.screenshot({path:'test-results/match-iphone14.png'});assert.ok(await phone.locator('#move-stick').isVisible());assert.ok(await phone.locator('#aim-stick').isVisible());console.log(JSON.stringify({test:'iPhone 14 viewport (Chromium emulation, not Safari hardware)',metrics:await phone.evaluate(()=>window.__pelt.metrics)}));
 assert.deepEqual(errors,[]);console.log('Browser smoke tests passed; no page errors.');
}finally{await browser?.close();await server.close();}
