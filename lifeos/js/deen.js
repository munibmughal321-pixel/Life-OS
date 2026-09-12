// Prayer, Quran, Adhkar, Jumu'ah, and Ramadan
function renderDeen(){
  const p = todaysPrayers();
  const streak = prayerStreak();
  const dow = new Date().getDay(); // 5 = Friday
  const isFriday = dow===5;
  const daysToFriday = (5 - dow + 7) % 7 || 7;
  const adh = state.adhkar[today()] || {morning:false, evening:false};

  let html = `<div class="section-title">Today's Prayers</div><div class="card">
    <div class="prayer-grid">`;
  PRAYER_NAMES.forEach(n=>{
    const done = !!p[n];
    html += `<div class="prayer-cell ${done?'done':''}" onclick="togglePrayer('${n}')"><div class="prayer-name">${n}</div><div class="prayer-check">${done?'✓':''}</div></div>`;
  });
  html += `</div></div>`;

  html += `<div class="stat-grid">
    <div class="stat"><div class="stat-label">Streak</div><div class="stat-value">${streak}<span style="font-size:13px;color:var(--faint);"> days</span></div></div>
    <div class="stat"><div class="stat-label">Quran Today</div><div class="stat-value">${quranToday()}<span style="font-size:13px;color:var(--faint);"> pgs</span></div></div>
  </div>`;

  html += `<div class="section-title">Adhkar</div><div class="card">
    <div class="adhkar-row">
      <div class="adhkar-cell ${adh.morning?'done':''}" onclick="toggleAdhkar('morning')"><div style="font-size:20px;">🌅</div><div style="font-size:12px;margin-top:4px;">Morning</div></div>
      <div class="adhkar-cell ${adh.evening?'done':''}" onclick="toggleAdhkar('evening')"><div style="font-size:20px;">🌆</div><div style="font-size:12px;margin-top:4px;">Evening</div></div>
    </div>
  </div>`;

  html += `<div class="section-title">Jumu'ah</div><div class="card">`;
  if(isFriday){
    const done = !!state.jumuah[today()];
    html += `<div class="row-between"><span>Prayed Jumu'ah today?</span><button class="chip ${done?'active':''}" onclick="toggleJumuah()">${done?'✓ Done':'Mark Done'}</button></div>`;
  } else {
    html += `<div class="empty">Next Jumu'ah in ${daysToFriday} day${daysToFriday===1?'':'s'}.</div>`;
  }
  html += `</div>`;

  const fasting = state.ramadan.fasting[today()];
  html += `<div class="section-title">Ramadan Mode</div><div class="card">
    <div class="row-between"><span>Enable Ramadan tracking</span><button class="chip ${state.ramadan.enabled?'active':''}" onclick="toggleRamadan()">${state.ramadan.enabled?'On':'Off'}</button></div>
    ${state.ramadan.enabled?`<div class="row-between" style="margin-top:12px;"><span>Fasting today?</span><button class="chip ${fasting?'active':''}" onclick="toggleFasting()">${fasting?'✓ Fasting':'Mark Fasting'}</button></div>`:''}
  </div>`;

  html += `<div class="section-title">Quran Reading</div><div class="card">
    <div class="field"><label>Pages read today</label>
      <div style="display:flex;gap:8px;">
        <input type="number" id="quranInput" placeholder="e.g. 4" min="0">
        <button class="btn btn-gold" style="width:auto;padding:11px 18px;" onclick="logQuran()">Save</button>
      </div>
    </div>
  </div>`;

  html += `<div class="section-title">Recent Reflection</div><div class="card">
    <textarea id="deenNote" rows="3" placeholder="How did today's prayers feel? Any reflection after Fajr?"></textarea>
    <button class="btn btn-outline" style="margin-top:10px;" onclick="saveDeenNote()">Save Note</button>
  </div>`;

  document.getElementById('main').innerHTML = html;
}
function quranToday(){ const q = state.quran.find(q=>q.date===today()); return q?q.pages:0; }
function prayerStreak(){
  let streak=0;
  for(let i=0;i<365;i++){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const p = state.prayers[key];
    if(p && PRAYER_NAMES.every(n=>p[n])) streak++; else break;
  }
  return streak;
}
async function toggleAdhkar(period){
  const d = today();
  if(!state.adhkar[d]) state.adhkar[d] = {morning:false, evening:false};
  state.adhkar[d][period] = !state.adhkar[d][period];
  await save('adhkar'); render();
}
async function toggleJumuah(){
  const d = today(); state.jumuah[d] = !state.jumuah[d];
  await save('jumuah'); showToast(state.jumuah[d]?"Jumu'ah marked 🕌":"Unmarked"); render();
}
async function toggleRamadan(){
  state.ramadan.enabled = !state.ramadan.enabled;
  await save('ramadan'); render();
}
async function toggleFasting(){
  const d = today(); state.ramadan.fasting[d] = !state.ramadan.fasting[d];
  await save('ramadan'); render();
}

/* ---------- GROWTH ---------- */
/* ---------- ACTIONS: deen ---------- */
async function togglePrayer(name){
  const d = today();
  if(!state.prayers[d]) state.prayers[d] = {Fajr:false,Dhuhr:false,Asr:false,Maghrib:false,Isha:false};
  state.prayers[d][name] = !state.prayers[d][name];
  await save('prayers');
  render();
  if(PRAYER_NAMES.every(n=>state.prayers[d][n])){
    const s = prayerStreak();
    if([7,30,100].includes(s)) showToast(`🎉 ${s}-day prayer streak!`);
  }
}
async function logQuran(){
  const val = parseInt(document.getElementById('quranInput').value);
  if(!val || val<0){ showToast("Enter a valid page count"); return; }
  const existing = state.quran.find(q=>q.date===today());
  if(existing) existing.pages = val; else state.quran.push({date:today(), pages:val});
  await save('quran'); showToast("Quran reading saved"); render();
}
async function saveDeenNote(){
  const note = document.getElementById('deenNote').value.trim(); if(!note) return;
  const d = today();
  if(!state.prayers[d]) state.prayers[d] = {Fajr:false,Dhuhr:false,Asr:false,Maghrib:false,Isha:false};
  state.prayers[d].note = note;
  await save('prayers'); showToast("Reflection saved"); document.getElementById('deenNote').value='';
}
