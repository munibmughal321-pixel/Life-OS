import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from '@playwright/test';
test('two browser devices: opt-in, offline retry, conflicts, tombstones, account isolation and interrupted local commit',{timeout:120000},async()=>{
 const root=resolve('dist'),rows=new Map(),calls=[];
 const server=createServer(async(req,res)=>{
  try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+sep))throw Error();
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(file)]||'application/octet-stream');
   res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 const user=id=>({id,email:id===a?'alpha@example.invalid':'beta@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()});
 const token=id=>Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';
 const session=id=>({access_token:token(id),refresh_token:'fake-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:user(id)});
 const env=await readFile('.env.local','utf8'),project=new URL(env.match(/^VITE_SUPABASE_URL=(.+)$/m)[1].trim()).hostname.split('.')[0],storageKey='sb-'+project+'-auth-token';
 async function context(id){
  const ctx=await browser.newContext({serviceWorkers:'allow'});
  if(id)await ctx.addInitScript(({key,value})=>{if(!localStorage.getItem('seeded')){localStorage.setItem(key,JSON.stringify(value));localStorage.setItem('seeded','1');}},{key:storageKey,value:session(id)});
  await ctx.route('https://*.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   const bearer=request.headers().authorization?.split(' ')[1];
   let owner;try{owner=JSON.parse(Buffer.from(bearer.split('.')[1],'base64url').toString()).sub;}catch{}
   if(url.pathname.endsWith('/user'))return route.fulfill({json:user(owner)});
   if(url.pathname.endsWith('/logout'))return route.fulfill({json:{}});
   if(!url.pathname.endsWith('/records'))return route.fulfill({json:[]});
   calls.push({method:request.method(),owner});
   const params=url.searchParams;
   if(request.method()==='GET'){
    let data=[...rows.values()].filter(r=>r.user_id===owner);
    for(const field of ['user_id','collection','record_key','revision']){
     const filter=params.get(field);if(filter?.startsWith('eq.'))data=data.filter(r=>String(r[field])===filter.slice(3));
     if(filter?.startsWith('gt.'))data=data.filter(r=>r[field]>filter.slice(3));
    }
    data.sort((a,b)=>a.record_key.localeCompare(b.record_key));return route.fulfill({json:data.slice(0,Number(params.get('limit')||500))});
   }
   const body=request.postDataJSON();
   if(request.method()==='POST'){
    if(body.user_id!==owner)return route.fulfill({status:403,json:{message:'owner denied'}});
    const key=owner+'/'+body.collection+'/'+body.record_key;
    if(rows.has(key))return route.fulfill({status:409,json:{message:'duplicate'}});
    const row={...body,revision:1,deleted_at:null};rows.set(key,row);return route.fulfill({json:row});
   }
   if(request.method()==='PATCH'){
    const key=owner+'/'+params.get('collection').slice(3)+'/'+params.get('record_key').slice(3),old=rows.get(key);
    if(!old||old.revision!==Number(params.get('revision').slice(3)))return route.fulfill({json:null});
    const row={...old,...body,revision:old.revision+1};rows.set(key,row);return route.fulfill({json:row});
   }
   return route.fulfill({status:400,json:{message:'unsupported'}});
  });return ctx;
 }
 const open=async page=>{await page.goto(base+'/dashboard.html');await page.waitForFunction(()=>document.getElementById('screenTitle').textContent==='Overview'&&document.getElementById('syncStatus').textContent.includes('Saved locally'));};
 const enable=async page=>{page.once('dialog',d=>d.accept());await page.click('#syncEnable');await page.waitForFunction(()=>document.getElementById('syncStatus').textContent.startsWith('Synced'),{},{timeout:15000}).catch(async error=>{throw Error(error.message+' Sync status: '+await page.locator('#syncStatus').textContent()+' Control: '+await page.locator('#syncEnable').textContent());});};
 const sync=async page=>{await page.click('#syncNow');await page.waitForFunction(()=>/^(Synced|Sync paused|Sync failed)/.test(document.getElementById('syncStatus').textContent));};
 try{
  const c1=await context(a),c2=await context(a),cg=await context(),p1=await c1.newPage(),p2=await c2.newPage(),pg=await cg.newPage();
  await open(pg);await pg.evaluate(async()=>{state.notes=[{id:'guest',title:'Device only',date:'2026-09-17'}];return await save('notes');});
  await pg.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:session(a)});
  await pg.reload();await pg.waitForFunction(()=>window.LifeOSCloud?.owner);
  assert.equal(await pg.evaluate(()=>state.notes.length),0,'guest history never associates automatically');
  await open(p1);await open(p2);
  assert.equal(calls.length,0,'sign-in alone makes no tracker cloud calls');
  await p1.evaluate(async()=>{state.notes=[{id:'n',title:'original',date:'2026-09-17'}];await save('notes');});
  await enable(p1);assert.equal(rows.get(a+'/notes/n').payload.title,'original');
  await enable(p2);await p2.reload();await p2.waitForFunction(()=>state.notes[0]?.title==='original');
  await p1.waitForFunction(()=>document.getElementById('offlineStatus').textContent.includes('Ready for offline use'));
  await c1.setOffline(true);
  await p1.evaluate(async()=>{state.notes[0].title='offline edit';await save('notes');});
  assert.equal(await p1.evaluate(async()=>(await createLocalBackup()).collections.notes[0].title),'offline edit');
  // Cached shell and remembered account allow offline reopening even after token expiry.
  await p1.evaluate(key=>{const session=JSON.parse(localStorage.getItem(key));session.expires_at=1;localStorage.setItem(key,JSON.stringify(session));},storageKey);
  await p1.reload();await p1.waitForFunction(()=>state.notes[0]?.title==='offline edit');
  assert.equal(await p1.evaluate(()=>window.LifeOSCloud.databaseName),'lifeos-account-'+a);
  // A browser can report online while Auth refresh is expired or unreachable.
  // The account cache must still open while cloud authorization stays paused.
  await c1.setOffline(false);await p1.reload();await p1.waitForFunction(()=>state.notes[0]?.title==='offline edit');
  assert.equal(await p1.evaluate(()=>window.LifeOSCloud.databaseName),'lifeos-account-'+a);
  assert.equal(await p1.evaluate(()=>!window.LifeOSCloud.locked&&!document.getElementById('root').hidden),true);
  await p1.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:session(a)});
  await p1.goto(base+'/dashboard.html');await p1.waitForFunction(()=>state.notes[0]?.title==='offline edit');
  await p1.waitForFunction(()=>document.getElementById('syncStatus').textContent.startsWith('Synced'));
  assert.equal(rows.get(a+'/notes/n').payload.title,'offline edit');
  await sync(p2);await p2.reload();await p2.waitForFunction(()=>state.notes[0]?.title==='offline edit');
  // Pause both devices before making competing changes.
  await p1.click('#syncEnable');await p2.click('#syncEnable');
  await p1.evaluate(async()=>{state.notes[0].title='device one';await save('notes');});
  await p2.evaluate(async()=>{state.notes[0].title='device two';await save('notes');});
  await enable(p1);
  p2.once('dialog',d=>d.accept());await p2.click('#syncEnable');
  await p2.waitForFunction(()=>document.getElementById('syncStatus').textContent.includes('conflicting')).catch(async error=>{throw Error(error.message+' Status: '+await p2.locator('#syncStatus').textContent()+' / '+await p2.locator('#storageStatus').textContent());});
  assert.equal(await p2.locator('#syncConflicts details').count(),1);
  await p2.locator('#syncConflicts summary').click();
  await p2.getByRole('button',{name:'Keep local',exact:true}).click();await sync(p2);
  assert.equal(rows.get(a+'/notes/n').payload.title,'device two');
  await p2.evaluate(async()=>{state.notes=[];await save('notes');});await sync(p2);
  assert.ok(rows.get(a+'/notes/n').deleted_at);
  await sync(p1);await p1.reload();await p1.waitForFunction(()=>state.notes.length===0);
  await p1.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:session(b)});
  await p1.reload();await p1.waitForFunction(()=>window.LifeOSCloud?.owner==='00000000-0000-4000-8000-000000000002');
  assert.equal(await p1.evaluate(()=>state.notes.length),0);
  assert.equal(await p1.evaluate(()=>window.LifeOSCloud.databaseName),'lifeos-account-'+b);
  // The local adapter refuses a stale sync commit after a newer local edit.
  await p1.evaluate(async()=>{const before=await LocalWorkspace.read();await LocalWorkspace.commit(before,null,{...before.meta,enabled:true});});
  await p1.click('#syncEnable');
  await p1.waitForFunction(()=>document.getElementById('syncEnable').textContent==='Pause sync');
  assert.equal(await p1.evaluate(async()=>(await LocalWorkspace.read()).meta.enabled),true,'a stale enable control must not pause another tab\'s preference');
  await p1.click('#syncEnable');
  assert.equal(await p1.locator('#syncNow').isDisabled(),true);
  assert.equal(await p1.evaluate(async()=>{
   const before=await LocalWorkspace.read();
   state.notes=[{id:'b-note',title:'Newest local edit',date:'2026-09-17'}];await save('notes');
   try{await LocalWorkspace.commit(before,before.collections,before.meta);return false;}catch{return state.notes[0].title==='Newest local edit';}
  }),true);
  await p1.setViewportSize({width:390,height:844});await p1.screenshot({path:'tests/visual-phase4-sync.png',fullPage:false});
  assert.equal(await p1.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p1.goto(base+'/account.html');await p1.waitForFunction(()=>!document.getElementById('accountActions').hidden);
  await p1.getByText('Delete cloud account',{exact:true}).first().click();
  await p1.fill('#deleteConfirm','DELETE');await p1.click('#deleteAccount');
  await p1.waitForFunction(()=>document.getElementById('accountStatus').textContent.includes('backup'));
  assert.equal(await p1.evaluate(key=>!!localStorage.getItem(key),storageKey),true);
  // Actual routed sign-out hides account data, but retains unsynced records for re-entry.
  await p1.goto(base+'/account.html?action=logout');await p1.waitForURL('**/login.html?reason=logout');
  await p1.goto(base+'/dashboard.html');await p1.waitForFunction(()=>document.getElementById('workspaceIdentity').textContent==='Device-only workspace');
  assert.equal(await p1.evaluate(()=>state.notes.length),0);
  await p1.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:session(b)});
  await p1.reload();await p1.waitForFunction(()=>state.notes[0]?.title==='Newest local edit');
  const sibling=await c1.newPage();await sibling.goto(base+'/account.html?action=logout');await sibling.waitForURL('**/login.html?reason=logout');
  await p1.waitForFunction(()=>window.LifeOSCloud.locked&&document.getElementById('root').hidden);

 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
