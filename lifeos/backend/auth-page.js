import {accountRedirect} from '../native/bridge.js';
import {getClient} from './client.js';
import {authMessage,rememberVerification} from './auth-feedback.js';
const form=document.getElementById('accountForm'),status=document.getElementById('formStatus');
const mode=form.dataset.mode,submit=form.querySelector('[type=submit]');
// Supabase removes the one-time code after exchange, so capture the route first.
const initialParams=new URLSearchParams(location.search);
let client,recovery=false;
const say=text=>{status.textContent=text;status.focus();};
const field=id=>document.getElementById(id);
const destination=file=>new URL(file,location.href).href;
const clearPasswords=()=>form.querySelectorAll('input[name*=assword]').forEach(input=>input.value='');
document.querySelectorAll('[data-reveal]').forEach(button=>button.addEventListener('click',()=>{
 const input=field(button.dataset.reveal),visible=input.type==='password';
 input.type=visible?'text':'password';button.textContent=visible?'Hide':'Show';button.setAttribute('aria-pressed',String(visible));
}));
function validate(){
 const confirmation=field('confirmPassword');
 if(confirmation)confirmation.setCustomValidity(confirmation.value!==field('password').value?'Passwords must match.':'');
 const name=field('displayName');if(name)name.setCustomValidity(name.value.trim()?'':'Enter a display name.');
}
form.addEventListener('input',validate);
try{
 client=getClient();
 client.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY'){recovery=true;submit.disabled=false;say('Choose your new password.');}
  if(event==='SIGNED_OUT'&&mode==='reset-password'){recovery=false;submit.disabled=true;}
 });
 if(mode==='reset-password'){
  submit.disabled=true;
  say('Open the password reset link in the same browser where you requested it.');
 }
 const {error}=await client.auth.getSession();
 if(error)throw error;
 const params=new URLSearchParams(location.search);
 if(params.has('error')||new URLSearchParams(location.hash.slice(1)).has('error'))say('This account link is invalid or expired. Request a new link.');
 if(mode==='login'){
  const reason=new URLSearchParams(location.search).get('reason');
  if(reason==='switch')say('Sign in with another account. Device-local dashboard records are shared on this browser and remain separate from cloud accounts.');
  else if(reason==='logout')say('You are logged out on this browser. Device-local dashboard records remain available.');
  const {data}=await client.auth.getUser();
  if(data.user)location.replace(destination(initialParams.has('code')?'verify-email.html':'account.html'));
 }
}catch(error){submit.disabled=true;say(error.message||'Accounts are unavailable.');}
form.addEventListener('submit',async event=>{
 event.preventDefault();validate();if(!form.reportValidity()||!client)return;
 if(!navigator.onLine){say('You are offline. Connect to use your account.');return;}
 if(mode==='reset-password'&&!recovery){say('Request and open a new password reset link first.');return;}
 submit.disabled=true;
 try{
  const email=field('email')?.value.trim(),password=field('password')?.value;
  let response;
  if(mode==='login'){
   response=await client.auth.signInWithPassword({email,password});
  }else if(mode==='signup'){
   response=await client.auth.signUp({email,password,options:{data:{display_name:field('displayName').value.trim()},emailRedirectTo:accountRedirect('login.html')}});
  }else if(mode==='forgot-password'){
   response=await client.auth.resetPasswordForEmail(email,{redirectTo:accountRedirect('reset-password.html')});
  }else response=await client.auth.updateUser({password});
  if(response.error)throw response.error;
  clearPasswords();
  if(mode==='login'||(mode==='signup'&&response.data.session))location.assign(destination('account.html'));
  else if(mode==='signup'){rememberVerification(email);location.assign(destination('verify-email.html'));}
  else if(mode==='forgot-password')say('If this address is eligible, a reset link will arrive. Open it in this browser.');
  else{await client.auth.signOut();recovery=false;say('Password updated. Return to Log in.');}
 }catch(error){
  if((mode==='signup'&&['over_email_send_rate_limit','email_address_not_authorized'].includes(error.code))||(mode==='login'&&error.code==='email_not_confirmed')){
   rememberVerification(field('email').value.trim(),error.code);clearPasswords();location.assign(destination('verify-email.html'));
  }else say(authMessage(error));
 }finally{submit.disabled=mode==='reset-password'&&!recovery;}
});
