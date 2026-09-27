import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from '@playwright/test';
test('account forms, email verification, offline errors, and PKCE recovery with mocked email transport',{timeout:90000},async()=>{
 const root=resolve('dist');
 const server=createServer(async(req,res)=>{
  try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+sep))throw Error();
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(p)]||'application/octet-stream');res.end(await readFile(p));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),base='http://127.0.0.1:'+server.address().port;
  const calls=[],user={id:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{display_name:'Test'},created_at:new Date().toISOString()};
  const payload={sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600};
  const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.test-signature';
  let updated=false,allowLogin=false,failLogout=false,signupRateLimited=false;const logoutScopes=[];let profile=null,failProfile=false;
  await context.route('https://*.supabase.co/**',async route=>{
   const request=route.request(),u=new URL(request.url());calls.push(u.pathname);
   const errorHeaders={'x-supabase-api-version':'2024-01-01','access-control-expose-headers':'x-supabase-api-version'};
   if(u.pathname.endsWith('/signup'))return signupRateLimited?route.fulfill({status:429,headers:errorHeaders,json:{code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'}}):route.fulfill({json:{user,session:null}});
   if(u.pathname.endsWith('/resend'))return route.fulfill({status:429,headers:errorHeaders,json:{code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'}});
   if(u.pathname.endsWith('/recover'))return route.fulfill({json:{}});
   if(u.pathname.endsWith('/token')&&u.searchParams.get('grant_type')==='pkce')return route.fulfill({json:{access_token:jwt,refresh_token:'mock-only',token_type:'bearer',expires_in:3600,user}});
   if(u.pathname.endsWith('/token')&&allowLogin)return route.fulfill({json:{access_token:jwt,refresh_token:'mock-only',token_type:'bearer',expires_in:3600,user}});
   if(u.pathname.endsWith('/verify')){
 const body=request.postDataJSON();assert.equal(body.type,'email');assert.equal(body.email,user.email);
 if(body.token!=='123456')return route.fulfill({status:403,headers:errorHeaders,json:{code:'otp_expired',msg:'Invalid code'}});
 user.email_confirmed_at=new Date().toISOString();
 return route.fulfill({json:{access_token:jwt,refresh_token:'mock-only',token_type:'bearer',expires_in:3600,user}});
}
if(u.pathname.endsWith('/profiles')){
 if(request.method()!=='GET'){
 if(failProfile)return route.fulfill({status:500,json:{message:'Profile save failed'}});
 profile={...request.postDataJSON(),revision:1};
 }
 return route.fulfill({json:profile||[]});
}
   if(u.pathname.endsWith('/token'))return route.fulfill({status:400,json:{code:'invalid_credentials',msg:'Invalid login credentials'}});
   if(u.pathname.endsWith('/user')){if(request.method()==='PUT')updated=true;return route.fulfill({json:user});}
   if(u.pathname.endsWith('/logout')){logoutScopes.push(u.searchParams.get('scope'));return failLogout?route.fulfill({status:500,json:{msg:'Test logout failed'}}):route.fulfill({status:204,body:''});}
   return route.fulfill({status:400,json:{msg:'Unexpected test endpoint'}});
  });
  await page.goto(base+'/signup.html');
  await page.fill('#displayName','Test');await page.fill('#email',user.email);
  await page.fill('#password','TestPassword123!');await page.fill('#confirmPassword','different');
  await page.click('button[type=submit]');assert.equal(calls.length,0,'Mismatched passwords never reach auth');
  await page.fill('#confirmPassword','TestPassword123!');await page.click('button[type=submit]');
  await page.waitForURL('**/verify-email.html');
  assert.equal(await page.locator('h1').textContent(),'Enter your email code.');
  assert.equal(await page.locator('#resendEmail').isDisabled(),true,'resends have a cooldown');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // No session means no account enumeration or password polling while waiting.
  const userCalls=calls.filter(path=>path.endsWith('/user')).length;
  await page.click('#checkVerification');
  assert.equal(calls.filter(path=>path.endsWith('/user')).length,userCalls);
  await page.fill('#emailCode','000000');await page.click('#verifyCode');
 await page.waitForFunction(()=>document.getElementById('verificationStatus').textContent.includes('invalid, expired'));
 assert.ok(page.url().endsWith('verify-email.html'));
 await page.fill('#emailCode','123456');await page.click('#verifyCode');await page.waitForURL('**/dashboard.html');
 await page.waitForFunction(()=>document.getElementById('greetName').textContent.includes('Test'));
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('lifeos-pending-verification')),null);
 await page.goto(base+'/account.html');await page.waitForSelector('#profileForm');
 assert.equal(await page.locator('#retryAccountAction').isVisible(),false);
 await page.fill('#displayName','Saved Name');
 failProfile=true;await page.locator('#profileForm button').click();
 await page.waitForFunction(()=>document.getElementById('accountStatus').textContent.includes('Profile save failed'));
 assert.ok(page.url().endsWith('account.html'));
 failProfile=false;await page.locator('#profileForm button').click();await page.waitForURL('**/dashboard.html');
 await page.waitForFunction(()=>document.getElementById('greetName').textContent.includes('Saved Name'));
 await page.reload();await page.waitForFunction(()=>document.getElementById('greetName').textContent.includes('Saved Name'));
  await page.goto(base+'/account.html?action=logout');await page.waitForURL('**/login.html?reason=logout');
  // A blocked email is routed to the same page without claiming delivery.
  signupRateLimited=true;
  await page.goto(base+'/signup.html');await page.fill('#displayName','Test');await page.fill('#email',user.email);
  await page.fill('#password','TestPassword123!');await page.fill('#confirmPassword','TestPassword123!');await page.click('button[type=submit]');
  await page.waitForURL('**/verify-email.html',{timeout:10000}).catch(async error=>{throw Error(error.message+' Status: '+await page.locator('#formStatus').textContent());});
  assert.match(await page.locator('#verificationStatus').textContent(),/sending limit/);
  await page.evaluate(()=>{const key='lifeos-pending-verification',pending=JSON.parse(sessionStorage.getItem(key));pending.createdAt=Date.now()-61000;sessionStorage.setItem(key,JSON.stringify(pending));});
  await page.reload();await page.click('#resendEmail');
  await page.waitForFunction(()=>document.getElementById('verificationStatus').textContent.includes('could not be sent'));
  assert.equal(calls.filter(path=>path.endsWith('/resend')).length,1);
  assert.equal(await page.locator('#resendEmail').isDisabled(),true);
  await page.goto(base+'/login.html');await page.fill('#email',user.email);await page.fill('#password','wrong');
  await page.click('button[type=submit]');
  await page.waitForFunction(()=>document.getElementById('formStatus').textContent.includes('Invalid login credentials'));
  await context.setOffline(true);await page.click('button[type=submit]');
  await page.waitForFunction(()=>document.getElementById('formStatus').textContent.includes('offline'));
  await context.setOffline(false);
  await page.goto(base+'/forgot-password.html');await page.fill('#email',user.email);await page.click('button[type=submit]');
  await page.waitForFunction(()=>document.getElementById('formStatus').textContent.includes('eligible'));
  await page.goto(base+'/reset-password.html?code=mock-valid-code');
  await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
  await page.fill('#password','NewPassword456!');await page.fill('#confirmPassword','NewPassword456!');await page.click('button[type=submit]');
  await page.waitForFunction(()=>document.getElementById('formStatus').textContent.includes('Password updated'));
  assert.equal(updated,true);
  await page.goto(base+'/reset-password.html?error=access_denied&error_description=Expired');
  assert.equal(await page.locator('button[type=submit]').isDisabled(),true);
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/login.html');
  await page.screenshot({path:'tests/visual-phase3-login.png',fullPage:true});
  allowLogin=true;
  const login=async()=>{await page.goto(base+'/login.html');await page.fill('#email',user.email);await page.fill('#password','TestPassword123!');await page.click('button[type=submit]');await page.waitForURL('**/dashboard.html');await page.goto(base+'/account.html');await page.waitForSelector('#logout');};
  await login();
  await page.evaluate(()=>localStorage.setItem('local-record-test','preserve'));
  await page.goto(base+'/dashboard.html');
  await page.getByRole('link',{name:'Switch account',exact:true}).first().click();
  await page.waitForURL('**/login.html?reason=switch');
  assert.equal(await page.evaluate(()=>localStorage.getItem('local-record-test')),'preserve');
  assert.ok(logoutScopes.includes('local'));
  await login();failLogout=true;
  await page.goto(base+'/account.html?action=logout');
  await page.waitForFunction(()=>document.getElementById('accountStatus').textContent.includes('Test logout failed'));
  assert.ok(page.url().includes('account.html'));
  failLogout=false;await page.click('#retryAccountAction');
  await page.waitForURL('**/login.html?reason=logout');
  await page.waitForFunction(()=>document.getElementById('formStatus').textContent.includes('logged out'));
  await page.goto(base+'/dashboard.html');
  await page.waitForSelector('#greetName');
  assert.equal((await page.locator('#greetName').textContent()).includes('Saved Name'),false,'Signed-out dashboard must not show the account name');
  await page.locator('[data-screen="me"]').click();
  assert.equal(await page.getByRole('link',{name:'Log out',exact:true}).count(),2);
  await context.close();

 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
