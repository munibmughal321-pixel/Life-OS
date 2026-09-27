// Backups contain tracker data only, never credentials or cloud tokens.
const BACKUP_LIMIT = 10 * 1024 * 1024;
let backupPreview = null;
function snapshotCollections(records){
  const collections={};
  for(const key of STORAGE_KEYS){
    const record=records[key];
    if(record !== undefined && !validEnvelope(key,record))throw Error(key+': saved data is unreadable. Export raw recovery data before restoring a known-good backup.');
    collections[key]=structuredClone(record !== undefined?record.value:initialValues[key]);
  }
  return collections;
}
async function createLocalBackup(){
  await writeQueue;
  return {format:'lifeos-backup',version:1,createdAt:new Date().toISOString(),collections:snapshotCollections(await readLocalSnapshot())};
}
function validateBackup(document, existing){
  if(!document || typeof document!=='object' || Array.isArray(document))throw Error('Choose a LifeOS JSON backup.');
  let incoming,legacy=false;
  if(document.format!==undefined){
    if(document.format!=='lifeos-backup' || document.version!==1 || !DataSchema.timestamp(document.createdAt))throw Error('Unsupported backup format or version. No records were changed.');
    incoming=document.collections;
  }else{
    legacy=true;incoming=document;
  }
  if(!incoming || typeof incoming!=='object' || Array.isArray(incoming) || !DataSchema.safeJSON(incoming))throw Error('Invalid or unsafe backup content.');
  const keys=Object.keys(incoming);
  if(!keys.length || keys.some(key=>!STORAGE_KEYS.includes(key)))throw Error('Unknown collections. This file is not a supported LifeOS tracker backup.');
  if(!legacy && keys.length!==STORAGE_KEYS.length)throw Error('Incomplete backup: all tracker collections are required.');
  const collections={};
  for(const key of STORAGE_KEYS){
    if(Object.hasOwn(incoming,key))collections[key]=structuredClone(incoming[key]);
    else {
      const record=existing[key];
      if(record !== undefined && !validEnvelope(key,record))throw Error('Legacy import cannot preserve unreadable '+key+'. Use a complete backup.');
      collections[key]=structuredClone(record !== undefined?record.value:initialValues[key]);
    }
    const invalid=DataSchema.error(key,collections[key]);if(invalid)throw Error(invalid+' Nothing was imported.');
  }
  return {collections,legacy,keys};
}
async function prepareBackupImport(text){
  if(new Blob([text]).size>BACKUP_LIMIT)throw Error('Backup exceeds the 10 MB import limit.');
  let document;try{document=JSON.parse(text);}catch{throw Error('The file is not valid JSON. No records were changed.');}
  await writeQueue;
  const before=await readLocalSnapshot();
  return {...validateBackup(document,before),before};
}
async function commitBackupImport(preview){
  return queueLocalWrite(async()=>{
    if(!preview)throw Error('Preview a backup first.');
    for(const key of STORAGE_KEYS){const invalid=DataSchema.error(key,preview.collections[key]);if(invalid)throw Error(invalid);}
    const db=await openLocalDatabase();
    const nextRevisions={};
    // Save the prior snapshot and replace all collections in ONE transaction.
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['collections','recovery'],'readwrite'),store=tx.objectStore('collections');
      let remaining=STORAGE_KEYS.length,reason;
      const current={};
      STORAGE_KEYS.forEach(key=>{store.get(key).onsuccess=event=>{ try {
        current[key]=event.target.result;
        if(JSON.stringify(current[key])!==JSON.stringify(preview.before[key])){reason=Error('Records changed after the preview. Preview the backup again before restoring.');tx.abort();return;}
        if(--remaining)return;
        tx.objectStore('recovery').put({createdAt:new Date().toISOString(),records:current},'before-import');
        for(const name of STORAGE_KEYS){
          const previous=current[name]?.revision;
          const revision=Number.isSafeInteger(previous)&&previous>0&&previous<Number.MAX_SAFE_INTEGER?previous+1:1;
          nextRevisions[name]=revision;
          store.put({version:1,revision,value:preview.collections[name]},name);
        }
      }catch(error){reason=error;tx.abort();} };});
      tx.oncomplete=resolve;tx.onabort=()=>reject(reason || tx.error || Error('Restore failed. No collections were replaced.'));tx.onerror=()=>{};
    });
    for(const key of STORAGE_KEYS){state[key]=structuredClone(preview.collections[key]);savedValues[key]=structuredClone(state[key]);revisions[key]=nextRevisions[key];}
    blockedCollections.clear();staleCollections.clear();sessionStoreError='';reportStorage('');window.dispatchEvent(new Event('lifeos-local-saved'));
    return true;
  });
}
async function readRecoveryPoint(){
  const db=await openLocalDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('recovery','readonly'),request=tx.objectStore('recovery').get('before-import');
    tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error || Error('Recovery copy unavailable'));tx.onerror=()=>{};
  });
}
function downloadLocalJSON(data,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function backupFilename(prefix){return prefix+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';}
async function exportLocalBackup(){
  const backup=await createLocalBackup();
  await downloadLocalJSON(backup,backupFilename('lifeos-backup'));
}
async function exportRawRecovery(){
  const legacy={};
  try{if(!window.LifeOSCloud?.owner)for(const key of [...STORAGE_KEYS.map(key=>'lifeos_data_'+key),SESSION_KEY]){const raw=localStorage.getItem(key);if(raw!==null)legacy[key]=raw;}}catch{/* Raw IndexedDB export can still help when localStorage is blocked. */}
  await downloadLocalJSON({format:'lifeos-raw-recovery',version:1,createdAt:new Date().toISOString(),records:await readLocalSnapshot(),legacy},backupFilename('lifeos-raw-recovery'));
}
async function prepareLegacyBrowserImport(){
  if(window.LifeOSCloud?.owner)throw Error('Open the device-only workspace while signed out, export a backup, then import it explicitly into this account.');
  const collections={};
  for(const key of STORAGE_KEYS){
    const raw=localStorage.getItem('lifeos_data_'+key);
    if(raw!==null){try{collections[key]=JSON.parse(raw);}catch{throw Error('Legacy '+key+' contains invalid JSON; source data was left untouched.');}}
  }
  if(!Object.keys(collections).length)throw Error('No legacy lifeos_data_* records were found at this browser address. Import a JSON file exported from the original address instead.');
  return prepareBackupImport(JSON.stringify(collections));
}
function showBackupPreview(preview){
  backupPreview=preview;
  const output=document.getElementById('backupPreview');output.replaceChildren();
  const explanation=document.createElement('p');
  explanation.textContent=preview.legacy?'Legacy import: listed collections replace their current versions; collections absent from the file are retained. The original source is not removed.':'Restore replaces all tracker collections. It does not merge or append records. Welcome preferences stay specific to this browser.';
  output.append(explanation);
  const table=document.createElement('table');table.className='backup-counts';
  const caption=document.createElement('caption');caption.textContent='Records before and after restore';table.append(caption);
  const header=document.createElement('tr');for(const label of ['Collection','Current','Backup']){const th=document.createElement('th');th.textContent=label;header.append(th);}table.append(header);
  const count=v=>Array.isArray(v)?v.length:v?Object.keys(v).length:0;
  for(const key of STORAGE_KEYS){const row=document.createElement('tr');for(const value of [key,preview.before[key]!==undefined&&!validEnvelope(key,preview.before[key])?'Unreadable':count(preview.before[key]?.value),count(preview.collections[key])]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}table.append(row);}
  output.append(table);
  const label=document.createElement('label');label.className='session-option';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='confirmBackupReplace';
  label.append(checkbox,document.createTextNode('I understand that this replaces local tracker data. A recovery copy will be kept on this device.'));
  const button=document.createElement('button');button.id='restoreBackupButton';button.className='btn btn-gold';button.textContent='Restore this backup';button.disabled=true;
  checkbox.onchange=()=>button.disabled=!checkbox.checked;
  button.onclick=async()=>{
    button.disabled=true;
    try{await commitBackupImport(preview);backupPreview=null;closeModal();render();updateSessionPanel();showToast('Backup restored on this device. The previous data is available in Backup & recovery.');}
    catch(error){document.getElementById('backupMessage').textContent=error.name==='QuotaExceededError'?'Not restored: browser storage is full. Free space, then preview again. Existing data is unchanged.':error.message;button.disabled=false;}
  };
  output.append(label,button);
}
function openBackupTools(){
  backupPreview=null;
  showModal(`<div class="modal-title">Backup & recovery</div>
    <p class="dialog-description">Keep a copy outside this browser. Backups include all 19 tracker collections: activities, profile, finance, growth, Deen and journals. They contain private information and are not encrypted. Welcome preferences and account credentials are not included.</p>
    <div class="backup-actions"><button type="button" class="btn btn-gold" id="exportBackup">Download backup</button><button type="button" class="btn btn-outline" id="persistentStorage">Request storage protection</button></div>
    <p id="storageProtection" class="field-hint">Browser clearing still removes local records, even when storage protection is granted.</p>
    <div class="field"><label for="backupFile">Preview a LifeOS JSON backup (up to 10 MB)</label><input id="backupFile" type="file" accept=".json,application/json"></div>
    <details><summary>Recovery and older versions</summary><div class="backup-actions"><button type="button" class="btn btn-outline" id="undoImport">Preview data from before the last restore</button><button type="button" class="btn btn-outline" id="exportRecovery">Export raw recovery data</button><button type="button" class="btn btn-outline" id="exportPreviousRecovery">Export the previous recovery copy</button><button type="button" class="btn btn-outline" id="legacyImport">Preview older browser data</button></div><p class="field-hint">Raw recovery files are for diagnosis, not normal import. Legacy imports accept JSON objects keyed by tracker collection names or old lifeos_data_* browser records at this same address. No old source is deleted.</p></details>
    <p id="backupMessage" role="status" aria-live="polite"></p><div id="backupPreview"></div>`);
  const message=document.getElementById('backupMessage');
  let operation=0,previewRequest=0;
  const run=async work=>{const current=++operation;message.textContent='Working…';try{const result=await work();if(current!==operation || !message.isConnected)return;message.textContent=result || ''; }catch(error){if(current===operation&&message.isConnected)message.textContent=error.message;}};
  document.getElementById('exportBackup').onclick=()=>run(async()=>{await exportLocalBackup();return 'Backup download requested. Keep the file somewhere safe outside this browser.';});
  document.getElementById('exportRecovery').onclick=()=>run(async()=>{await exportRawRecovery();return 'Raw recovery download requested. This file is not a normal backup.';});
  document.getElementById('exportPreviousRecovery').onclick=()=>run(async()=>{const point=await readRecoveryPoint();if(!point)throw Error('No previous recovery copy is available.');await downloadLocalJSON({format:'lifeos-raw-recovery',version:1,...point},backupFilename('lifeos-previous-recovery'));return 'Previous recovery copy downloaded for diagnosis.';});
  document.getElementById('persistentStorage').onclick=()=>run(async()=>{
    if(!navigator.storage?.persist)return 'Storage protection is unavailable in this browser. Keep regular backups.';
    const granted=await navigator.storage.persist();document.getElementById('storageProtection').textContent=granted?'Storage protection granted. Browser clearing can still remove data.':'The browser did not grant protection. Saving still works; keep regular backups.';return '';
  });
  document.getElementById('backupFile').onchange=event=>{
    const request=++previewRequest;const file=event.target.files[0];backupPreview=null;document.getElementById('backupPreview').replaceChildren();
    if(!file)return;
    run(async()=>{if(file.size>BACKUP_LIMIT)throw Error('Backup exceeds the 10 MB import limit.');const preview=await prepareBackupImport(await file.text());if(request!==previewRequest || !message.isConnected)return '';showBackupPreview(preview);return 'Preview ready. No records have changed.';});
  };
  document.getElementById('legacyImport').onclick=()=>{const request=++previewRequest;document.getElementById('backupPreview').replaceChildren();run(async()=>{const preview=await prepareLegacyBrowserImport();if(request!==previewRequest || !message.isConnected)return '';showBackupPreview(preview);return 'Legacy preview ready. Source data is unchanged.';});};
  document.getElementById('undoImport').onclick=()=>{const request=++previewRequest;document.getElementById('backupPreview').replaceChildren();run(async()=>{
    const point=await readRecoveryPoint();if(!point)throw Error('No previous restore is available on this device.');
    const data={format:'lifeos-backup',version:1,createdAt:point.createdAt,collections:snapshotCollections(point.records)};
    const preview=await prepareBackupImport(JSON.stringify(data));if(request!==previewRequest || !message.isConnected)return '';showBackupPreview(preview);return 'Recovery preview ready. Restoring will save the current data as the next recovery copy.';
  });};
}
