import {collections as fixtures} from './fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '@playwright/test';
const root=resolve('dist');
test('local persistence, activity editing, linked goals and responsive navigation',async()=>{
 const server=createServer(async(req,res)=>{
  try{
   const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
   if(!path.startsWith(root))throw Error();
   const body=await readFile(path);
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)] || 'application/octet-stream');
   res.end(body);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const origin='http://127.0.0.1:'+server.address().port;
 const errors=[];
 try{
  const context=await browser.newContext({timezoneId:'Asia/Karachi'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  const open=async p=>{await p.goto(origin+'/dashboard.html');await p.waitForFunction(()=>document.getElementById('storageStatus').textContent.includes('Saved on'));};
  await open(page);
  // Create a goal through the actual UI, then link a historical session.
  await page.evaluate(()=>{goToScreen('growth');openGoalModal();});
  await page.fill('#goalName','Study ten hours');
  await page.fill('#goalUnit','hours');
  await page.fill('#goalTarget','10');
  await page.selectOption('#goalSessionProgress','hours');
  await page.click('#saveGoalButton');
  await page.waitForFunction(()=>state.goals.length===1 && !document.getElementById('modalBackdrop').classList.contains('open'));
  const goal=await page.evaluate(()=>state.goals[0].id);
  await page.evaluate(()=>{goToScreen('activities');openActivityEditor();});
  await page.selectOption('#sessionGoal',goal);
  await page.click('#activityEditor button[type=submit]');
  await page.waitForFunction(()=>state.logs.length===1);
  assert.equal(await page.evaluate(()=>goalCurrentValue(state.goals[0])),1);
  await page.reload();await page.waitForFunction(()=>state.logs.length===1 && state.goals.length===1);
  const id=await page.evaluate(()=>state.logs[0].id);
  await page.evaluate(id=>{goToScreen('activities');openActivityEditor(id);},id);
  await page.evaluate(()=>document.getElementById('editStart').value=localDateTime(new Date(Date.parse(state.logs[0].startISO)+1800000)));
  await page.click('#activityEditor button[type=submit]');
  await page.waitForFunction(()=>goalCurrentValue(state.goals[0])===.5);
  await page.evaluate(()=>openActivityEditor());
  await page.click('#activityEditor button[type=submit]');
  await page.waitForFunction(()=>document.getElementById('activityEditError').textContent.includes('overlaps'));
  await page.keyboard.press('Escape');
  // Every registered collection persists its full shape, supports edits/deletes.
  const results=await page.evaluate(async fixtures=>{
   const keys=STORAGE_KEYS.filter(k=>k!=='logs' && k!=='goals');
   for(const key of keys){
    state[key]=structuredClone(fixtures[key]);
    if(!await save(key))throw Error('create '+key);
    if(Array.isArray(state[key]))state[key]=[];
    else state[key]=structuredClone(initialValues[key]);
    if(!await save(key))throw Error('edit '+key);
    const r=await readCollection(key);
    if(JSON.stringify(r.value)!==JSON.stringify(state[key]))throw Error('read '+key);
   }
   return keys.length;
  },fixtures);
  assert.equal(results,17);
  // Reload shapes that existing renderers understand.
  await page.evaluate(async()=>{
   for(const key of STORAGE_KEYS.filter(k=>!['logs','goals'].includes(k))){state[key]=structuredClone(initialValues[key]);if(!await save(key))throw Error('delete '+key);}
  });
  await page.reload();await page.waitForFunction(()=>state.logs.length===1);
  // Cross-tab stale edits are refused without overwriting the first tab.
  const second=await context.newPage();await open(second);
  assert.equal(await page.evaluate(async()=>{state.profile.name='First tab';return save('profile');}),true);
  assert.equal(await second.evaluate(async()=>{state.profile.name='Stale tab';return save('profile');}),false);
  assert.equal(await page.evaluate(async()=>(await readCollection('profile')).value.name),'First tab');
  await second.close();
  // One active session, extension, exact auto-end timestamp, review skip.
  await page.evaluate(()=>startActivity('Work'));
  await page.click('#sessionSetup button[type=submit]');
  await page.waitForFunction(()=>!!activeLog());
  assert.equal(await page.evaluate(async()=>{const l=activeLog(),end=Date.parse(l.plannedEndISO);await extendSession(l.id);return Date.parse(activeLog().plannedEndISO)-end;}),600000);
  const planned=await page.evaluate(async()=>{
   const end=new Date(Date.now()-1000).toISOString();
   await sessionTransaction(records=>{const l=records.find(l=>!l.endISO);l.startISO=new Date(Date.now()-60000).toISOString();l.plannedEndISO=end;});
   await tickSessions();return end;
  });
  assert.equal(await page.evaluate(()=>state.logs.at(-1).endISO),planned);
  await page.evaluate(()=>openSessionReview(state.logs.at(-1).id));
  await page.click('#skipSessionReview');
  await page.waitForFunction(()=>state.logs.at(-1).reviewSkipped);
  // Storage failures preserve the goal draft and persisted data.
  await page.evaluate(()=>{goToScreen('growth');openGoalModal();window.realOpen=openLocalDatabase;openLocalDatabase=()=>Promise.reject(Error('blocked'));});
  await page.fill('#goalName','Must not save');
  await page.fill('#goalUnit','books');await page.fill('#goalTarget','3');
  await page.click('#saveGoalButton');
  await page.waitForFunction(()=>storageError.includes('Not saved'));
  assert.equal(await page.inputValue('#goalName'),'Must not save');
  assert.equal(await page.evaluate(()=>state.goals.length),1);
  await page.evaluate(()=>{openLocalDatabase=window.realOpen;closeModal();});
  // All modules and dialogs fit the supported widths; Escape returns focus.
  for(const width of [320,390,768,1366]){
   await page.setViewportSize({width,height:900});
   for(const screen of ['dashboard','activities','growth','finance','deen','me']){
    await page.evaluate(screen=>goToScreen(screen),screen);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),screen+' overflow '+width);
   }
   await page.evaluate(()=>openActivityEditor());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.keyboard.press('Escape');
  }
  await page.reload();await page.waitForFunction(()=>state.goals.length===1);
  for(const width of [390,1366]){
   await page.setViewportSize({width,height:900});
   for(const screen of ['dashboard','activities','growth','finance','deen','me']){
    await page.evaluate(screen=>goToScreen(screen),screen);
    await page.screenshot({path:'tests/visual-'+width+'-'+screen+'.png'});
   }
  }
  for(const route of ['index','welcome','login','signup','forgot-password','reset-password']){
   await page.goto(origin+'/'+route+'.html');
   for(const width of [320,390,768,1366]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow '+width);}
  }
  // Fresh browser context migrates legacy sessions without removing the source.
  const legacy=await browser.newContext();const lp=await legacy.newPage();
  await lp.goto(origin+'/dashboard.html');
  await lp.evaluate(()=>localStorage.setItem('lifeos.sessions.v1',JSON.stringify({version:1,logs:[{id:'legacy1',activity:'Sleep',startISO:'2026-09-12T18:00:00Z',endISO:'2026-09-13T02:00:00Z'}]})));
  await lp.reload();await lp.waitForFunction(()=>state.logs.some(l=>l.id==='legacy1'));
  assert.equal(await lp.evaluate(async()=>(await readCollection('logs')).value[0].id),'legacy1');
  assert.ok(await lp.evaluate(()=>localStorage.getItem('lifeos.sessions.v1')));
  const overnight=await lp.evaluate(()=>{
   state.logs=[{id:'night',activity:'Sleep',startISO:'2026-09-13T23:00:00',endISO:'2026-09-14T07:00:00'}];
   return activityDaySummary(new Date('2026-09-14T08:00:00').getTime()).tracked;
  });
  assert.equal(overnight,7*3600000);
  const corrupt=await browser.newContext();const cp=await corrupt.newPage();await open(cp);
  await cp.evaluate(async()=>{const db=await openLocalDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('collections','readwrite');tx.objectStore('collections').put({version:99,revision:1,value:[]},'notes');tx.oncomplete=resolve;tx.onabort=reject;});});
  await cp.reload();await cp.waitForFunction(()=>blockedCollections.has('notes'));
  assert.equal(await cp.evaluate(async()=>{state.notes=[{id:'unsafe',title:'new'}];return save('notes');}),false);
  assert.equal(await cp.evaluate(async()=>(await readCollection('notes')).version),99);
  // Growth library workflows use the same isolated database and real forms.
  const growthContext=await browser.newContext();const gp=await growthContext.newPage();
  gp.on('pageerror',e=>errors.push(e.message));await open(gp);
  const submit=async()=>{await gp.click('#libraryForm button[type=submit]');await gp.waitForFunction(()=>!document.getElementById('modalBackdrop').classList.contains('open'));};
  await gp.evaluate(()=>{goToScreen('growth');setGrowthSub('education');});
  assert.equal(await gp.locator('.library-academic').count(),0);
  await gp.locator('.library-settings summary').click();
  await gp.check('#learningPath3');await gp.check('#academicTools');
  await gp.getByRole('button',{name:'Save preferences',exact:true}).click();
  await gp.waitForSelector('.library-academic');
  await gp.evaluate(()=>openEducationModal());
  assert.equal(await gp.inputValue('#eduType'),'Book');
  await gp.fill('#eduName','Learn cooking');
  await gp.selectOption('#eduStatus','In Progress');
  await gp.locator('#libraryForm details summary').click();
  await gp.fill('#eduTotal','8');await gp.fill('#eduCompleted','2');
  await submit();
  await gp.reload();await gp.waitForFunction(()=>state.education.length===1);
  assert.equal(await gp.evaluate(()=>state.education[0].completed),2);
  assert.equal(await gp.evaluate(()=>state.profile.academicTools),true);
  await gp.evaluate(()=>{goToScreen('growth');setGrowthSub('skills');openSkillModal();});
  await gp.getByRole('button',{name:'Cooking',exact:true}).click();
  await gp.fill('#skMilestone','Cook three meals independently');
  await submit();
  const skillId=await gp.evaluate(()=>state.skills[0].id);
  await gp.evaluate(id=>openSkillPractice(id),skillId);
  await gp.fill('#practiceMinutes','20');await gp.fill('#practiceNote','Practised chopping vegetables');
  await submit();
  assert.equal(await gp.evaluate(()=>state.skills[0].practice[0].minutes),20);
  // Legacy XP and projects survive editing, with no forced conversion to level.
  await gp.evaluate(async()=>{state.skills.push({id:'oldskill',name:'HTML',xp:750,projects:2,notes:'Keep me'});await save('skills');openSkillModal('oldskill');});
  await gp.fill('#skMilestone','Build an accessible form');await submit();
  assert.equal(await gp.evaluate(()=>state.skills.find(s=>s.id==='oldskill').xp),750);
  await gp.evaluate(()=>{setGrowthSub('vault');openNoteModal();});
  await gp.selectOption('#noteTemplate','Book takeaways');
  assert.ok((await gp.inputValue('#noteContent')).includes('Main takeaway'));
  await gp.fill('#noteTitle','Cooking checklist');
  await gp.selectOption('#noteKind','Checklist');
  await gp.fill('#noteChecklist','Buy ingredients\nPrepare meal');
  await gp.locator('[data-note-task]').first().check();
  await gp.fill('#noteTags','cooking, practice, cooking');
  await gp.selectOption('#noteRelated','skills:'+skillId);
  await gp.locator('.library-details summary').click();await gp.check('#notePinned');
  await submit();
  assert.equal(await gp.evaluate(()=>state.notes[0].checklist[0].done),true);
  assert.equal(await gp.evaluate(()=>state.notes[0].tags.length),2);
  await gp.fill('#librarySearch','practice');
  assert.equal(await gp.locator('.library-card').count(),1);
  await gp.fill('#librarySearch','not-present');
  assert.equal(await gp.locator('.library-card').count(),0);
  await gp.fill('#librarySearch','');
  await gp.getByRole('button',{name:'Open entry',exact:true}).click();
  await gp.locator('.library-details summary').click();await gp.check('#noteArchived');await submit();
  assert.equal(await gp.locator('.library-card').count(),0);
  await gp.selectOption('#vaultView','archived');
  assert.equal(await gp.locator('.library-card').count(),1);
  await gp.reload();await gp.waitForFunction(()=>state.notes.length===1);
  assert.equal(await gp.evaluate(()=>state.notes[0].archived),true);
  // Retain original academic types and notes during editing.
  await gp.evaluate(async()=>{state.education.push({id:'legacyedu',name:'Final project',type:'FYP',status:'Pending',notes:'Old record'});await save('education');openEducationModal('legacyedu');});
  assert.equal(await gp.inputValue('#eduType'),'FYP');await submit();
  assert.equal(await gp.evaluate(()=>state.education.find(e=>e.id==='legacyedu').notes),'Old record');
  // Failed writes retain the user's draft.
  await gp.evaluate(()=>{openNoteModal();window.originalDb=openLocalDatabase;openLocalDatabase=()=>Promise.reject(Error('denied'));});
  await gp.fill('#noteTitle','Unsaved draft');
  await gp.click('#libraryForm button[type=submit]');
  await gp.waitForFunction(()=>document.getElementById('libraryError').textContent.length>0);
  assert.equal(await gp.inputValue('#noteTitle'),'Unsaved draft');
  await gp.evaluate(()=>{openLocalDatabase=window.originalDb;closeModal();});
  await gp.reload();await gp.waitForFunction(()=>state.skills.length===2);
  for(const width of [320,390,768,1366]){
   await gp.setViewportSize({width,height:900});
   for(const section of ['education','skills','vault']){
    await gp.evaluate(section=>{goToScreen('growth');setGrowthSub(section);},section);
    assert.ok(await gp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),section+' overflow '+width);
    if(width===390 || width===1366)await gp.screenshot({path:'tests/visual-library-'+width+'-'+section+'.png',fullPage:true});
    await gp.evaluate(section=>section==='education'?openEducationModal():section==='skills'?openSkillModal():openNoteModal(),section);
    assert.ok(await gp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'dialog '+section);
    await gp.keyboard.press('Escape');
   }
  }

  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
