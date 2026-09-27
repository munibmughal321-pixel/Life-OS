function legacySessionRecords(){
 if(window.LifeOSCloud?.owner)return null; // Device-only history needs an explicit backup import.
 const raw=localStorage.getItem(SESSION_KEY);
 if(raw===null)return null;
 const data=JSON.parse(raw);
 if(data.version!==1 || !Array.isArray(data.logs) || !data.logs.every(validSession))throw Error('Invalid legacy sessions');
 return data.logs;
}
async function sessionTransaction(change){ return queueLocalWrite(()=>commitSessionChange(change)); }
async function commitSessionChange(change){
 try{
  if(blockedCollections.has('logs') || staleCollections.has('logs'))throw Error('Unreadable logs');
  const db=await openLocalDatabase();
  const outcome=await new Promise((resolve,reject)=>{
   const tx=db.transaction('collections','readwrite'),store=tx.objectStore('collections');
   const request=store.get('logs');let records,result,revision,reason;
   request.onsuccess=()=>{
    try{
     const record=request.result;
     records=record !== undefined ? record.value : (legacySessionRecords() || structuredClone(state.logs));
     if((record !== undefined && !validEnvelope('logs',record)) || !validCollection('logs',records))throw Error('Invalid sessions');
     result=change(records);
     if(!validCollection('logs',records))throw Error('Invalid session update');
     revision=(record?.revision || 0)+1;
     store.put({version:1,revision,value:records},'logs');
    }catch(error){reason=error;tx.abort();}
   };
   tx.oncomplete=()=>resolve({records,result,revision});
   tx.onabort=()=>reject(reason || tx.error || Error('Session write failed'));
   tx.onerror=()=>{};
  });
  state.logs=outcome.records;revisions.logs=outcome.revision;savedValues.logs=structuredClone(state.logs);
  sessionStoreError='';reportStorage('');window.dispatchEvent(new Event('lifeos-local-saved'));return {ok:true,result:outcome.result};
 }catch{
  sessionStoreError='Session changes were not saved. Check browser storage and reload; existing stored data has not been cleared.';
  updateSessionPanel();return {ok:false};
 }
}
async function restoreSessions(){
 try{
  const record=await readCollection('logs');
  if(record !== undefined){
   if(!validEnvelope('logs',record))throw Error('Invalid logs');
   state.logs=record.value;revisions.logs=record.revision;savedValues.logs=structuredClone(state.logs);
  }else{
   const legacy=legacySessionRecords();
   if(legacy){const result=await sessionTransaction(()=>{});if(!result.ok)return;}
  }
  sessionStoreError='';
 }catch{blockedCollections.add('logs');sessionStoreError='Saved sessions could not be read. Changes are blocked; existing records have not been cleared.';}
}
