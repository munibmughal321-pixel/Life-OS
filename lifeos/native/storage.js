import {Device} from './bridge.js';
import {nativeWorkspace} from './workspace.js';
export function installNativeStorage(){
 const workspace=()=>{
  if(window.LifeOSCloud?.locked)throw Error('Account changed. Reload before saving.');
  return nativeWorkspace(Device,window.LifeOSCloud?.databaseName||'lifeos-local');
 };
 const read=async()=>{const store=workspace();const before=await store.read();workspace();return {store,before};};
 openLocalDatabase=async()=>{throw Error('Native storage uses SQLite, not IndexedDB.');};
 readLocalSnapshot=async()=>{const {before}=await read();return before.data.collections;};
 saveMany=keys=>{
  keys=[...new Set(keys)];const snapshots=Object.fromEntries(keys.map(key=>[key,structuredClone(state[key])]));
  return queueLocalWrite(async()=>{
   try{
    const {store,before}=await read();
    for(const key of keys){
     if(!STORAGE_KEYS.includes(key)||blockedCollections.has(key)||staleCollections.has(key))throw Error('Unreadable or stale data; reload before saving.');
     const invalid=DataSchema.error(key,snapshots[key]);if(invalid)throw Error(invalid);
     const record=before.data.collections[key];
     if(record!==undefined&&!validEnvelope(key,record)){blockedCollections.add(key);throw Error('Stored data is unreadable.');}
     if((record?.revision||0)!==(revisions[key]||0)){staleCollections.add(key);throw Error('Local records changed. Preserve your draft and reload.');}
     before.data.collections[key]={version:1,revision:(revisions[key]||0)+1,value:snapshots[key]};
    }
    workspace();await store.commit(before,before.data);
    keys.forEach(key=>{revisions[key]=(revisions[key]||0)+1;savedValues[key]=structuredClone(snapshots[key]);});
    reportStorage('');window.dispatchEvent(new Event('lifeos-local-saved'));return true;
   }catch(error){
    keys.forEach(key=>{state[key]=structuredClone(savedValues[key]??initialValues[key]);});
    reportStorage('Not saved. '+error.message+' Existing data was preserved; keep your draft.');
    showToast(storageError);return false;
   }
  });
 };
 commitBackupImport=preview=>queueLocalWrite(async()=>{
  if(!preview)throw Error('Preview a backup first.');
  const {store,before}=await read(),current=before.data.collections,next={};
  for(const key of STORAGE_KEYS){
   const invalid=DataSchema.error(key,preview.collections[key]);if(invalid)throw Error(invalid);
   if(JSON.stringify(current[key])!==JSON.stringify(preview.before[key]))throw Error('Records changed after preview. Preview again.');
   const revision=current[key]?.revision;
   next[key]={version:1,revision:Number.isSafeInteger(revision)&&revision>0&&revision<Number.MAX_SAFE_INTEGER?revision+1:1,value:preview.collections[key]};
  }
  before.data.recovery['before-import']={createdAt:new Date().toISOString(),records:structuredClone(current)};
  before.data.collections=next;workspace();await store.commit(before,before.data);
  for(const key of STORAGE_KEYS){state[key]=structuredClone(next[key].value);savedValues[key]=structuredClone(state[key]);revisions[key]=next[key].revision;}
  blockedCollections.clear();staleCollections.clear();sessionStoreError='';reportStorage('');window.dispatchEvent(new Event('lifeos-local-saved'));return true;
 });
 readRecoveryPoint=async()=>(await read()).before.data.recovery['before-import'];
 downloadLocalJSON=async(data,name)=>{await Device.exportFile({name,value:JSON.stringify(data,null,2)});};
 window.LocalWorkspace.read=async()=>{
  await writeQueue;const {before}=await read(),records=before.data.collections;
  return {records,collections:snapshotCollections(records),meta:checkedSyncMeta(before.data.recovery['sync-state'])};
 };
 window.LocalWorkspace.commit=(previous,collections,meta)=>queueLocalWrite(async()=>{
  checkedSyncMeta(meta);const {store,before}=await read(),current=before.data.collections;
  const currentMeta=checkedSyncMeta(before.data.recovery['sync-state']);
  if(JSON.stringify(currentMeta)!==JSON.stringify(previous.meta))throw Error('Sync state changed. Retry.');
  for(const key of STORAGE_KEYS){
   if(JSON.stringify(current[key])!==JSON.stringify(previous.records[key]))throw Error('Local records changed during sync. Retry.');
   if(collections){const invalid=DataSchema.error(key,collections[key]);if(invalid)throw Error(invalid);}
  }
  const changed=[];
  if(collections)for(const key of STORAGE_KEYS)if(JSON.stringify(collections[key])!==JSON.stringify(previous.collections[key])){
   current[key]={version:1,revision:(current[key]?.revision||0)+1,value:collections[key]};changed.push(key);
  }
  before.data.recovery['sync-state']=meta;workspace();await store.commit(before,before.data);
  if(changed.length){changed.forEach(key=>staleCollections.add(key));reportStorage('Cloud changes saved on this device. Preserve your draft, then reload.');window.dispatchEvent(new Event('lifeos-cloud-applied'));}
 });
}
