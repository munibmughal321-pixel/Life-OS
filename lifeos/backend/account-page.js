import {exportJSON} from '../native/bridge.js';
import {getClient} from './client.js';
import {repository} from './repository.js';
const el=id=>document.getElementById(id),say=text=>{el('accountStatus').textContent=text;};
let client,repo,profile,user;
function signedOut(){
 user=null;profile=null;el('profileForm').reset();el('profileForm').hidden=true;el('accountActions').hidden=true;
 el('identity').textContent='You are signed out.';el('loginLink').hidden=false;
}
async function action(button,run){
 button.disabled=true;
 try{await run();}catch(error){say(error.message||'Request failed. Try again when connected.');}
 finally{button.disabled=false;}
}
try{
 client=getClient();repo=repository(client);
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')signedOut();});
 const response=await client.auth.getUser();
 if(response.error||!response.data.user)signedOut();
 else{
  user=response.data.user;el('identity').textContent=user.email;
  profile=await repo.profile();
  el('displayName').value=profile?.display_name||user.user_metadata?.display_name||'';
  el('timezone').value=profile?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  el('currency').value=profile?.currency||'PKR';
  el('profileForm').hidden=false;el('accountActions').hidden=false;
 }
}catch(error){say(error.message);el('loginLink').hidden=false;}
el('profileForm').addEventListener('submit',event=>{
 event.preventDefault();action(event.submitter,async()=>{
  profile=await repo.saveProfile({display_name:el('displayName').value,timezone:el('timezone').value,currency:el('currency').value},profile?.revision??null);
  say('Cloud profile saved.');
 });
});
el('exportCloud').addEventListener('click',event=>action(event.currentTarget,async()=>{
 await exportJSON(await repo.export(),'lifeos-cloud-backup.json');
 say('Cloud export opened for saving. Use the dashboard’s backup tools for local-only records.');
}));
el('logout').addEventListener('click',event=>action(event.currentTarget,async()=>{
 await leaveAccount('logout');
}));
el('deleteAccount').addEventListener('click',event=>action(event.currentTarget,async()=>{
 if(!el('deleteBackupConfirm').checked)throw Error('Download a dashboard backup first, or confirm that you accept losing access to this local account workspace.');
 if(el('deleteConfirm').value!=='DELETE')throw Error('Type DELETE to confirm.');
 const {error}=await client.functions.invoke('delete-account',{body:{confirmation:'DELETE'}});
 if(error)throw Error('Account deletion failed. Your session may have expired; sign in and try again.');
 await client.auth.signOut({scope:'local'});localStorage.removeItem('lifeos-last-account-workspace');signedOut();say('Cloud account deleted. Use your downloaded backup to recover local records elsewhere.');
}));

// Logout retains account-isolated local data and pending changes for the same account.
async function leaveAccount(mode){
 if(!client)throw Error("Account connection is unavailable. Please reload and try again.");
 const {error}=await client.auth.signOut({scope:"local"});
 if(error)throw error;
 localStorage.removeItem('lifeos-last-account-workspace');
 signedOut();
 location.replace(new URL(mode==="switch"?"login.html?reason=switch":"login.html?reason=logout",location.href).href);
}
el("switchAccount").addEventListener("click",event=>action(event.currentTarget,()=>leaveAccount("switch")));
const requestedAction=new URLSearchParams(location.search).get("action");
if(["logout","switch"].includes(requestedAction)){
 history.replaceState(null,"",location.pathname);
 say(requestedAction==="switch"?"Signing out before switching account…":"Signing out…");
 try{await leaveAccount(requestedAction);}catch(error){say(error.message || "Sign out failed. Retry when connected.");el("retryAccountAction").hidden=false;el("retryAccountAction").onclick=event=>action(event.currentTarget,()=>leaveAccount(requestedAction));}
}
