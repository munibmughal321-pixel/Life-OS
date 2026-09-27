// Adapter between classic dashboard globals and module-based cloud syncing.
function checkedSyncMeta(meta){
 if(meta===undefined)return {enabled:false,base:{},conflicts:[]};
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 if(!object(meta)||typeof meta.enabled!=='boolean'||!object(meta.base)||!Array.isArray(meta.conflicts))throw Error('Sync metadata is unreadable. Export a local backup; do not clear browser data.');
 for(const [identity,row] of Object.entries(meta.base)){
  if(!object(row)||!STORAGE_KEYS.includes(row.collection)||identity!==row.collection+'/'+row.record_key||!Number.isSafeInteger(row.revision)||row.revision<1||!object(row.payload)||!DataSchema.safeJSON(row.payload)||row.user_id!==window.LifeOSCloud?.owner)throw Error('Sync history is unreadable. Export a local backup before recovery.');
 }
 for(const conflict of meta.conflicts)if(!object(conflict)||typeof conflict.id!=='string'||typeof conflict.signature!=='string')throw Error('Sync conflict history is unreadable. Export a local backup before recovery.');
 return meta;
}

window.LocalWorkspace={
 defaults:initialValues,
 validate:(key,value)=>DataSchema.error(key,value),
 async read(){
  await writeQueue;
  const db=await openLocalDatabase();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(['collections','recovery'],'readonly'),records={};let meta;
   STORAGE_KEYS.forEach(key=>{tx.objectStore('collections').get(key).onsuccess=e=>{records[key]=e.target.result;};});
   tx.objectStore('recovery').get('sync-state').onsuccess=e=>{meta=e.target.result;};
   tx.oncomplete=()=>{try{resolve({records,collections:snapshotCollections(records),meta:checkedSyncMeta(meta)});}catch(e){reject(e);}};
   tx.onabort=()=>reject(tx.error||Error('Could not read sync state.'));tx.onerror=()=>{};
  });
 },
 commit(before,collections,meta){
  return queueLocalWrite(async()=>{
   if(window.LifeOSCloud?.locked)throw Error('Account changed. Reload before syncing.');
   checkedSyncMeta(meta);
   if(collections)for(const key of STORAGE_KEYS){const error=DataSchema.error(key,collections[key]);if(error)throw Error(error);}
   const db=await openLocalDatabase(),changed=[];
   await new Promise((resolve,reject)=>{
    const tx=db.transaction(['collections','recovery'],'readwrite'),store=tx.objectStore('collections');
    let reason,remaining=STORAGE_KEYS.length+1,currentMeta;const current={};
    const finish=()=>{
     if(--remaining)return;
     try{
      if(JSON.stringify(currentMeta||{enabled:false,base:{},conflicts:[]})!==JSON.stringify(before.meta))throw Error('Sync state changed in another tab. Retry.');
      for(const key of STORAGE_KEYS)if(JSON.stringify(current[key])!==JSON.stringify(before.records[key]))throw Error('Local records changed during sync. Retry; your edits are safe.');
      if(collections)for(const key of STORAGE_KEYS){
       if(JSON.stringify(collections[key])!==JSON.stringify(before.collections[key])){
        store.put({version:1,revision:(current[key]?.revision||0)+1,value:collections[key]},key);changed.push(key);
       }
      }
      tx.objectStore('recovery').put(meta,'sync-state');
     }catch(error){reason=error;tx.abort();}
    };
    STORAGE_KEYS.forEach(key=>{store.get(key).onsuccess=e=>{current[key]=e.target.result;finish();};});
    tx.objectStore('recovery').get('sync-state').onsuccess=e=>{currentMeta=e.target.result;finish();};
    tx.oncomplete=resolve;tx.onabort=()=>reject(reason||tx.error||Error('Could not commit sync.'));tx.onerror=()=>{};
   });
   if(changed.length){
    // Keep unfinished forms intact. A deliberate reload displays downloaded changes.
    changed.forEach(key=>staleCollections.add(key));
    reportStorage('Cloud changes saved on this device. Preserve any draft, then reload to view them.');
    window.dispatchEvent(new Event('lifeos-cloud-applied'));
   }
  });
 }
};
