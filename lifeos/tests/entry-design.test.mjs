import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from '@playwright/test';
test('reference landing structure, walkthrough, links and account layouts',async()=>{
 const root=resolve('dist');
 const server=createServer(async(req,res)=>{
  try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+sep))throw Error();
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(p)] || 'application/octet-stream');res.end(await readFile(p));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('https://*.supabase.co/**',route=>route.abort());
  const page=await context.newPage(),errors=[],base='http://127.0.0.1:'+server.address().port;
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,768,1366]){
   await page.setViewportSize({width,height:900});
   for(const route of ['index','login','signup']){
    await page.goto(base+'/'+route+'.html');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow '+width);
    if(route==='index'){
     for(let i=0;i<3;i++){await page.locator('[data-step="'+i+'"]').click();assert.equal(await page.locator('[data-step="'+i+'"]').getAttribute('aria-pressed'),'true');}
     await page.locator('.faq-list summary').first().click();
     assert.equal(await page.locator('.faq-list details').first().getAttribute('open'),'');
     const bad=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.querySelector(a.getAttribute('href'))).length);
     assert.equal(bad,0);
    }else{
     await page.fill('#password','SamplePassword123!');
     await page.locator('[data-reveal="password"]').click();assert.equal(await page.locator('#password').getAttribute('type'),'text');
     if(route==='signup'){await page.fill('#confirmPassword','different');assert.equal(await page.locator('#confirmPassword').evaluate(e=>e.validity.valid),false);}
    }
    if(width===390 || width===1366){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'tests/visual-entry-'+width+'-'+route+'.png',fullPage:true});}
   }
  }
  await page.goto(base+'/index.html');await page.getByRole('link',{name:'Create your LifeOS',exact:false}).first().click();await page.waitForURL('**/signup.html');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
