import {Device} from './bridge.js';
import {validatePlace,distanceMetres} from './contracts.js';
const WEB_KEY='lifeos-foreground-places-v1';
export function mountPlaces(native){
 const tools=document.querySelector('.local-tools');if(!tools)return;
 const button=document.createElement('button');button.type='button';button.className='btn btn-outline btn-sm';button.textContent='Saved places';tools.append(button);
 const get=async()=>{
  const places=native?(await Device.listPlaces()).places:JSON.parse(localStorage.getItem(WEB_KEY)||'[]');
  if(!Array.isArray(places)||places.length>10)throw Error('Saved places are unreadable.');
  return places.map(validatePlace);
 };
 const currentLocation=()=>native?Device.currentLocation():new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(Error('Location is unavailable. Manual tracking still works.'));return;}
  navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude}),()=>reject(Error('Location unavailable or denied. Manual tracking still works.')),{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
 });
 const save=async places=>{
  if(places.length>10)throw Error('You can save up to 10 places.');
  places=places.map(validatePlace);
  if(native)await Device.setPlaces({places});
  else localStorage.setItem(WEB_KEY,JSON.stringify(places));
 };
 button.onclick=async()=>{
  showModal('<div class="modal-title">Saved places</div><p class="dialog-description">'+(native?'Optional arrival reminders use your phone’s background location permission. Delivery may be delayed by the phone.':'Web location checks work only while you use this page; background arrival reminders require the native app.')+' Places stay on this device, are shared across its workspaces, and are not included in tracker backups. No movement history is recorded.</p><div id="savedPlaces"></div><form id="placeForm"><div class="field"><label for="placeName">Place name</label><input id="placeName" maxlength="60" required></div><div class="field"><label for="placeActivity">Activity to suggest</label><select id="placeActivity"></select></div><div class="field"><label for="placeRadius">Radius in metres (100–1000)</label><input id="placeRadius" type="number" min="100" max="1000" value="200" required></div><button class="btn btn-gold" type="submit">Save my current location</button></form><div class="backup-actions"><button id="checkPlaces" class="btn btn-outline" type="button">Check nearby places</button>'+(native?'<button id="enablePlaces" class="btn btn-outline" type="button">Enable arrival reminders</button><button id="disablePlaces" class="btn btn-outline" type="button">Disable arrival reminders</button>':'')+'</div><p id="placeStatus" role="status"></p>');
  const status=document.getElementById('placeStatus'),list=document.getElementById('savedPlaces'),form=document.getElementById('placeForm');
  const select=document.getElementById('placeActivity');
  ACTIVITY_TYPES.forEach(item=>{const option=document.createElement('option');option.value=item.key;option.textContent=item.key;select.append(option);});
  const renderList=async()=>{
   const places=await get();list.replaceChildren();
   for(const place of places){
    const row=document.createElement('div');row.className='place-row';
    const text=document.createElement('p');text.textContent=place.name+' · '+place.activity+' · '+place.radius+' m';
    const remove=document.createElement('button');remove.type='button';remove.className='btn btn-outline btn-sm';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+place.name);
    remove.onclick=()=>run(async()=>{await save((await get()).filter(p=>p.id!==place.id));await renderList();return 'Place removed.';});
    row.append(text,remove);list.append(row);
   }
  };
  let busy=false;
  const run=async action=>{
   if(busy)return;busy=true;status.textContent='Working…';
   const controls=[...document.getElementById('modalBody').querySelectorAll('button')];controls.forEach(c=>c.disabled=true);
   try{const message=await action();if(status.isConnected)status.textContent=message||'';}
   catch(error){if(status.isConnected)status.textContent=error.message;}
   finally{busy=false;controls.forEach(c=>c.disabled=false);}
  };
  form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;run(async()=>{
   const places=await get();if(places.length>=10)throw Error('Remove a place before adding another.');
   const position=await currentLocation();
   const place=validatePlace({id:crypto.randomUUID(),name:document.getElementById('placeName').value,activity:select.value,radius:Number(document.getElementById('placeRadius').value),...position});
   await save([...places,place]);if(form.isConnected){form.reset();await renderList();}return 'Place saved on this device.';
  });};
  document.getElementById('checkPlaces').onclick=()=>run(async()=>{
   const position=await currentLocation(),places=(await get()).filter(p=>distanceMetres(position,p)<=p.radius);
   if(!places.length)return 'You are outside your saved places.';
   if(!status.isConnected)return '';
   const place=places[0];startActivity(place.activity);return '';
  });
  if(native){
   document.getElementById('enablePlaces').onclick=()=>run(async()=>{await Device.enablePlaces();return 'Arrival reminders enabled. Phone restrictions can delay delivery.';});
   document.getElementById('disablePlaces').onclick=()=>run(async()=>{await Device.disablePlaces();return 'Arrival reminders disabled.';});
  }
  await run(async()=>{await renderList();if(native){const result=await Device.placeStatus();return result.enabled?'Arrival reminders requested. Check phone location/notification permissions if they do not arrive.':'Arrival reminders are disabled.';}return '';});
 };
 // A notification opens a suggestion; the existing session form requires confirmation.
 if(native){
  const pending=new URLSearchParams(location.search).get('place');
  if(pending){
   history.replaceState(null,'',location.pathname);
   const deliver=async()=>{
    const place=(await get()).find(p=>p.id===pending);
    if(place&&!window.LifeOSCloud?.locked)startActivity(place.activity);
   };
   window.addEventListener('lifeos-dashboard-ready',()=>deliver().catch(()=>showToast('Saved place unavailable. Start an activity manually.')),{once:true});
  }
 }
}
