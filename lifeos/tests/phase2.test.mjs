import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from '@playwright/test';
import {collections} from './fixtures.mjs';
const root=resolve('dist');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function startServer(){
 const server=createServer(async(req,res)=>{
  try{
   const route=new URL(req.url,'http://localhost').pathname;
   const file=resolve(root,'.'+(route==='/'?'/index.html':route));
   if(!file.startsWith(root+sep))throw Error();
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'})[extname(file)] || 'application/octet-stream');
   res.setHeader('Cache-Control','no-store');res.end(route==='/sw.js' && server.workerOverride ? server.workerOverride : await readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;
}
async function open(page,origin){
 await page.goto(origin+'/dashboard.html');
 await page.waitForFunction(()=>typeof initialValues!=='undefined' && document.getElementById('screenTitle').textContent==='Overview' && document.getElementById('storageStatus').textContent!=='Opening local storage…');
}
const backup=()=>({format:'lifeos-backup',version:1,createdAt:'2026-09-15T12:00:00Z',collections:structuredClone(collections)});

test('Phase 2 backup, recovery, validation, offline and browser restart', {timeout:180000}, async()=>{
 const server=await startServer(),origin='http://127.0.0.1:'+server.address().port;
 const profile=await mkdtemp(resolve(tmpdir(),'lifeos-phase2-'));
 let context;
 const errors=[];
 const launch=()=>chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,timezoneId:'Asia/Karachi'});
 try{
  context=await launch();let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await open(page,origin);
  // Real backup import through file chooser, preview and explicit replacement control.
  await page.getByRole('button',{name:'Backup & recovery',exact:true}).click();
  await page.setInputFiles('#backupFile',{name:'sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup()))});
  await page.waitForSelector('#confirmBackupReplace');
  assert.equal(await page.evaluate(()=>state.finance.length),0,'preview must not write');
  await page.check('#confirmBackupReplace');await page.click('#restoreBackupButton');
  await page.waitForFunction(()=>state.finance.length===1);
  assert.deepEqual(await page.evaluate(async()=>(await createLocalBackup()).collections),collections);
  // Every renderer tolerates every imported collection.
  for(const screen of ['dashboard','activities','finance','growth','deen','me'])await page.evaluate(s=>goToScreen(s),screen);
  await page.reload();await page.waitForFunction(()=>state.notes.length===1);
  assert.deepEqual(await page.evaluate(async()=>(await createLocalBackup()).collections),collections);
  // Export actual committed records via a download.
  await page.evaluate(()=>openBackupTools());
  const downloadEvent=page.waitForEvent('download');await page.click('#exportBackup');const download=await downloadEvent;
  assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')).collections,collections);
  await page.keyboard.press('Escape');
  // Reimport is replacement, never appending duplicate records.
  await page.evaluate(async data=>{await commitBackupImport(await prepareBackupImport(JSON.stringify(data)));},backup());
  assert.deepEqual(await page.evaluate(async()=>(await createLocalBackup()).collections),collections);
  // Reject malformed data without changing the database.
  const rejected=await page.evaluate(async template=>{
   const variants=[];
   for(const key of STORAGE_KEYS){const b=structuredClone(template);b.collections[key]='invalid';variants.push(b);}
   const bad=structuredClone(template);bad.collections.finance[0].amount=-1;variants.push(bad);
   const nested=structuredClone(template);nested.collections.notes[0].checklist[0].done='yes';variants.push(nested);
   const duplicate=structuredClone(template);duplicate.collections.logs.push({...duplicate.collections.logs[0]});variants.push(duplicate);
   const running=structuredClone(template);running.collections.logs=[{...running.collections.logs[0],endISO:null},{...running.collections.logs[0],id:'another',endISO:null}];variants.push(running);
   const incomplete=structuredClone(template);delete incomplete.collections.journal;variants.push(incomplete);
   variants.push({...template,version:99});
   let count=0;
   for(const b of variants){try{await prepareBackupImport(JSON.stringify(b));}catch{count++;}}
   for(const text of ['not-json','{"__proto__":{}}']){try{await prepareBackupImport(text);}catch{count++;}}
   return count;
  },backup());
  assert.equal(rejected,27);
  assert.deepEqual(await page.evaluate(async()=>(await createLocalBackup()).collections),collections);
  // Quota failure during restore aborts the recovery checkpoint and ALL writes.
  assert.equal(await page.evaluate(async data=>{
   const preview=await prepareBackupImport(JSON.stringify(data));
   const original=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,key){if(this.name==='collections'&&key==='finance')throw new DOMException('Full','QuotaExceededError');return original.call(this,value,key);};
   try{await commitBackupImport(preview);return false;}catch{return true;}finally{IDBObjectStore.prototype.put=original;}
  },{...backup(),collections:{...collections,profile:{...collections.profile,name:'Must roll back'}}}),true);
  assert.deepEqual(await page.evaluate(async()=>(await createLocalBackup()).collections),collections);
  // Preview is optimistic: a concurrent edit must cause restore to abort.
  const second=await context.newPage();await open(second,origin);
  await page.evaluate(async data=>{window.testPreview=await prepareBackupImport(JSON.stringify(data));},backup());
  assert.equal(await second.evaluate(async()=>{state.profile.name='Other tab';return save('profile');}),true);
  assert.equal(await page.evaluate(async()=>{try{await commitBackupImport(window.testPreview);return false;}catch(e){return e.message.includes('changed');}}),true);
  assert.equal(await page.evaluate(async()=>(await readCollection('profile')).value.name),'Other tab');
  await second.close();
  // Capture and use the previous data as an undo snapshot.
  await page.evaluate(async data=>{await commitBackupImport(await prepareBackupImport(JSON.stringify(data)));},backup());
  assert.equal(await page.evaluate(async()=>(await readRecoveryPoint()).records.profile.value.name),'Other tab');
  await page.evaluate(async()=>{const old=await readRecoveryPoint();await commitBackupImport(await prepareBackupImport(JSON.stringify({format:'lifeos-backup',version:1,createdAt:old.createdAt,collections:snapshotCollections(old.records)})));});
  assert.equal(await page.evaluate(()=>state.profile.name),'Other tab');
  // Legacy collections are previewed, preserving absent collections and old source.
  await page.evaluate(()=>localStorage.setItem('lifeos_data_notes',JSON.stringify([{id:'legacy-note',title:'Legacy',content:'Keep source',date:'2026-09-12'}])));
  await page.evaluate(async()=>{await commitBackupImport(await prepareLegacyBrowserImport());});
  assert.equal(await page.evaluate(()=>state.notes[0].id),'legacy-note');
  assert.equal(await page.evaluate(()=>state.finance.length),1);
  assert.ok(await page.evaluate(()=>localStorage.getItem('lifeos_data_notes')));
  // Confirm a running timer, stop the whole browser, reopen with the same profile offline.
  await page.evaluate(async()=>{await sessionTransaction(records=>records.push({id:'running',activity:'Work',startISO:new Date(Date.now()-60000).toISOString(),endISO:null}));});
  await page.waitForFunction(()=>document.getElementById('offlineStatus').textContent.includes('Ready for offline'));
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.close();context=null;
  context=await launch();await context.setOffline(true);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await open(page,origin);
  assert.equal(await page.evaluate(()=>activeLog().id),'running');
  assert.equal(await page.evaluate(()=>state.notes[0].id),'legacy-note');
  await page.evaluate(async()=>{await finishSession('running');});
  await page.reload();await page.waitForFunction(()=>state.logs.some(l=>l.id==='running'&&l.endISO));
  assert.ok(await page.evaluate(()=>state.logs.find(l=>l.id==='running').endISO));
  // All pages and modules reopen offline, not just the original visited page.
  for(const route of ['index','welcome','login','signup','forgot-password','reset-password','dashboard']){
   const response=await page.goto(origin+'/'+route+'.html');assert.equal(response.status(),200);
  }
  await page.waitForFunction(()=>state.notes.length===1);
  assert.equal(await page.evaluate(async()=>{state.journal.push({date:today(),best:'Offline entry',worst:'',focus:''});return save('journal');}),true);
  await page.reload();await page.waitForFunction(()=>state.journal.length===2);
  // Overnight elapsed time uses local-day boundaries; scheduled expiry survives restart.
  assert.equal(await page.evaluate(()=>{
   const prior=state.logs;state.logs=[{id:'night',activity:'Sleep',startISO:'2026-09-13T23:00:00',endISO:'2026-09-14T07:00:00'}];
   const result=activityDaySummary(new Date('2026-09-14T08:00:00').getTime()).tracked;state.logs=prior;return result;
  }),7*3600000);
  await page.evaluate(async()=>{await sessionTransaction(records=>records.push({id:'overdue',activity:'Study',startISO:new Date(Date.now()-60000).toISOString(),plannedEndISO:new Date(Date.now()-1000).toISOString(),endISO:null}));});
  await page.reload();await page.waitForFunction(()=>state.logs.find(l=>l.id==='overdue')?.endISO);
  assert.equal(await page.evaluate(()=>{const l=state.logs.find(l=>l.id==='overdue');return l.endISO===l.plannedEndISO;}),true);
  // Recovery UI fits phones and remains keyboard accessible.
  await page.setViewportSize({width:320,height:800});await page.evaluate(()=>openBackupTools());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'tests/visual-phase2-backup.png',fullPage:true});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#modalBackdrop.open').count(),0);
  assert.deepEqual(errors,[]);
 }finally{
  if(context)await context.close();await new Promise(r=>server.close(r));if(!profile.startsWith(resolve(tmpdir())+sep+'lifeos-phase2-'))throw Error('Unexpected test profile path');await rm(profile,{recursive:true,force:true});
 }
});

test('Phase 2 collection workflows, corrupt data, blocked upgrade and safe app update', {timeout:150000}, async()=>{
 const server=await startServer(),origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[];
 try{
  const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await open(page,origin);
  const edited=structuredClone(collections);
  edited.logs[0].reflection='Edited';edited.prayers['2026-09-12'].Fajr=false;edited.quran[0].pages=4;
  edited.finance[0].amount=150;edited.loans[0].settled=true;edited.recurring[0].amount=1200;
  edited.checkins[0].mood=8;edited.profile.name='Edited';edited.goals[0].current=3;
  edited.skills[0].xp=3;edited.education[0].completed=3;edited.notes[0].content='Edited';
  edited.journal[0].focus='Edited';edited.mission.goalId=null;edited.courses[0].gradePoints=4;
  edited.adhkar['2026-09-12'].evening=true;edited.jumuah['2026-09-11']=false;
  edited.ramadan.enabled=true;edited.trades[0].exit=12;
  for(const data of [collections,edited]){
   assert.equal(await page.evaluate(async data=>{Object.assign(state,structuredClone(data));return saveMany(STORAGE_KEYS);},data),true);
   await page.reload();await page.waitForFunction(()=>typeof pendingWrites!=='undefined' && state.finance.length===1);
   assert.deepEqual(await page.evaluate(async()=>(await createLocalBackup()).collections),data);
  }
  assert.equal(await page.evaluate(async()=>{Object.assign(state,structuredClone(initialValues));return saveMany(STORAGE_KEYS);}),true);
  await page.reload();await page.waitForFunction(()=>document.getElementById('storageStatus').textContent.includes('Saved on'));
  assert.deepEqual(await page.evaluate(async()=>(await createLocalBackup()).collections),await page.evaluate(()=>initialValues));
  // Finance, Deen and personal check-ins use their actual forms and persistence callers.
  await page.evaluate(()=>{goToScreen('finance');openFinanceModal();});
  await page.fill('#finAmount','350');await page.fill('#finCategory','Food');await page.fill('#finNote','Sample expense');
  await page.evaluate(async()=>{setFinType('expense');await addFinance();});
  await page.evaluate(()=>openLoanModal());await page.fill('#loanName','Sample loan');await page.fill('#loanAmount','100');
  await page.evaluate(()=>saveLoan(null));
  await page.evaluate(()=>openLoanModal(state.loans[0].id));await page.fill('#loanAmount','200');await page.evaluate(()=>saveLoan(state.loans[0].id));
  await page.evaluate(()=>{goToScreen('deen');});
  await page.evaluate(async()=>{await togglePrayer('Fajr');await toggleAdhkar('morning');await toggleJumuah();await toggleRamadan();await toggleFasting();});
  await page.fill('#quranInput','5');await page.evaluate(()=>logQuran());
  await page.evaluate(()=>goToScreen('me'));
  await page.fill('#ciWeight','70');await page.fill('#ciEnergy','6');await page.fill('#ciMood','7');
  await page.evaluate(()=>saveCheckin());
  await page.fill('#jBest','Kept a useful routine');await page.fill('#jWorst','');await page.fill('#jFocus','Rest');await page.evaluate(()=>saveJournal());
  await page.fill('#profileName','Local tester');await page.evaluate(()=>saveProfile());
  await page.reload();await page.waitForFunction(()=>state.profile.name==='Local tester');
  assert.equal(await page.evaluate(()=>state.finance[0].amount),350);
  assert.equal(await page.evaluate(()=>state.loans[0].amount),200);
  assert.equal(await page.evaluate(()=>state.quran[0].pages),5);
  assert.equal(await page.evaluate(()=>state.checkins[0].weight),70);
  assert.equal(await page.evaluate(()=>state.journal[0].focus),'Rest');
  await page.evaluate(()=>deleteLoan(state.loans[0].id));await page.reload();await page.waitForFunction(()=>document.getElementById('storageStatus').textContent.includes('Saved on'));
  assert.equal(await page.evaluate(()=>state.loans.length),0);
  // A real transaction put failure leaves the form and previous disk value intact.
  await page.evaluate(()=>{goToScreen('finance');openFinanceModal();window.putBeforeTest=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Full','QuotaExceededError');};});
  await page.fill('#finAmount','999');await page.fill('#finNote','Keep this draft');await page.evaluate(()=>addFinance());
  assert.equal(await page.inputValue('#finNote'),'Keep this draft');assert.equal(await page.evaluate(()=>state.finance.length),1);
  assert.ok(await page.evaluate(()=>storageError.includes('full')));
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.putBeforeTest;closeModal();});
  // Invalid/null stored data is not treated as an empty collection and never overwritten.
  await page.evaluate(async()=>{const db=await openLocalDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('collections','readwrite');tx.objectStore('collections').put(null,'notes');tx.oncomplete=resolve;tx.onabort=reject;});});
  await page.reload();await page.waitForFunction(()=>blockedCollections.has('notes'));
  assert.equal(await page.evaluate(async()=>{state.notes=[];return save('notes');}),false);
  assert.equal(await page.evaluate(()=>readCollection('notes')),null);
  assert.equal(await page.evaluate(async()=>{try{await createLocalBackup();return false;}catch{return true;}}),true);
  await page.evaluate(async data=>{await commitBackupImport(await prepareBackupImport(JSON.stringify(data)));},backup());
  assert.equal(await page.evaluate(async()=>(await readRecoveryPoint()).records.notes),null);
  assert.equal(await page.evaluate(()=>blockedCollections.size),0);
  // Failed database upgrades can recover after closing the old version's connection.
  const blockedContext=await browser.newContext();const holder=await blockedContext.newPage();await holder.goto(origin+'/index.html');
  await holder.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('lifeos-local',1);request.onupgradeneeded=()=>request.result.createObjectStore('collections');request.onsuccess=()=>{window.heldDatabase=request.result;resolve();};request.onerror=reject;}));
  const waiting=await blockedContext.newPage();await open(waiting,origin);
  await waiting.waitForFunction(()=>blockedCollections.size===19);
  await holder.evaluate(()=>window.heldDatabase.close());await holder.close();
  await waiting.reload();await waiting.waitForFunction(()=>document.getElementById('storageStatus').textContent.includes('Saved on'));
  assert.equal(await waiting.evaluate(async()=>{state.profile.name='Recovered';return save('profile');}),true);
  await blockedContext.close();
  // Installing an update cannot reload an existing page or erase its unfinished form.
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(()=>{goToScreen('growth');openNoteModal();});await page.fill('#noteTitle','Draft survives update');
  server.workerOverride=(await readFile(resolve(root,'sw.js'),'utf8')).replace(/const VERSION=.*?;/,'const VERSION="test-next-version";');
  await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(await page.inputValue('#noteTitle'),'Draft survives update');
  await page.waitForFunction(()=>document.getElementById('offlineStatus').textContent.includes('update is ready'));
  await page.evaluate(()=>closeModal());
  const expected=await page.evaluate(async()=>(await createLocalBackup()).collections);
  await page.close();
  const reopened=await context.newPage();await open(reopened,origin);
  await reopened.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).waiting);
  await reopened.waitForFunction(async()=>(await caches.keys()).some(key=>key.endsWith('test-next-version')));
  assert.deepEqual(await reopened.evaluate(async()=>(await createLocalBackup()).collections),expected);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
