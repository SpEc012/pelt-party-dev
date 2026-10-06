import {decodeWorld} from '../shared/protocol.mjs';
export function profileToken(){let token;try{token=localStorage.getItem('pelt-token');}catch{}if(!/^[a-f0-9]{64}$/.test(token||'')){token=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('pelt-token',token);}catch{}}return token;}
export async function api(path,data){let response;try{response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}catch{throw Error('The multiplayer server is unavailable. You can still play vs bots.');}let result;try{result=await response.json();}catch{throw Error('The multiplayer server is not set up here yet. Try Play vs bots.');}if(!response.ok)throw Error(result.error||'Could not reach that room.');return result;}
export function connect({code,name,character,hat,watch=false,token,accountToken=null,onMessage,onStatus,onError}){
  let ws,closed=false,attempt=0,timer,ping,clockTimer,opened=false,lostAt=0,samples=[],offset=0,rtt=0,jitter=0,bytes=0,windowBytes=0,measuredAt=performance.now(),downKB=0;
  const q=new URLSearchParams(location.search),lag=Math.max(0,Math.min(1000,Number(q.get('lag'))||0)),spread=Math.max(0,Math.min(300,Number(q.get('jitter'))||0)),loss=Math.max(0,Math.min(50,Number(q.get('loss'))||0));
  const pending=new Set();const deliver=(fn,drop=false)=>{if(drop&&Math.random()*100<loss)return;if(!lag&&!spread){fn();return;}const t=setTimeout(()=>{pending.delete(t);if(!closed)fn();},Math.max(0,lag+(Math.random()-.5)*spread*2));pending.add(t);};
  function open(){
    if(closed)return;
    const url=new URL(`/ws/${code}`,location.origin);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.search=new URLSearchParams({name,character,hat,watch:watch?'1':'0'});
    ws=new WebSocket(url,['tok.'+token,...(accountToken?['acct.'+accountToken]:[])]);ws.binaryType='arraybuffer';onStatus('connecting');
    ws.onopen=()=>{opened=true;attempt=0;lostAt=0;onStatus('online');send({t:'hi'});let count=0;const clock=()=>{send({t:'clk',c:Date.now()});clockTimer=setTimeout(clock,++count<8?250:3000);};clock();ping=setInterval(()=>send({t:'ping'}),25000);};
    ws.onmessage=e=>{
      const n=typeof e.data==='string'?new TextEncoder().encode(e.data).length:e.data.byteLength;bytes+=n;windowBytes+=n;const at=performance.now();if(at-measuredAt>1000){downKB=windowBytes/(at-measuredAt);windowBytes=0;measuredAt=at;}
      deliver(()=>{let m;if(e.data instanceof ArrayBuffer){m=decodeWorld(e.data);if(m)onMessage({t:'world',...m});return;}try{m=JSON.parse(e.data);}catch{return;}
        if(m.t==='clk'){const back=Date.now(),next=back-m.c;if(next<0||next>5000)return;jitter=jitter*.8+Math.abs(next-rtt)*.2;rtt=next;samples=[...samples,{rtt:next,offset:m.now+next/2-back,at:back}].filter(s=>back-s.at<60000).slice(-12);offset=samples.reduce((a,b)=>a.rtt<b.rtt?a:b).offset;return;}
        if(m.t==='replaced'){closed=true;clear();ws.close();onError('This profile opened in another tab. Continue there, or return home.');return;}onMessage(m);
      },e.data instanceof ArrayBuffer);
    };
    ws.onerror=()=>{};
    ws.onclose=e=>{clearInterval(ping);clearTimeout(clockTimer);if(closed)return;if(e.code===4001){closed=true;onError('This profile is active in another tab.');return;}lostAt||=Date.now();onStatus('reconnecting');if(Date.now()-lostAt>60000||!opened&&attempt>=2){closed=true;onError(opened?'Could not reconnect within 60 seconds. Return home and try again.':'That room could not be joined. Check the code, name, or available seats.');return;}timer=setTimeout(open,Math.min(5000,800*2**attempt++)*(.8+Math.random()*.4));};
  }
  function send(m){deliver(()=>{if(ws?.readyState===1)ws.send(JSON.stringify(m));},m.t==='snap');}
  function clear(){clearTimeout(timer);clearTimeout(clockTimer);clearInterval(ping);for(const t of pending)clearTimeout(t);pending.clear();}
  const wake=()=>{if(!closed&&ws?.readyState===1){send({t:'hi'});send({t:'clk',c:Date.now()});}};
  window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);open();
  return {send,now:()=>Date.now()+offset,get stats(){return {rtt,jitter,offset,downKB,bytes};},close(){send({t:'leave'});closed=true;clear();if(ws?.readyState===1)ws.send(JSON.stringify({t:'leave'}));ws?.close();window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);}};
}
