// Thin client for /api/account/*. The server owns coins, unlocks and challenge progress;
// this file only stores the session token and a cached copy of the last profile view.
const TOKEN_KEY='pelt-account',CACHE_KEY='pelt-account-cache';
const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch{}};
export const session={token:read(TOKEN_KEY),view:null};
try{session.view=JSON.parse(read(CACHE_KEY)||'null');}catch{session.view=null;}
if(!session.token)session.view=null;
export const signedIn=()=>!!session.token;
function remember(token,view){if(token!==undefined){session.token=token;write(TOKEN_KEY,token);}if(view!==undefined){session.view=view;write(CACHE_KEY,view?JSON.stringify(view):null);}}
export function forget(){remember(null,null);}
async function call(path,data={},auth=true){
  let response;
  try{response=await fetch(`/api/account/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(auth&&session.token?{Authorization:`Bearer ${session.token}`}:{})},body:JSON.stringify(data)});}
  catch{throw Error('Can’t reach the account server. Check your connection.');}
  let result;try{result=await response.json();}catch{throw Error('Accounts need the online server (they are not available in this local preview).');}
  if(response.status===401&&auth){forget();}
  if(!response.ok)throw Object.assign(Error(result.error||'Something went wrong.'),{status:response.status});
  if(result.token)remember(result.token);if(result.profile)remember(undefined,result.profile);
  return result;
}
export const register=(username,password)=>call('register',{username,password},false);
export const login=(username,password)=>call('login',{username,password},false);
export async function logout(){try{await call('logout');}catch{}forget();}
export const refresh=()=>call('me');
export const equip=look=>call('equip',look);
export const buy=(kind,id)=>call('buy',{kind,id});
export const reportMatch=report=>call('match',{report});
export const claim=id=>call('claim',{id});
export const changePassword=(current,next)=>call('password',{current,next});
export async function leaderboard(){let r;try{r=await fetch('/api/leaderboard');}catch{throw Error('Can’t reach the server.');}try{const j=await r.json();if(!r.ok)throw Error(j.error||'Leaderboard unavailable.');return j.rows||[];}catch(e){throw Error(e.message.includes('JSON')?'The leaderboard needs the online server.':e.message);}}
// How many rewards are waiting to be claimed (menu badge).
export function claimable(view){if(!view)return 0;return [...view.daily,...view.weekly,...view.achievements].filter(c=>!c.claimed&&c.progress>=c.goal).length+(view.streak?.ready?1:0);}
