// Education, skills, goals, trading journal, and vault
function renderGrowth(){
  let html = `<div class="subtabs">
    <button class="subtab ${growthSub==='education'?'active':''}" onclick="setGrowthSub('education')">Education</button>
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
function setGrowthSub(s){ growthSub=s; renderGrowth(); }
function statusClass(s){ if(s==='Done'||s==='done') return 'done'; if(s==='In Progress'||s==='progress') return 'progress'; return 'pending'; }

/* -- Education + GPA calculator -- */
function renderEducationList(){
  const sem = semesterGPA();
  let html = `<div class="section-title">Semester GPA Calculator</div><div class="card">
    <div class="row-between"><span class="muted">Semester GPA</span><span style="font-size:20px;font-weight:700;font-family:'Space Grotesk',sans-serif;">${sem===null?'—':sem.toFixed(2)}</span></div>
    <div class="row-between" style="margin-top:6px;"><span class="muted">Cumulative CGPA</span><span style="font-weight:600;">${state.profile.cgpa}</span></div>
    <button class="btn btn-outline" style="margin-top:12px;" onclick="openCourseModal()">＋ Add Course</button>
    ${state.courses.length?`<div style="margin-top:10px;">${state.courses.map(c=>`
      <div class="item-row" onclick="openCourseModal('${c.id}')">
        <div class="item-top"><span class="item-name">${c.name}</span><span class="faint mono" style="font-size:12px;">${c.creditHours}cr · ${c.gradePoints.toFixed(1)}</span></div>
      </div>`).join('')}</div>`:''}
  </div>`;

  html += `<div class="section-title">Academic Items</div><button class="btn btn-gold" style="margin-bottom:14px;" onclick="openEducationModal()">＋ Add Academic Item</button><div class="card">`;
  if(state.education.length===0) html += `<div class="empty">No academic items yet. Add your FYP, Maths supply, or an exam.</div>`;
  else state.education.forEach(e=>{
    const dLeft = e.deadline ? daysUntil(e.deadline) : null;
    html += `<div class="item-row" onclick="openEducationModal('${e.id}')">
      <div class="item-top"><span class="item-name">${e.name}</span><span class="badge status-${statusClass(e.status)}">${e.status}</span></div>
      <div class="item-meta">${e.type||'—'}${e.deadline?` · ${dLeft>=0?'in '+dLeft+'d':'overdue'} (${e.deadline})`:''}</div>
    </div>`;
  });
  html += `</div>`;
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
  if(!name || !creditHours || isNaN(gradePoints)){ showToast("Fill all fields"); return; }
  if(id){ Object.assign(state.courses.find(c=>c.id===id), {name,creditHours,gradePoints}); }
  else state.courses.push({id:uid(), name, creditHours, gradePoints});
  await save('courses'); closeModal(); showToast("Saved"); render();
}
async function deleteCourse(id){ state.courses = state.courses.filter(c=>c.id!==id); await save('courses'); closeModal(); render(); }

function openEducationModal(id){
  const e = id ? state.education.find(x=>x.id===id) : null;
  let html = `<div class="modal-title">${e?'Edit':'Add'} Academic Item</div>
    <div class="field"><label>Name</label><input id="eduName" value="${e?esc(e.name):''}" placeholder="e.g. Math Supply, FYP, Final Exam"></div>
    <div class="field-row">
      <div class="field"><label>Type</label>
        <select id="eduType">${['Course','FYP','Supply','Project','Certification','Exam','Other'].map(t=>`<option ${e&&e.type===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Status</label>
        <select id="eduStatus">${['Pending','In Progress','Done'].map(t=>`<option ${e&&e.status===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    <div class="field"><label>Deadline</label><input type="date" id="eduDeadline" value="${e?e.deadline||'':''}"></div>
    <div class="field"><label>Notes</label><textarea id="eduNotes" rows="2">${e?esc(e.notes||''):''}</textarea></div>
    <div class="modal-actions">
      ${e?`<button class="btn btn-danger" onclick="deleteEducation('${e.id}')">Delete</button>`:`<button class="btn btn-outline" onclick="closeModal()">Cancel</button>`}
      <button class="btn btn-gold" onclick="saveEducation(${e?`'${e.id}'`:'null'})">Save</button>
    </div>`;
  showModal(html);
}
async function saveEducation(id){
  const name = document.getElementById('eduName').value.trim();
  if(!name){ showToast("Name is required"); return; }
  const data = { name, type: document.getElementById('eduType').value, status: document.getElementById('eduStatus').value, deadline: document.getElementById('eduDeadline').value, notes: document.getElementById('eduNotes').value.trim() };
  if(id){ Object.assign(state.education.find(e=>e.id===id), data); } else { state.education.push({id:uid(), ...data}); }
  await save('education'); closeModal(); showToast("Saved"); render();
}
async function deleteEducation(id){ state.education = state.education.filter(e=>e.id!==id); await save('education'); closeModal(); render(); }

/* -- Skills with XP -- */
function skillLevel(xp){ return Math.floor(xp/250)+1; }
function skillProgressPct(xp){ return Math.round(((xp%250)/250)*100); }
function renderSkillsList(){
  let html = `<button class="btn btn-gold" style="margin-bottom:14px;" onclick="openSkillModal()">＋ Add Skill</button><div class="card">`;
  if(state.skills.length===0) html += `<div class="empty">No skills tracked yet. Add HTML, CSS, JavaScript, React...</div>`;
  else state.skills.forEach(s=>{
    const lvl = skillLevel(s.xp||0), pct = skillProgressPct(s.xp||0);
    html += `<div class="item-row" onclick="openSkillModal('${s.id}')">
      <div class="item-top"><span class="item-name">${s.name}</span><span class="level-badge">Lvl ${lvl}</span></div>
      <div class="item-meta">${s.xp||0} XP ${s.projects?'· '+s.projects+' projects':''}</div>
      <div class="xp-bar"><div class="xp-bar-fill" style="width:${pct}%;"></div></div>
    </div>`;
  });
  html += `</div>`;
  return html;
}
function openSkillModal(id){
  const s = id ? state.skills.find(x=>x.id===id) : null;
  let html = `<div class="modal-title">${s?'Edit':'Add'} Skill</div>`;
  if(!s) html += `<div class="chip-row" style="margin-bottom:12px;">${SKILL_PRESETS.map(p=>`<button class="chip" onclick="document.getElementById('skName').value='${p}'">${p}</button>`).join('')}</div>`;
  html += `<div class="field"><label>Name</label><input id="skName" value="${s?esc(s.name):''}" placeholder="e.g. Coding, Trading, English"></div>
    <div class="field-row">
      <div class="field"><label>XP</label><input type="number" id="skXp" value="${s?s.xp||0:0}"></div>
      <div class="field"><label>Projects</label><input type="number" id="skProjects" value="${s?s.projects||0:0}"></div>
    </div>
    <div class="chip-row" style="margin-bottom:12px;">
      <button class="chip" onclick="bumpXp(50)">+50 Tutorial</button>
      <button class="chip" onclick="bumpXp(500)">+500 Project</button>
    </div>
    <div class="field"><label>Notes</label><textarea id="skNotes" rows="2">${s?esc(s.notes||''):''}</textarea></div>
    <div class="modal-actions">
      ${s?`<button class="btn btn-danger" onclick="deleteSkill('${s.id}')">Delete</button>`:`<button class="btn btn-outline" onclick="closeModal()">Cancel</button>`}
      <button class="btn btn-gold" onclick="saveSkill(${s?`'${s.id}'`:'null'})">Save</button>
    </div>`;
  showModal(html);
}
function bumpXp(amt){ const el = document.getElementById('skXp'); el.value = (parseInt(el.value)||0) + amt; }
async function saveSkill(id){
  const name = document.getElementById('skName').value.trim();
  if(!name){ showToast("Name is required"); return; }
  const newXp = parseInt(document.getElementById('skXp').value)||0;
  const data = { name, xp: newXp, projects: parseInt(document.getElementById('skProjects').value)||0, notes: document.getElementById('skNotes').value.trim() };
  const oldLevel = id ? skillLevel((state.skills.find(s=>s.id===id)||{xp:0}).xp) : 0;
  if(id){ Object.assign(state.skills.find(s=>s.id===id), data); } else { state.skills.push({id:uid(), ...data}); }
  await save('skills'); closeModal();
  if(skillLevel(newXp) > oldLevel && id) showToast(`🎉 ${name} leveled up to ${skillLevel(newXp)}!`); else showToast("Saved");
  render();
}
async function deleteSkill(id){ state.skills = state.skills.filter(s=>s.id!==id); await save('skills'); closeModal(); render(); }

/* -- Goals + Main Mission -- */
function renderGoalsList(){
  let html = `<button class="btn btn-gold" style="margin-bottom:14px;" onclick="openGoalModal()">＋ Add Goal</button><div class="card">`;
  if(state.goals.length===0) html += `<div class="empty">No goals yet. Add Laptop, Weight 75kg, Save 100k, Finish FYP...</div>`;
  else state.goals.forEach(g=>{
    const pct = g.target ? Math.min(100, Math.round((g.current/g.target)*100)) : 0;
    const isMission = state.mission.goalId===g.id;
    html += `<div class="item-row" onclick="openGoalModal('${g.id}')">
      <div class="item-top">
        <span class="item-name">${isMission?'🎯 ':''}${g.name}</span>
        <span class="badge status-${statusClass(g.status)}">${g.status||'pending'}</span>
      </div>
      <div class="item-meta">${g.category||'General'}${g.deadline?' · due '+g.deadline:''}${g.target?' · '+g.current+'/'+g.target:''}</div>
      ${g.target?`<div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;"></div></div>`:''}
    </div>`;
  });
  html += `</div>`;
  return html;
}
function openGoalModal(id){
  const g = id ? state.goals.find(x=>x.id===id) : null;
  const isMission = g && state.mission.goalId===g.id;
  let html = `<div class="modal-title">${g?'Edit':'Add'} Goal</div>
    <div class="field"><label>Name</label><input id="goalName" value="${g?esc(g.name):''}" placeholder="e.g. Laptop, Weight 75kg, Finish FYP"></div>
    <div class="field-row">
      <div class="field"><label>Category</label>
        <select id="goalCategory">${['Savings','Health','Education','Career','Other'].map(t=>`<option ${g&&g.category===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Status</label>
        <select id="goalStatus">${['Pending','In Progress','Done'].map(t=>`<option ${g&&g.status===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    <div class="field-row">
      <div class="field"><label>Target</label><input type="number" id="goalTarget" value="${g?g.target:''}" placeholder="e.g. 200000"></div>
      <div class="field"><label>Current</label><input type="number" id="goalCurrent" value="${g?g.current:0}"></div>
    </div>
    <div class="field"><label>Deadline</label><input type="date" id="goalDeadline" value="${g?g.deadline||'':''}"></div>
    ${g?`<div class="chip-row" style="margin-bottom:6px;"><button class="chip ${isMission?'active':''}" id="missionChip" onclick="this.classList.toggle('active')">★ Set as Main Mission</button></div>`:''}
    <div class="modal-actions">
      ${g?`<button class="btn btn-danger" onclick="deleteGoal('${g.id}')">Delete</button>`:`<button class="btn btn-outline" onclick="closeModal()">Cancel</button>`}
      <button class="btn btn-gold" onclick="saveGoal(${g?`'${g.id}'`:'null'})">Save</button>
    </div>`;
  showModal(html);
}
async function saveGoal(id){
  const name = document.getElementById('goalName').value.trim();
  if(!name){ showToast("Name is required"); return; }
  const data = {
    name, category: document.getElementById('goalCategory').value, status: document.getElementById('goalStatus').value,
    target: parseFloat(document.getElementById('goalTarget').value)||0, current: parseFloat(document.getElementById('goalCurrent').value)||0,
    deadline: document.getElementById('goalDeadline').value
  };
  let goalId = id;
  if(id){ Object.assign(state.goals.find(g=>g.id===id), data); }
  else { goalId = uid(); state.goals.push({id:goalId, ...data}); }
  await save('goals');
  const missionChip = document.getElementById('missionChip');
  if(missionChip){
    if(missionChip.classList.contains('active')) state.mission.goalId = goalId;
    else if(state.mission.goalId===goalId) state.mission.goalId = null;
    await save('mission');
  }
  closeModal(); showToast("Saved"); render();
}
async function deleteGoal(id){
  state.goals = state.goals.filter(g=>g.id!==id);
  if(state.mission.goalId===id){ state.mission.goalId = null; await save('mission'); }
  await save('goals'); closeModal(); render();
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
      <div class="item-top"><span class="item-name">${t.pair}</span><span class="badge ${badgeClass}">${t.result}</span></div>
      <div class="item-meta">Entry ${t.entry} → Exit ${t.exit} · TP ${t.tp||'—'} · SL ${t.sl||'—'} · ${t.date}</div>
      ${t.lessons?`<div class="item-meta" style="margin-top:4px;font-style:italic;">"${t.lessons}"</div>`:''}
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
  await save('trades'); closeModal(); showToast("Saved"); render();
}
async function deleteTrade(id){ state.trades = state.trades.filter(t=>t.id!==id); await save('trades'); closeModal(); render(); }

/* -- Vault -- */
function renderVaultList(){
  let html = `<button class="btn btn-gold" style="margin-bottom:14px;" onclick="openNoteModal()">＋ Add Note</button><div class="card">`;
  if(state.notes.length===0) html += `<div class="empty">Your second brain is empty. Add Coding notes, Trading notes, Ideas...</div>`;
  else [...state.notes].reverse().forEach(n=>{
    html += `<div class="item-row" onclick="openNoteModal('${n.id}')">
      <div class="item-top"><span class="item-name">${n.title}</span><span class="badge">${n.category}</span></div>
      <div class="item-meta">${(n.content||'').slice(0,60)}${(n.content||'').length>60?'…':''}</div>
    </div>`;
  });
  html += `</div>`;
  return html;
}
function openNoteModal(id){
  const n = id ? state.notes.find(x=>x.id===id) : null;
  let html = `<div class="modal-title">${n?'Edit':'Add'} Note</div>
    <div class="field"><label>Category</label>
      <select id="noteCategory">${['Coding','Trading','Life','Ideas','Business'].map(t=>`<option ${n&&n.category===t?'selected':''}>${t}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Title</label><input id="noteTitle" value="${n?esc(n.title):''}" placeholder="Short title"></div>
    <div class="field"><label>Content</label><textarea id="noteContent" rows="4">${n?esc(n.content||''):''}</textarea></div>
    <div class="modal-actions">
      ${n?`<button class="btn btn-danger" onclick="deleteNote('${n.id}')">Delete</button>`:`<button class="btn btn-outline" onclick="closeModal()">Cancel</button>`}
      <button class="btn btn-gold" onclick="saveNote(${n?`'${n.id}'`:'null'})">Save</button>
    </div>`;
  showModal(html);
}
async function saveNote(id){
  const title = document.getElementById('noteTitle').value.trim();
  if(!title){ showToast("Title is required"); return; }
  const data = { category: document.getElementById('noteCategory').value, title, content: document.getElementById('noteContent').value.trim(), date: today() };
  if(id){ Object.assign(state.notes.find(n=>n.id===id), data); } else state.notes.push({id:uid(), ...data});
  await save('notes'); closeModal(); showToast("Saved"); render();
}
async function deleteNote(id){ state.notes = state.notes.filter(n=>n.id!==id); await save('notes'); closeModal(); render(); }

/* ---------- FINANCE ---------- */
