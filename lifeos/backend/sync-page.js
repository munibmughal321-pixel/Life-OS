import {exportJSON} from '../native/bridge.js';
import {getClient} from './client.js';
import {syncRemote} from './sync-remote.js';
import {synchronize} from './sync-engine.js';
const LAST_WORKSPACE='lifeos-last-account-workspace';
const cloud=window.LifeOSCloud={owner:null,databaseName:'lifeos-local',locked:false,sessionUnavailable:false};
let client,enabled=false,running=false,retryTimer,choices={};
const byId=id=>document.getElementById(id);
function say(message){const node=byId('syncStatus');if(node)node.textContent=message;}
function reflectEnabled(value){
 enabled=!!value;
 byId('syncEnable').textContent=enabled?'Pause sync':'Enable sync for this account';
 byId('syncNow').disabled=running||!enabled;
}
function lock(){
 cloud.locked=true;
 // An open form must never switch into another user's database.
 document.getElementById('root').inert=true;document.getElementById('root').hidden=true;
 const notice=document.createElement('section');notice.className='card';notice.setAttribute('role','alert');
 const text=document.createElement('p');text.textContent='Account changed. Saved changes remain in their original workspace. Reload to open the current account. Unsaved form changes will be discarded.';
 const button=document.createElement('button');button.textContent='Reload workspace';button.onclick=()=>location.reload();
 notice.append(text,button);document.body.prepend(notice);
}
cloud.ready=(async()=>{
 try{client=getClient();}catch{say('Saved locally · cloud configuration unavailable');return;}
 // The remembered ID routes LOCAL storage only; every cloud request still verifies Auth.
 // This permits offline reopening after a token expires, without pretending it is valid.
 const remembered=localStorage.getItem(LAST_WORKSPACE);
 let id=remembered||undefined;
 if(navigator.onLine){
  let timeout;
  try{
   const {data,error}=await Promise.race([client.auth.getSession(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Session check timed out. Reconnect and reload; saved records remain untouched.')),8000);})]);
   if(error)throw error;
   if(data.session?.user?.id)id=data.session.user.id;
   else cloud.sessionUnavailable=!!remembered;
  }catch{
   // Auth availability controls cloud work, not access to already-saved local data.
   cloud.sessionUnavailable=!!remembered;
   if(!remembered)id=undefined;
  }finally{clearTimeout(timeout);}
 }
 if(id&&!/^[0-9a-f-]{36}$/i.test(id)){localStorage.removeItem(LAST_WORKSPACE);id=undefined;cloud.sessionUnavailable=false;}
 if(id)localStorage.setItem(LAST_WORKSPACE,id);else localStorage.removeItem(LAST_WORKSPACE);
 cloud.owner=id||null;cloud.databaseName=id?'lifeos-account-'+id:'lifeos-local';
 client.auth.onAuthStateChange((_event,session)=>{
  const active=session?.user?.id||null;
  if(active===cloud.owner){cloud.sessionUnavailable=false;return;}
  if(!active&&cloud.owner&&localStorage.getItem(LAST_WORKSPACE)===cloud.owner){
   cloud.sessionUnavailable=true;say('Saved locally · cloud session unavailable. Sign in again to resume sync.');return;
  }
  if(active!==cloud.owner&&!cloud.locked)lock();
 });
 window.addEventListener('storage',event=>{
  if(event.key===LAST_WORKSPACE&&event.newValue!==cloud.owner&&!cloud.locked)lock();
 });
})();
// Attach immediately: the dashboard awaits the same promise after DOM readiness.
cloud.ready.catch(()=>{cloud.locked=true;});
async function showConflicts(meta){
 const host=byId('syncConflicts');host.replaceChildren();
 for(const conflict of meta.conflicts||[]){
  const section=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent='Review '+conflict.id;section.append(summary);
  for(const side of ['local','cloud']){
   const heading=document.createElement('p');heading.textContent=side==='local'?'This device':'Cloud';
   const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';
   pre.textContent=JSON.stringify(conflict[side]?.deleted_at?null:conflict[side]?.payload??null,null,2);
   const button=document.createElement('button');button.className='btn btn-outline btn-sm';
   button.textContent=choices[conflict.id]?.side===side?'Selected '+side:'Keep '+side;
   button.onclick=()=>{choices[conflict.id]={side,signature:conflict.signature};showConflicts(meta);};
   section.append(heading,pre,button);
  }
  host.append(section);
 }
 byId('exportConflicts').hidden=!(meta.conflicts?.length);
}
async function run(){
 if(running||cloud.locked)return;
 running=true;byId('syncEnable').disabled=true;say('Checking sync preference…');
 try{reflectEnabled((await window.LocalWorkspace.read()).meta.enabled);}
 catch(error){running=false;byId('syncEnable').disabled=false;say(error.message);return;}
 running=false;byId('syncEnable').disabled=false;reflectEnabled(enabled);
 if(!enabled){say('Saved locally · cloud sync paused');return;}
 if(!navigator.onLine){say('Saved locally · offline changes waiting to sync');return;}
 if(!navigator.locks){say('Sync unavailable in this browser. Local saving still works.');return;}
 running=true;byId('syncEnable').disabled=true;byId('syncNow').disabled=true;say('Syncing…');
 try{
  const result=await navigator.locks.request('lifeos-sync-'+cloud.owner,{ifAvailable:true},async lock=>{
   if(!lock)return {status:'busy'};
   // Re-read the durable preference so Pause sync in another tab is respected.
   const current=await window.LocalWorkspace.read();
   if(!current.meta.enabled)return {status:'paused'};
   return synchronize({remote:syncRemote(client,cloud.owner),local:window.LocalWorkspace,defaults:window.LocalWorkspace.defaults,validate:window.LocalWorkspace.validate,choices});
  });
  const snapshot=await window.LocalWorkspace.read();reflectEnabled(snapshot.meta.enabled);await showConflicts(snapshot.meta);
  if(result.status==='conflict')say('Sync paused · '+result.count+' conflicting record(s). Review both copies, select which to keep, then Sync now.');
  else if(result.status==='busy')say('Another tab is syncing. Retry shortly.');
  else if(result.status==='paused')say('Saved locally · cloud sync paused');
  else{choices={};say('Synced · '+new Date(snapshot.meta.lastSync).toLocaleTimeString());}
 }catch(error){
  say('Sync failed or paused. Local changes are safe. '+(error.message?.startsWith('Cloud merge rejected')?'The combined records need review (for example, two running activities). Export backups from both devices and correct the entries.':error.message||'Reconnect and retry.'));
 }finally{running=false;byId('syncEnable').disabled=false;byId('syncNow').disabled=!enabled;}
}
cloud.start=async()=>{
 byId('workspaceIdentity').textContent=cloud.owner?'Your account workspace':'Device-only workspace';
 byId('syncEnable').hidden=!cloud.owner;byId('syncNow').hidden=!cloud.owner;
 if(!cloud.owner){say('Saved locally · sign in to open a separate account workspace');return;}
 const snapshot=await window.LocalWorkspace.read();enabled=!!snapshot.meta.enabled;
 reflectEnabled(enabled);
 say(enabled?(cloud.sessionUnavailable?'Saved locally · cloud session unavailable. Sign in again to resume sync.':'Saved locally · preparing sync'):'Saved locally · cloud sync is off');
 await showConflicts(snapshot.meta);
 byId('syncEnable').onclick=async()=>{
  if(running)return;
  running=true;byId('syncEnable').disabled=true;byId('syncNow').disabled=true;
  try{
   const before=await window.LocalWorkspace.read();
   // A stale button must refresh rather than reverse an action taken in another tab.
   if(enabled!==before.meta.enabled){reflectEnabled(before.meta.enabled);say('Sync preference changed in another tab. Review the updated control.');return;}
   if(!before.meta.enabled&&!confirm('Enable syncing for this account workspace? Its records will upload to your account. Device-only history is not included.'))return;
   await window.LocalWorkspace.commit(before,null,{...before.meta,enabled:!before.meta.enabled});
   reflectEnabled(!before.meta.enabled);
   say(enabled?'Saved locally · sync enabled':'Saved locally · cloud sync paused');
  }catch(error){say(error.message);}
  finally{running=false;byId('syncEnable').disabled=false;reflectEnabled(enabled);}
  if(enabled)run();
 };
 byId('syncNow').onclick=()=>run();
 byId('exportConflicts').onclick=async()=>{
  try{const {meta}=await window.LocalWorkspace.read();await exportJSON({format:'lifeos-sync-conflicts',conflicts:meta.conflicts},'lifeos-conflict-copies.json');}
  catch(error){say('Conflict export failed: '+error.message);}
 };
 window.addEventListener('lifeos-local-saved',()=>{if(enabled){say('Saved locally · changes waiting to sync');clearTimeout(retryTimer);retryTimer=setTimeout(run,1500);}});
 window.addEventListener('online',run);
 window.addEventListener('focus',run);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)run();});
 setInterval(()=>{if(!document.hidden)run();},60000);
 await run();
};
window.addEventListener('lifeos-cloud-applied',()=>{byId('reloadCloud').hidden=false;});
