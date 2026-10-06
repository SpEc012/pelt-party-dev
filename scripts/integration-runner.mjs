import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--ip','127.0.0.1','--port','8787','--inspector-port','9230','--local'],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
let log='';child.stdout.on('data',c=>{log+=c;});child.stderr.on('data',c=>{log+=c;});
try{
 const start=Date.now();while(true){try{const r=await fetch('http://127.0.0.1:8787/api/health');if(r.ok)break;}catch{}if(Date.now()-start>60000)throw Error('Worker startup failed: '+log);await new Promise(r=>setTimeout(r,200));}
 await import('./socket-test.mjs');
}catch(error){console.error(error);console.error(log);process.exitCode=1;}finally{child.kill('SIGTERM');}
