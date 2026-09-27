// Transactions report success only after commit, never after a single put request.
let localDatabase;
let storageError = '';
let pendingWrites = 0;
let writeQueue = Promise.resolve();
const savedValues = {};
const revisions = {};
const blockedCollections = new Set();
const staleCollections = new Set();
const initialValues = structuredClone(state);
function queueLocalWrite(work){
  pendingWrites++;
  const result=writeQueue.then(work);
  writeQueue=result.catch(()=>{});
  return result.finally(()=>pendingWrites--);
}
function openLocalDatabase(){
  if(window.LifeOSCloud?.locked)return Promise.reject(Error('Account workspace is locked. Reload to continue.'));
  if(localDatabase)return localDatabase;
  localDatabase=new Promise((resolve,reject)=>{
    let settled=false;
    const request=indexedDB.open(window.LifeOSCloud?.databaseName || 'lifeos-local',2);
    const fail=error=>{if(!settled){settled=true;clearTimeout(timer);reject(error);}};
    const timer=setTimeout(()=>fail(Error('Storage did not open. Close other LifeOS tabs and reload.')),8000);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('collections'))db.createObjectStore('collections');
      if(!db.objectStoreNames.contains('recovery'))db.createObjectStore('recovery');
    };
    request.onsuccess=()=>{
      if(settled){request.result.close();return;}
      settled=true;clearTimeout(timer);
      const db=request.result;
      db.onversionchange=()=>{db.close();localDatabase=null;reportStorage('LifeOS storage changed in another tab. Save drafts outside the app and reload.');};
      resolve(db);
    };
    request.onerror=()=>fail(request.error);
    request.onblocked=()=>fail(Error('Close other LifeOS tabs and reload to finish the storage upgrade.'));
  }).catch(error=>{localDatabase=null;throw error;});
  return localDatabase;
}
function validCollection(key,value){return !DataSchema.error(key,value);}
function validEnvelope(key,record){
  return record && record.version===1 && Number.isSafeInteger(record.revision) && record.revision>0 && validCollection(key,record.value);
}
async function readLocalSnapshot(){
  const db=await openLocalDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('collections','readonly'),store=tx.objectStore('collections'),records={};
    STORAGE_KEYS.forEach(key=>{store.get(key).onsuccess=event=>{records[key]=event.target.result;};});
    tx.oncomplete=()=>resolve(records);
    tx.onabort=()=>reject(tx.error || Error('Read failed'));
    tx.onerror=()=>{};
  });
}
async function readCollection(key){return (await readLocalSnapshot())[key];}
function reportStorage(message){
  message ||= blockedCollections.size?'Some stored collections are unreadable. Their writes are blocked. Use Backup & recovery to export raw recovery data or restore a valid backup.':staleCollections.size?'Data changed in another tab. Preserve your draft and reload before saving.':'';
  storageError=message;
  const status=document.getElementById('storageStatus');
  if(status){status.textContent=message || 'Saved on this device · see account sync status below';status.setAttribute('role',message?'alert':'status');}
}
function saveMany(keys){
  keys=[...new Set(keys)];
  const snapshots=Object.fromEntries(keys.map(key=>[key,structuredClone(state[key])]));
  return queueLocalWrite(async()=>{
    try{
      for(const key of keys){
        if(!STORAGE_KEYS.includes(key)||blockedCollections.has(key)||staleCollections.has(key))throw Error('Unreadable or stale data; reload before saving.');
        const invalid=DataSchema.error(key,snapshots[key]);if(invalid)throw Error(invalid);
      }
      const db=await openLocalDatabase();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('collections','readwrite'),store=tx.objectStore('collections');let reason;
        keys.forEach(key=>{store.get(key).onsuccess=event=>{ try {
          const record=event.target.result;
          if(record !== undefined && !validEnvelope(key,record)){blockedCollections.add(key);reason=Error('Stored data is unreadable.');tx.abort();return;}
          if((record?.revision || 0)!==(revisions[key] || 0)){staleCollections.add(key);reason=Error('Changed in another tab. Preserve your draft and reload.');tx.abort();return;}
          store.put({version:1,revision:(revisions[key] || 0)+1,value:snapshots[key]},key);
        }catch(error){reason=error;tx.abort();} };});
        tx.oncomplete=resolve;tx.onabort=()=>reject(reason || tx.error || Error('Write failed'));tx.onerror=()=>{};
      });
      keys.forEach(key=>{revisions[key]=(revisions[key] || 0)+1;savedValues[key]=structuredClone(snapshots[key]);});
      reportStorage('');window.dispatchEvent(new Event('lifeos-local-saved'));return true;
    }catch(error){
      keys.forEach(key=>{state[key]=structuredClone(savedValues[key] ?? initialValues[key]);});
      const detail=error.name==='QuotaExceededError'?'Browser storage is full. Export a backup and free device space.':error.message;
      reportStorage('Not saved. '+detail+' Existing stored data was preserved; keep your draft before reloading.');
      showToast(storageError);return false;
    }
  });
}
async function save(key){return saveMany([key]);}
async function loadAll(){
  try{
    const records=await readLocalSnapshot();
    for(const key of STORAGE_KEYS){
      const record=records[key];
      if(record !== undefined && !validEnvelope(key,record)){blockedCollections.add(key);continue;}
      state[key]=structuredClone(record !== undefined?record.value:initialValues[key]);
      revisions[key]=record?.revision || 0;savedValues[key]=structuredClone(state[key]);
    }
  }catch{STORAGE_KEYS.forEach(key=>blockedCollections.add(key));}
  reportStorage('');
}

window.addEventListener('beforeunload',event=>{
  if(pendingWrites>0){event.preventDefault();event.returnValue='';}
});
