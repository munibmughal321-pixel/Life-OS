import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {chromium} from '@playwright/test';
import {collections} from './fixtures.mjs';

test('native dashboard uses SQLite bridge for durable forms, backup, sync, account isolation, failures and phone navigation',{timeout:90000},async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE workspaces(name TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT NOT NULL)');
 const root=resolve('dist'),calls=[],secrets=new Map();let failWrite=false,exported;
 const server=createServer(async(req,res)=>{
  try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+sep))throw Error();
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:390,height:844}});
 const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*.supabase.co/**',r=>r.abort());
 await context.exposeFunction('nativeTestCall',async(plugin,method,options={})=>{
  calls.push([plugin,method]);
  if(plugin==='App'){if(method==='getLaunchUrl')return {};return {};}
  if(plugin==='LifeOSDevice'){
   if(method==='readWorkspace')return db.prepare('SELECT revision,value FROM workspaces WHERE name=?').get(options.name)||{revision:0,value:null};
   if(method==='writeWorkspace'){
    if(failWrite){failWrite=false;throw Error('Simulated disk failure');}
    db.exec('BEGIN IMMEDIATE');
    try{
     const row=db.prepare('SELECT revision FROM workspaces WHERE name=?').get(options.name);
     if((row?.revision||0)!==options.expected)throw Error('Native records changed.');
     db.prepare('INSERT OR REPLACE INTO workspaces(name,revision,value) VALUES(?,?,?)').run(options.name,options.expected+1,options.value);db.exec('COMMIT');return {};
    }catch(error){db.exec('ROLLBACK');throw error;}
   }
   if(method==='secretGet')return {value:secrets.get(options.key)||null};
   if(method==='secretSet'){secrets.set(options.key,options.value);return {};}
   if(method==='secretRemove'){secrets.delete(options.key);return {};}
   if(method==='exportFile'){exported=options;return {};}
   if(method==='listPlaces')return {places:[]};
   if(method==='placeStatus')return {enabled:false};
  }
  return {};
 });
 await context.addInitScript(()=>{
  window.androidBridge={};window.testListeners={};
  const headers=[
   {name:'App',methods:['getLaunchUrl','minimizeApp'].map(name=>({name,rtype:'promise'}))},
   {name:'Keyboard',methods:[]},
   {name:'LifeOSDevice',methods:['readWorkspace','writeWorkspace','secretGet','secretSet','secretRemove','exportFile','listPlaces','placeStatus','setPlaces','enablePlaces','disablePlaces','currentLocation'].map(name=>({name,rtype:'promise'}))}
  ];
  for(const header of headers)header.methods.push({name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'});
  window.Capacitor={PluginHeaders:headers,nativePromise:(...args)=>window.nativeTestCall(...args),nativeCallback:(plugin,method,options,callback)=>{window.testListeners[options.eventName]=callback;return 'test-listener';}};
 });
 const origin='http://127.0.0.1:'+server.address().port;
 const open=async()=>{await page.goto(origin+'/dashboard.html');await page.waitForFunction(()=>document.getElementById('screenTitle').textContent==='Overview'&&typeof window.LocalWorkspace!=='undefined'&&document.getElementById('storageStatus').textContent.includes('Saved'));};
 try{
  await open();assert.equal(await page.evaluate(()=>indexedDB.databases().then(x=>x.length)),0,'native must not open IndexedDB');
  await page.evaluate(async fixture=>{
   const backup={format:'lifeos-backup',version:1,createdAt:new Date().toISOString(),collections:fixture};
   await commitBackupImport(await prepareBackupImport(JSON.stringify(backup)));render();
  },collections);
  await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state.finance.length===1);
  assert.deepEqual(await page.evaluate(async()=>(await createLocalBackup()).collections),collections);
  await page.evaluate(async()=>{state.profile.name='Native edit';if(!await save('profile'))throw Error('save failed');});
  await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state.profile.name==='Native edit');
  failWrite=true;
  assert.equal(await page.evaluate(async()=>{state.profile.name='Unsaved';return save('profile');}),false);
  assert.equal(await page.evaluate(()=>state.profile.name),'Native edit');
  const before=await page.evaluate(()=>LocalWorkspace.read());
  await page.evaluate(async()=>{const snapshot=await LocalWorkspace.read();await LocalWorkspace.commit(snapshot,null,{...snapshot.meta,enabled:true});});
  assert.equal(await page.evaluate(async()=>(await LocalWorkspace.read()).meta.enabled),true);
  await page.evaluate(async old=>{try{await LocalWorkspace.commit(old,null,old.meta);throw Error('unexpected commit');}catch(error){if(!error.message.includes('changed'))throw error;}},before);
  await page.evaluate(()=>exportLocalBackup());assert.equal(JSON.parse(exported.value).collections.profile.name,'Native edit');
  await page.evaluate(()=>{window.LifeOSCloud.owner='11111111-1111-1111-1111-111111111111';window.LifeOSCloud.databaseName='lifeos-account-'+window.LifeOSCloud.owner;});
  assert.deepEqual(await page.evaluate(()=>readLocalSnapshot()),{});
  await page.evaluate(()=>{window.LifeOSCloud.owner=null;window.LifeOSCloud.databaseName='lifeos-local';goToScreen('growth');});
  await page.evaluate(()=>window.testListeners.backButton({canGoBack:false}));
  assert.equal(await page.locator('#screenTitle').textContent(),'Overview');
  await page.getByRole('button',{name:'Saved places',exact:true}).click();
  await page.waitForSelector('#placeForm');
  await page.evaluate(()=>window.testListeners.backButton({canGoBack:false}));
  assert.equal(await page.locator('#modalBackdrop').evaluate(el=>el.classList.contains('open')),false);
  await page.evaluate(()=>window.testListeners.backButton({canGoBack:false}));
  assert.ok(calls.some(([p,m])=>p==='App'&&m==='minimizeApp'));
  assert.equal(await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(x=>x.length)),0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}
});
