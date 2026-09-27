// A service worker caches application files; IndexedDB owns personal records.
(() => {
  if(window.Capacitor?.isNativePlatform?.())return; // Native app assets are bundled, not service-worker managed.
  const status=document.createElement('p');status.id='offlineStatus';status.className='offline-notice';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  (document.getElementById('storageStatus') || document.querySelector('main') || document.body).insertAdjacentElement('afterend',status);
  let registration;
  function update(){
    if(!document.querySelector('meta[name="lifeos-offline-build"]')){status.textContent='Development preview · offline reopening is tested with npm run build, then npm run preview.';return;}
    if(registration?.waiting){status.textContent='An app update is ready. Save or finish your drafts, close all LifeOS tabs, then reopen to use it. Your saved records stay on this device.';return;}
    const ready=registration?.active?.state==='activated';
    status.textContent=ready?(navigator.onLine?'Ready for offline use · records stay on this device.':'Offline · your saved workspace is available; changes save on this device.'):'Preparing offline access. Keep this page open until it is ready.';
  }
  update();window.addEventListener('online',update);window.addEventListener('offline',update);
  if(!document.querySelector('meta[name="lifeos-offline-build"]'))return;
  if(!('serviceWorker' in navigator) || !window.isSecureContext){status.textContent='Offline reopening needs a supported browser on HTTPS or localhost. Local saving is separate.';return;}
  navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{updateViaCache:'none'}).then(async reg=>{
    registration=reg;update();
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{update();if(worker.state==='redundant')status.textContent='The offline update could not be installed. Existing saved records are unchanged; retry online later.';});});
    await navigator.serviceWorker.ready;update();
    navigator.serviceWorker.addEventListener('controllerchange',update);
  }).catch(()=>{status.textContent='Offline setup failed. Retry while online. Local records are separate from the application cache.';});
})();
