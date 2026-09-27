import {accountRedirect} from '../native/bridge.js';
import {getClient} from './client.js';
import {authMessage,PENDING_EMAIL,rememberVerification} from './auth-feedback.js';
const el=id=>document.getElementById(id),say=text=>{el('verificationStatus').textContent=text;};
let verifying=false;
let client,checking=false,opening=false,sending=false,nextSend=0,pending=null;
try{pending=JSON.parse(sessionStorage.getItem(PENDING_EMAIL));if(Date.now()-pending?.createdAt>86400000)pending=null;}catch{}
el('email').value=pending?.email||'';
say(pending?.reason==='sent'?'If this address is eligible, a verification code is on its way. Enter it below.':pending?.reason?authMessage({code:pending.reason}):'Waiting for a verified session. You can request another confirmation email below.');
function cooldown(){
 const seconds=Math.max(0,Math.ceil((nextSend-Date.now())/1000));
 el('resendEmail').disabled=!client||sending||seconds>0;
 el('resendTimer').textContent=seconds?'You can request another email in '+seconds+' seconds.':'';
}
async function check(manual=false){
 if(!client||checking||opening)return;
 if(!navigator.onLine){if(manual)say('You are offline. Reconnect to finish verification.');return;}
 checking=true;el('checkVerification').disabled=true;
 try{
  const {data,error}=await client.auth.getSession();if(error)throw error;
  if(!data.session){if(manual)say('No verified session yet. Enter your email code below, or log in if you already verified.');return;}
  const result=await client.auth.getUser();if(result.error)throw result.error;
  const user=result.data.user;
  // An unrelated signed-in account must not complete this email's pending flow.
  if(pending?.email&&user?.email?.toLowerCase()!==pending.email.toLowerCase()){
   say('A different account is signed in. Log out from Your account before verifying this address.');return;
  }
  if(!user?.email_confirmed_at){if(manual)say('Your email is not verified yet. Enter the code from your inbox.');return;}
  opening=true;say('Email verified. Opening LifeOS…');
  try{sessionStorage.removeItem(PENDING_EMAIL);}catch{}
  location.replace(new URL('dashboard.html',location.href).href);
 }catch(error){say(authMessage(error));}
 finally{checking=false;el('checkVerification').disabled=false;}
}
try{
 client=getClient();
 // Defer Auth calls until the synchronous Auth notification has returned.
 client.auth.onAuthStateChange(event=>{if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))setTimeout(()=>check(),0);});
 await check();
}catch(error){say(authMessage(error));el('checkVerification').disabled=true;}
if(pending?.createdAt)nextSend=pending.createdAt+60000;
cooldown();setInterval(cooldown,1000);
el('resendForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!client||sending||Date.now()<nextSend||!el('resendForm').reportValidity())return;
 if(!navigator.onLine){say('You are offline. Reconnect to request an email.');return;}
 sending=true;cooldown();
 const email=el('email').value.trim();
 try{
  // Keep the existing allowlisted callback; login routes verified callbacks here.
  const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:accountRedirect('login.html')}});
  if(error)throw error;
  rememberVerification(email);pending={email,reason:'sent',createdAt:Date.now()};
  say('If this address is eligible, another verification code is on its way. Enter the newest code.');
 }catch(error){say(authMessage(error));}
 finally{sending=false;nextSend=Date.now()+60000;cooldown();}
});
el('checkVerification').onclick=()=>check(true);
window.addEventListener('focus',()=>check());window.addEventListener('online',()=>check());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
setInterval(()=>{if(!document.hidden)check();},5000);

el('codeForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!client||verifying||opening||!el('email').reportValidity()||!el('codeForm').reportValidity())return;
 if(!navigator.onLine){say('You are offline. Reconnect to verify your code.');return;}
 verifying=true;el('verifyCode').disabled=true;
 const email=el('email').value.trim();
 // Keep no password or OTP in browser storage.
 pending={email,reason:pending?.reason||'sent',createdAt:pending?.createdAt||Date.now()};
 try{
  const {error}=await client.auth.verifyOtp({email,token:el('emailCode').value.trim(),type:'email'});
  if(error)throw error;
  el('emailCode').value='';
  await check(true);
 }catch(error){say(authMessage(error));}
 finally{verifying=false;el('verifyCode').disabled=false;}
});
