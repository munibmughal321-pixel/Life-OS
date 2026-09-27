import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep,extname} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {chromium} from '@playwright/test';
import {repository} from '../backend/repository.js';
const fixtures=JSON.parse(await readFile('.phase3-test-accounts.json','utf8'));
const env=await readFile('.env.local','utf8');
const url=env.match(/^VITE_SUPABASE_URL=(.+)$/m)[1].trim(),key=env.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)[1].trim();
const make=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const [a,b]=fixtures,ca=make(),cb=make(),anon=make();
let count=0;
const ok=(condition,message)=>{assert.ok(condition,message);count++;};
for(const [client,fixture] of [[ca,a],[cb,b]]){
 const login=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});
 ok(!login.error,'Fixture login works');
}
const ra=repository(ca),rb=repository(cb);
const pa=await ra.saveProfile({display_name:'Alpha',timezone:'Asia/Karachi',currency:'PKR'});
const pb=await rb.saveProfile({display_name:'Beta',timezone:'Asia/Karachi',currency:'PKR'});
ok(pa.user_id===a.id && pb.user_id===b.id,'Each account owns its profile');
const row=await ra.create('notes','phase3-test',{title:'Private test',content:'Fixture only'});
ok(row.revision===1,'Initial revision');
ok((await rb.list('notes')).length===0,'B cannot read A records');
ok((await anon.from('records').select('*')).error,'Anonymous reads denied');
ok((await anon.from('profiles').select('*')).error,'Anonymous profile reads denied');
ok((await cb.from('records').insert({user_id:a.id,collection:'notes',record_key:'spoof',payload:{}})).error,'Spoofed record owner denied');
ok((await cb.from('profiles').update({display_name:'stolen'}).eq('user_id',a.id).select()).data?.length===0,'Cross-account profile update denied');
ok((await cb.from('records').update({payload:{title:'stolen'}}).eq('user_id',a.id).select()).data?.length===0,'Cross-account record update denied');
ok((await cb.from('records').delete().eq('user_id',a.id).select()).data?.length===0,'Cross-account delete denied');
ok((await ca.from('records').update({user_id:b.id}).eq('record_key','phase3-test')).error,'Ownership reassignment denied');
ok((await ca.from('records').insert({collection:'unknown',record_key:'bad',payload:{}})).error,'Unknown collection denied');
ok((await ca.from('records').insert({collection:'notes',record_key:'bad',payload:[]})).error,'Array payload denied');
const edited=await ra.update('notes','phase3-test',{title:'Edited'},1);
ok(edited.revision===2,'Update increments revision');
await assert.rejects(ra.update('notes','phase3-test',{title:'Stale'},1));count++;
const exported=await ra.export();ok(exported.records.length===1&&exported.profile.user_id===a.id,'Export contains only own cloud data');
const root=resolve('dist');
const server=createServer(async(req,res)=>{
 try{
  const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith(root+sep))throw Error();
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)]||'application/octet-stream');
  res.end(await readFile(path));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/login.html');
 await page.fill('#email',a.email);await page.fill('#password',a.password);
 await page.click('button[type=submit]');await page.waitForURL('**/account.html');
 await page.waitForSelector('#profileForm:not([hidden])');
 ok(await page.inputValue('#displayName')==='Alpha','Actual login UI loads private profile');
 await page.fill('#displayName','Browser Alpha');await page.click('#profileForm button');
 await page.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Cloud profile saved.');
 await page.reload();await page.waitForSelector('#profileForm:not([hidden])');
 ok(await page.inputValue('#displayName')==='Browser Alpha','Cloud profile persists after reload');
 for(const width of [320,1366]){
  await page.setViewportSize({width,height:900});
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Account page fits viewport');
 }
 await page.click('#logout');await page.waitForSelector('#loginLink:not([hidden])');
 ok(await page.locator('#profileForm').isHidden(),'Logout clears private UI');
 await page.goto(base+'/reset-password.html');
 ok(await page.locator('button[type=submit]').isDisabled(),'Missing recovery link cannot update password');
 ok(errors.length===0,'No browser JavaScript errors');
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
const notSignedIn=await anon.functions.invoke('delete-account',{body:{confirmation:'DELETE'}});
ok(notSignedIn.error,'Unauthenticated account deletion denied');
// Browser global logout revoked the first client's session; reauthenticate before deletion.
await ca.auth.signInWithPassword({email:a.email,password:a.password});
const wrongConfirmation=await ca.functions.invoke('delete-account',{body:{confirmation:'no'}});
ok(wrongConfirmation.error,'Deletion requires confirmation');
for(const client of [ca,cb]){
 const removed=await client.functions.invoke('delete-account',{body:{confirmation:'DELETE'}});
 if(removed.error){console.error('Deletion endpoint status:',removed.error.context?.status);throw Error('Account deletion failed; fixtures require cleanup');}
 count++;
}
ok((await ca.from('records').select('*')).data?.length===0,'Old token cannot read deleted account data');
console.log('PASS: '+count+' live auth, RLS, cloud CRUD, revision, export, browser and deletion checks.');
