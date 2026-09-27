// Education, skills, goals, trading journal, and vault
function renderGrowth(){
  let html = `<div class="subtabs">
    <button class="subtab ${growthSub==='education'?'active':''}" onclick="setGrowthSub('education')">Learning</button>
    <button class="subtab ${growthSub==='skills'?'active':''}" onclick="setGrowthSub('skills')">Skills</button>
    <button class="subtab ${growthSub==='goals'?'active':''}" onclick="setGrowthSub('goals')">Goals</button>
    <button class="subtab ${growthSub==='trading'?'active':''}" onclick="setGrowthSub('trading')">Trading</button>
    <button class="subtab ${growthSub==='vault'?'active':''}" onclick="setGrowthSub('vault')">Vault</button>
  </div>`;
  if(growthSub==='education') html += renderEducationList();
  else if(growthSub==='skills') html += renderSkillsList();
  else if(growthSub==='goals') html += renderGoalsList();
  else if(growthSub==='trading') html += renderTradingList();
  else html += renderVaultList();
  document.getElementById('main').innerHTML = html;
}
function setGrowthSub(s){ growthSub=s; render(); }
function statusClass(s){ if(s==='Done'||s==='done') return 'done'; if(s==='In Progress'||s==='progress') return 'progress'; return 'pending'; }

/* -- Education + GPA calculator -- */
function renderAcademicTools(){
  const sem = semesterGPA();
  let html = `<div class="section-title">Semester GPA Calculator</div><div class="card">
    <div class="row-between"><span class="muted">Semester GPA</span><span style="font-size:20px;font-weight:700;font-family:'Space Grotesk',sans-serif;">${sem===null?'—':sem.toFixed(2)}</span></div>
    <div class="row-between" style="margin-top:6px;"><span class="muted">Cumulative CGPA</span><span style="font-weight:600;">${state.profile.cgpa ?? '—'}</span></div>
    <button class="btn btn-outline" style="margin-top:12px;" onclick="openCourseModal()">＋ Add Course</button>
    ${state.courses.length?`<div style="margin-top:10px;">${state.courses.map(c=>`
      <div class="item-row" onclick="openCourseModal('${c.id}')">
        <div class="item-top"><span class="item-name">${esc(c.name)}</span><span class="faint mono" style="font-size:12px;">${c.creditHours}cr · ${c.gradePoints.toFixed(1)}</span></div>
      </div>`).join('')}</div>`:''}
  </div>`;

  return html;
}
function semesterGPA(){
  if(!state.courses.length) return null;
  const totalCredits = state.courses.reduce((s,c)=>s+c.creditHours,0);
  if(!totalCredits) return null;
  const points = state.courses.reduce((s,c)=>s+c.creditHours*c.gradePoints,0);
  return points/totalCredits;
}
function openCourseModal(id){
  const c = id ? state.courses.find(x=>x.id===id) : null;
  let html = `<div class="modal-title">${c?'Edit':'Add'} Course</div>
    <div class="field"><label>Course Name</label><input id="crsName" value="${c?esc(c.name):''}" placeholder="e.g. Calculus II"></div>
    <div class="field-row">
      <div class="field"><label>Credit Hours</label><input type="number" id="crsCredit" value="${c?c.creditHours:3}"></div>
      <div class="field"><label>Grade Points (0-4)</label><input type="number" step="0.1" min="0" max="4" id="crsGrade" value="${c?c.gradePoints:''}"></div>
    </div>
    <div class="modal-actions">
      ${c?`<button class="btn btn-danger" onclick="deleteCourse('${c.id}')">Delete</button>`:`<button class="btn btn-outline" onclick="closeModal()">Cancel</button>`}
      <button class="btn btn-gold" onclick="saveCourse(${c?`'${c.id}'`:'null'})">Save</button>
    </div>`;
  showModal(html);
}
async function saveCourse(id){
  const name = document.getElementById('crsName').value.trim();
  const creditHours = parseFloat(document.getElementById('crsCredit').value);
  const gradePoints = parseFloat(document.getElementById('crsGrade').value);
  if(!name || !Number.isFinite(creditHours) || creditHours<=0 || !Number.isFinite(gradePoints) || gradePoints<0 || gradePoints>4){ showToast("Fill all fields"); return; }
  if(id){ Object.assign(state.courses.find(c=>c.id===id), {name,creditHours,gradePoints}); }
  else state.courses.push({id:uid(), name, creditHours, gradePoints});
  if(!await save('courses'))return; closeModal(); showToast("Saved"); render();
}
async function deleteCourse(id){ state.courses = state.courses.filter(c=>c.id!==id); if(!await save('courses'))return; closeModal(); render(); }

/* -- Goals + Main Mission -- */

function renderGoalsList(){
 let html = '<button class="btn btn-gold" style="margin-bottom:14px" onclick="openGoalModal()">＋ Add Goal</button><div class="card">';
 if(!state.goals.length) html += '<div class="empty"><strong>What do you want to achieve?</strong><span>Learn a skill, finish a project, build a routine, read more, or save for something important.</span></div>';
 state.goals.forEach(g => {
  html += '<div class="item-row" onclick="openGoalModal(&quot;'+g.id+'&quot;)"><div class="item-top"><span class="item-name">'+esc(g.name)+'</span><span class="badge">'+esc(g.status || 'Pending')+'</span></div><div class="item-meta">'+esc(g.category || 'Personal')+' · '+esc(goalProgressText(g))+(g.deadline?' · due '+esc(g.deadline):'')+'</div><div class="mini-bar"><div class="mini-bar-fill" style="width:'+goalPercent(g)+'%"></div></div></div>';
 });
 return html+'</div>';
}
function openGoalModal(id){
 const g = state.goals.find(goal => goal.id===id);
 const type = g?.tracking || 'number';
 const categories = ['Personal','Education','Career','Project','Health','Fitness','Deen','Reading','Routine','Savings','Other'];
 if(g?.category && !categories.includes(g.category)) categories.push(g.category);
 const status = !g ? 'Pending' : /done/i.test(g.status) ? 'Done' : /progress/i.test(g.status) ? 'In Progress' : 'Pending';
 let html = '<div class="modal-title">'+(g?'Edit':'Add')+' Goal</div><p class="dialog-description">Choose what matters, then how you want to track it.</p>';
 html += '<div class="field"><label>Name</label><input id="goalName" maxlength="120" required value="'+esc(g?.name)+'" placeholder="e.g. Finish my portfolio or read 12 books"></div>';
 html += '<div class="field-row"><div class="field"><label>Life area</label><select id="goalCategory">'+categories.map(c=>'<option '+(c===(g?.category || 'Personal')?'selected':'')+'>'+c+'</option>').join('')+'</select></div><div class="field"><label>Status</label><select id="goalStatus">'+['Pending','In Progress','Done'].map(t=>'<option '+(t===status?'selected':'')+'>'+t+'</option>').join('')+'</select></div></div>';
 html += '<div class="field"><label>How will you track progress?</label><select id="goalTracking" onchange="toggleGoalFields()">'+[['number','Measurable target — books, hours, sessions, money'],['checklist','Checklist — project steps or milestones'],['completion','Completion — one clear outcome']].map(([v,t])=>'<option value="'+v+'" '+(type===v?'selected':'')+'>'+t+'</option>').join('')+'</select></div>';
 html += '<div class="field" id="goalSessionOptions"><label for="goalSessionProgress">Progress from linked activities</label><select id="goalSessionProgress"><option value="manual">Manual progress only</option><option value="hours">Add completed session hours</option><option value="sessions">Add completed session count</option></select><p class="field-hint">Current value is your manual baseline. Linked completed activity adds to it automatically. Use hours or sessions as the unit.</p></div>';
 html += '<div id="goalNumbers"><div class="field"><label>Unit</label><input id="goalUnit" maxlength="30" value="'+esc(g?.unit || (g?.category==='Savings'?'PKR':''))+'" placeholder="books, hours, sessions, kg, PKR"></div><div class="field-row">'+[['goalStart','Starting value',g?.start ?? 0],['goalTarget','Target value',g?.target ?? ''],['goalCurrent','Current value',g?.current ?? 0]].map(([id,label,value])=>'<div class="field"><label>'+label+'</label><input id="'+id+'" type="number" step="any" min="0" value="'+value+'"></div>').join('')+'</div><p class="field-hint">Starting and target values can track an increase or a decrease. For a routine, count completed sessions.</p></div>';
 html += '<div id="goalChecklist"><p class="field-hint">One step per line. Check completed steps below.</p><div class="field"><label>Steps</label><textarea id="goalSteps">'+esc((g?.steps || []).map(step=>step.text).join('\n'))+'</textarea></div><div id="goalStepChecks"></div></div>';
 html += '<div id="goalCompletion" class="preview-notice">Use Status to mark this outcome Done when you achieve it.</div><div class="field"><label>Deadline (optional)</label><input type="date" id="goalDeadline" value="'+esc(g?.deadline)+'"></div>';
 html += '<button type="button" class="chip '+(g&&state.mission.goalId===g.id?'active':'')+'" id="missionChip" onclick="this.classList.toggle(&quot;active&quot;)">★ Main focus on dashboard</button><div class="modal-actions">'+(g?'<button class="btn btn-danger" onclick="deleteGoal(&quot;'+g.id+'&quot;)">Delete</button>':'<button class="btn btn-outline" onclick="closeModal()">Cancel</button>')+'<button class="btn btn-gold" id="saveGoalButton">Save goal</button></div>';
 showModal(html);
 const done = new Set((g?.steps || []).filter(step=>step.done).map(step=>step.text));
 function updateSteps(){
  document.querySelectorAll('[data-goal-step]').forEach(input=>{if(input.checked)done.add(input.dataset.goalStep);else done.delete(input.dataset.goalStep);});
  const lines=[...new Set(document.getElementById('goalSteps').value.split('\n').map(t=>t.trim()).filter(Boolean))];
  document.getElementById('goalStepChecks').innerHTML = lines.map(text=>'<label class="goal-step"><input type="checkbox" data-goal-step="'+esc(text)+'" '+(done.has(text)?'checked':'')+'><span>'+esc(text)+'</span></label>').join('');
 }
 document.getElementById('goalSteps').addEventListener('input',updateSteps);
 document.getElementById('saveGoalButton').onclick=()=>saveGoal(id);
 document.getElementById('goalSessionProgress').value=g?.sessionProgress || 'manual';
 updateSteps();toggleGoalFields();
}
function toggleGoalFields(){
 const type=document.getElementById('goalTracking').value;
 document.getElementById('goalNumbers').hidden=type!=='number';
 document.getElementById('goalSessionOptions').hidden=type!=='number';
 document.getElementById('goalChecklist').hidden=type!=='checklist';
 document.getElementById('goalCompletion').hidden=type!=='completion';
}
async function saveGoal(id){
 const value=id=>document.getElementById(id).value.trim();
 const name=value('goalName'), tracking=value('goalTracking');
 if(!name){showToast('Give your goal a name.');return;}
 const data={name,tracking,sessionProgress:'manual',category:value('goalCategory'),status:value('goalStatus'),deadline:value('goalDeadline')};
 if(tracking==='number'){
  const start=Number(value('goalStart')),target=Number(value('goalTarget')),current=Number(value('goalCurrent'));
  if(['goalStart','goalTarget','goalCurrent'].some(id=>value(id)==='') || ![start,target,current].every(n=>Number.isFinite(n)&&n>=0) || start===target){showToast('Enter non-negative values, with a target different from the starting value.');return;}
  if(!value('goalUnit')){showToast('Add a unit, such as books, sessions, kg or PKR.');return;}
  const source=value('goalSessionProgress');
  if(source!=='manual' && (target<=start || value('goalUnit').toLowerCase()!==source)){showToast('Linked progress needs an increasing target and unit '+source+'.');return;}
  Object.assign(data,{start,target,current,unit:value('goalUnit'),sessionProgress:source});
 }else if(tracking==='checklist'){
  data.steps=[...document.querySelectorAll('[data-goal-step]')].map(input=>({text:input.dataset.goalStep,done:input.checked}));
  if(!data.steps.length){showToast('Add at least one step.');return;}
  data.target=data.steps.length;data.current=data.steps.filter(step=>step.done).length;data.unit='steps';
 }else{data.target=1;data.current=data.status==='Done'?1:0;data.unit='outcome';}
 const goal=id?state.goals.find(g=>g.id===id):{id:uid()};
 if(!goal){showToast('This goal no longer exists.');return;}
 Object.assign(goal,data);if(!id)state.goals.push(goal);
 if(document.getElementById('missionChip').classList.contains('active'))state.mission.goalId=goal.id;
 else if(state.mission.goalId===goal.id)state.mission.goalId=null;
 if(!await saveMany(['goals','mission']))return;closeModal();showToast('Goal updated');render();
}
async function deleteGoal(id){
 if(!window.confirm('Delete this goal?'))return;
 state.goals=state.goals.filter(g=>g.id!==id);
 if(state.mission.goalId===id){state.mission.goalId=null;}
 if(!await saveMany(['goals','mission']))return;closeModal();render();
}

/* -- Trading Journal -- */
function renderTradingList(){
  const wins = state.trades.filter(t=>t.result==='Win').length;
  const total = state.trades.length;
  const winRate = total ? Math.round(wins/total*100) : null;
  let html = '';
  if(total){
    html += `<div class="stat-grid">
      <div class="stat"><div class="stat-label">Win Rate</div><div class="stat-value">${winRate}%</div></div>
      <div class="stat"><div class="stat-label">Trades Logged</div><div class="stat-value">${total}</div></div>
    </div>`;
  }
  html += `<button class="btn btn-gold" style="margin-bottom:14px;" onclick="openTradeModal()">＋ Add Trade</button><div class="card">`;
  if(state.trades.length===0) html += `<div class="empty">No trades logged yet.</div>`;
  else [...state.trades].reverse().forEach(t=>{
    const badgeClass = t.result==='Win'?'win':t.result==='Loss'?'loss':'be';
    html += `<div class="item-row" onclick="openTradeModal('${t.id}')">
      <div class="item-top"><span class="item-name">${esc(t.pair)}</span><span class="badge ${badgeClass}">${t.result}</span></div>
      <div class="item-meta">Entry ${t.entry} → Exit ${t.exit} · TP ${t.tp||'—'} · SL ${t.sl||'—'} · ${t.date}</div>
      ${t.lessons?`<div class="item-meta" style="margin-top:4px;font-style:italic;">"${esc(t.lessons)}"</div>`:''}
    </div>`;
  });
  html += `</div>`;
  return html;
}
function openTradeModal(id){
  const t = id ? state.trades.find(x=>x.id===id) : null;
  let html = `<div class="modal-title">${t?'Edit':'Add'} Trade</div>
    <div class="field"><label>Pair / Instrument</label><input id="trPair" value="${t?esc(t.pair):''}" placeholder="e.g. BTC/USD"></div>
    <div class="field-row">
      <div class="field"><label>Entry</label><input type="number" id="trEntry" value="${t?t.entry:''}"></div>
      <div class="field"><label>Exit</label><input type="number" id="trExit" value="${t?t.exit:''}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>TP</label><input type="number" id="trTp" value="${t?t.tp||'':''}"></div>
      <div class="field"><label>SL</label><input type="number" id="trSl" value="${t?t.sl||'':''}"></div>
    </div>
    <div class="field"><label>Result</label>
      <select id="trResult"><option ${t&&t.result==='Win'?'selected':''}>Win</option><option ${t&&t.result==='Loss'?'selected':''}>Loss</option><option ${t&&t.result==='Break Even'?'selected':''}>Break Even</option></select>
    </div>
    <div class="field"><label>Lessons Learned</label><textarea id="trLessons" rows="2">${t?esc(t.lessons||''):''}</textarea></div>
    <div class="modal-actions">
      ${t?`<button class="btn btn-danger" onclick="deleteTrade('${t.id}')">Delete</button>`:`<button class="btn btn-outline" onclick="closeModal()">Cancel</button>`}
      <button class="btn btn-gold" onclick="saveTrade(${t?`'${t.id}'`:'null'})">Save</button>
    </div>`;
  showModal(html);
}
async function saveTrade(id){
  const pair = document.getElementById('trPair').value.trim();
  const entry = parseFloat(document.getElementById('trEntry').value);
  const exit = parseFloat(document.getElementById('trExit').value);
  if(!pair || isNaN(entry) || isNaN(exit)){ showToast("Pair, entry and exit required"); return; }
  const data = {
    pair, entry, exit, tp: document.getElementById('trTp').value, sl: document.getElementById('trSl').value,
    result: document.getElementById('trResult').value, lessons: document.getElementById('trLessons').value.trim(), date: today()
  };
  if(id){ const existing = state.trades.find(t=>t.id===id); data.date = existing.date; Object.assign(existing, data); }
  else state.trades.push({id:uid(), ...data});
  if(!await save('trades'))return; closeModal(); showToast("Saved"); render();
}
async function deleteTrade(id){ state.trades = state.trades.filter(t=>t.id!==id); if(!await save('trades'))return; closeModal(); render(); }
