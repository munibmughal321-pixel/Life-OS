import {App} from '@capacitor/app';
import {Keyboard} from '@capacitor/keyboard';
import {isNative,Device} from './bridge.js';
import {callbackRoute} from './contracts.js';
import {installNativeStorage} from './storage.js';
import {mountPlaces} from './places.js';
import '../css/native.css';

export async function initializeNative(){
 if(!isNative()){if(document.getElementById('main'))mountPlaces(false);return;}
 document.documentElement.classList.add('native-app');
 if(document.getElementById('main')){installNativeStorage();mountPlaces(true);}
 const openCallback=async raw=>{
  let route=callbackRoute(raw);
  if(!route)try{const u=new URL(raw);if(u.protocol==='com.munib.lifeos:'&&u.host==='place'&&!u.username&&!u.password&&/^\/[a-zA-Z0-9-]{1,64}$/.test(u.pathname))route='dashboard.html?place='+encodeURIComponent(u.pathname.slice(1));}catch{}
  if(!route)return;
  // getLaunchUrl survives navigation. Remember a digest, never the auth code.
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(sessionStorage.getItem('lifeos-consumed-launch')===digest)return;
  if(document.getElementById('modalBackdrop')?.classList.contains('open')&&!confirm('Open this link? Unsaved dialog changes will be discarded.'))return;
  sessionStorage.setItem('lifeos-consumed-launch',digest);
  location.replace(new URL(route,location.href).href);
 };
 await App.addListener('appUrlOpen',event=>openCallback(event.url).catch(()=>{const notice=document.createElement('p');notice.setAttribute('role','alert');notice.textContent='This app link could not be opened. Try again.';document.body.prepend(notice);}));
 const takeArrival=async()=>{if(window.Capacitor.getPlatform()!=='ios')return;const result=await Device.takeArrival();if(result.id&&/^[a-zA-Z0-9-]{1,64}$/.test(result.id))location.assign('dashboard.html?place='+encodeURIComponent(result.id));};
 await takeArrival();
 if(window.Capacitor.getPlatform()==='ios')await Device.addListener('arrivalReceived',()=>takeArrival().catch(()=>{}));
 const launch=await App.getLaunchUrl();if(launch?.url)await openCallback(launch.url);
 await App.addListener('backButton',async()=>{
  if(document.getElementById('modalBackdrop')?.classList.contains('open')){closeModal();return;}
  if(document.getElementById('main')&&typeof currentScreen!=='undefined'&&currentScreen!=='dashboard'){goToScreen('dashboard');return;}
  // Never exit while a queued local transaction is still committing.
  if(typeof pendingWrites!=='undefined'&&pendingWrites>0){showToast('Finishing your save. Please try again.');return;}
  if(!/\/(index|dashboard)\.html$/.test(location.pathname)){location.href='dashboard.html';return;}
  await App.minimizeApp();
 });
 await App.addListener('appStateChange',({isActive})=>{
  if(isActive){window.dispatchEvent(new Event('focus'));setTimeout(()=>takeArrival().catch(()=>{}),300);}
 });
 await Keyboard.addListener('keyboardWillShow',()=>document.documentElement.classList.add('keyboard-open'));
 await Keyboard.addListener('keyboardWillHide',()=>document.documentElement.classList.remove('keyboard-open'));
}
window.LifeOSNativeReady=initializeNative().catch(error=>{
 const notice=document.createElement('p');notice.setAttribute('role','alert');
 notice.textContent='Native setup failed. Reopen LifeOS before saving. '+error.message;document.body.prepend(notice);
 // Do not silently open IndexedDB when native initialization fails.
 throw error;
});
