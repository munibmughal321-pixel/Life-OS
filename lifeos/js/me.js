// Profile, health check-ins, journal, and weekly review
function renderMe(){
  const ci = latestCheckin();
  const hs = healthScore();
  let html = '';

  html += `<div class="section-title">Health Score</div><div class="card health-ring-wrap">
    ${circularProgress(hs!==null?hs:0, 90, hs!==null?(hs>=70?'var(--green)':hs>=40?'var(--gold)':'var(--red)'):'var(--faint)', hs!==null?hs:'—')}
    <div style="flex:1;">
      <div class="faint" style="font-size:12px;line-height:1.5;">Based on last 7 days of energy, sleep, water, exercise, and headache-free days.</div>
    </div>
  </div>`;

  html += `<div class="section-title">Daily Check-in</div><div class="card">
    <div class="field-row">
      <div class="field"><label>Weight (kg)</label><input type="number" id="ciWeight" value="${ci?ci.weight:70}"></div>
      <div class="field"><label>Energy (1-10)</label><input type="number" id="ciEnergy" min="1" max="10" value="${ci?ci.energy:5}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Mood (1-10)</label><input type="number" id="ciMood" min="1" max="10" value="${ci?ci.mood:5}"></div>
      <div class="field"><label>Water (ml)</label><input type="number" id="ciWater" value="${ci?ci.water||'':''}" placeholder="optional"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Exercise (min)</label><input type="number" id="ciExercise" value="${ci?ci.exercise||'':''}" placeholder="optional"></div>
      <div class="field"><label>Steps</label><input type="number" id="ciSteps" value="${ci?ci.steps||'':''}" placeholder="optional"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Calories</label><input type="number" id="ciCalories" value="${ci?ci.calories||'':''}" placeholder="optional"></div>
      <div class="field"><label>Headache?</label><select id="ciHeadache"><option value="no">No</option><option value="yes" ${ci&&ci.headache?'selected':''}>Yes</option></select></div>
    </div>
    <button class="btn btn-gold" onclick="saveCheckin()">Save Check-in</button>
  </div>`;

  html += `<div class="section-title">Education Profile</div><div class="card">
    <div class="field-row">
      <div class="field"><label>CGPA</label><input type="number" step="0.01" id="cgpaInput" value="${state.profile.cgpa}"></div>
      <div class="field"><label>Salary (PKR)</label><input type="number" id="salaryInput" value="${state.profile.salary}"></div>
    </div>
    <button class="btn btn-outline" onclick="saveProfile()">Update Profile</button>
  </div>`;

  html += `<div class="section-title">Deen <button class="section-link" onclick="goToScreen('deen')">Open →</button></div><div class="card">
    <div class="row-between"><span class="muted">Prayers today</span><span style="font-weight:600;">${countPrayersToday()}/5</span></div>
    <div class="row-between" style="margin-top:6px;"><span class="muted">Streak</span><span style="font-weight:600;">${prayerStreak()} days</span></div>
  </div>`;

  html += `<button class="btn btn-outline" style="margin-bottom:14px;" onclick="openWeeklyReview()">📊 View Weekly Review</button>`;

  html += `<div class="section-title">End of Day Review</div><div class="card">
    <div class="field"><label>Best thing today</label><input id="jBest" placeholder="..."></div>
    <div class="field"><label>Worst thing today</label><input id="jWorst" placeholder="..."></div>
    <div class="field"><label>Tomorrow's focus</label><input id="jFocus" placeholder="e.g. 30 min Maths"></div>
    <button class="btn btn-gold" onclick="saveJournal()">Save Review</button>
  </div>`;

  html += `<div class="section-title">Recent Reviews</div><div class="card">`;
  const j = [...state.journal].reverse().slice(0,3);
  if(j.length===0) html += `<div class="empty">No reviews yet.</div>`;
  else j.forEach(e=>{
    html += `<div style="padding:10px 0;border-bottom:1px solid var(--line);">
      <div class="faint" style="font-size:11px;margin-bottom:4px;">${e.date}</div>
      <div style="font-size:13px;"><b>Best:</b> ${e.best||'—'}</div>
      <div style="font-size:13px;"><b>Focus:</b> ${e.focus||'—'}</div>
    </div>`;
  });
  html += `</div>`;

  document.getElementById('main').innerHTML = html;
}

function openWeeklyReview(){
  const dates = last7Dates();
  const weekLogs = state.logs.filter(l=>dates.includes(l.startISO.slice(0,10)) && l.endISO);
  const hoursFor = (act) => weekLogs.filter(l=>l.activity===act).reduce((s,l)=>s+(new Date(l.endISO)-new Date(l.startISO)),0)/3600000;
  const prayerPct = Math.round(dates.reduce((s,d)=>{ const p=state.prayers[d]; return s+(p?PRAYER_NAMES.filter(n=>p[n]).length:0); },0) / (5*7) * 100);
  const weekCheckins = state.checkins.filter(c=>dates.includes(c.date));
  const energyAvg = weekCheckins.length ? (weekCheckins.reduce((s,c)=>s+c.energy,0)/weekCheckins.length).toFixed(1) : '—';
  const weekFinance = state.finance.filter(f=>dates.includes(f.date));
  const wIncome = weekFinance.filter(f=>f.type==='income').reduce((s,f)=>s+f.amount,0);
  const wExpense = weekFinance.filter(f=>f.type==='expense').reduce((s,f)=>s+f.amount,0);
  const sleep7 = sleepStats7d();
  const hs = healthScore();

  let html = `<div class="modal-title">Weekly Review</div>
    <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line);"><span class="muted">Health Score</span><span style="font-weight:600;">${hs!==null?hs:'—'}</span></div>
    <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line);"><span class="muted">Prayer</span><span style="font-weight:600;">${prayerPct}%</span></div>
    <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line);"><span class="muted">Sleep Avg</span><span style="font-weight:600;">${fmtDur(sleep7.avgMs)}</span></div>
    <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line);"><span class="muted">Study Hours</span><span style="font-weight:600;">${hoursFor('Study').toFixed(1)}h</span></div>
    <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line);"><span class="muted">Work Hours</span><span style="font-weight:600;">${hoursFor('Work').toFixed(1)}h</span></div>
    <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line);"><span class="muted">Money Saved</span><span style="font-weight:600;" class="${(wIncome-wExpense)>=0?'amount-pos':'amount-neg'}">${(wIncome-wExpense).toLocaleString()} PKR</span></div>
    <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line);"><span class="muted">Expenses</span><span style="font-weight:600;">${wExpense.toLocaleString()} PKR</span></div>
    <div class="row-between" style="padding:8px 0;"><span class="muted">Energy Avg</span><span style="font-weight:600;">${energyAvg}/10</span></div>
    <div class="modal-actions"><button class="btn btn-gold" onclick="closeModal()">Close</button></div>`;
  showModal(html);
}

/* ---------- ACTIONS: activities ---------- */
/* ---------- ACTIONS: me ---------- */
async function saveCheckin(){
  const weight = parseFloat(document.getElementById('ciWeight').value);
  const energy = parseInt(document.getElementById('ciEnergy').value);
  const mood = parseInt(document.getElementById('ciMood').value);
  const water = document.getElementById('ciWater').value ? parseFloat(document.getElementById('ciWater').value) : null;
  const exercise = document.getElementById('ciExercise').value ? parseFloat(document.getElementById('ciExercise').value) : null;
  const steps = document.getElementById('ciSteps').value ? parseFloat(document.getElementById('ciSteps').value) : null;
  const calories = document.getElementById('ciCalories').value ? parseFloat(document.getElementById('ciCalories').value) : null;
  const headache = document.getElementById('ciHeadache').value === 'yes';
  state.checkins.push({date:today(), weight, energy, mood, water, exercise, steps, calories, headache});
  await save('checkins'); showToast("Check-in saved"); render();
}
async function saveProfile(){
  state.profile.cgpa = parseFloat(document.getElementById('cgpaInput').value) || state.profile.cgpa;
  state.profile.salary = parseFloat(document.getElementById('salaryInput').value) || state.profile.salary;
  await save('profile'); showToast("Profile updated");
}
async function saveJournal(){
  const best = document.getElementById('jBest').value.trim();
  const worst = document.getElementById('jWorst').value.trim();
  const focus = document.getElementById('jFocus').value.trim();
  if(!best && !worst && !focus){ showToast("Add something first"); return; }
  state.journal.push({date:today(), best, worst, focus});
  await save('journal'); showToast("Review saved");
  document.getElementById('jBest').value=''; document.getElementById('jWorst').value=''; document.getElementById('jFocus').value='';
  render();
}
