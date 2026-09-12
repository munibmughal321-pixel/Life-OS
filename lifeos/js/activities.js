// Activity tracking and sleep checkout
function renderActivities(){
  const act = activeLog();
  let html = '';
  if(act){
    html += `<div class="live-banner">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="live-dot"></div>
        <div><div style="font-weight:600;font-size:14px;">${act.activity}</div><div class="faint" style="font-size:11px;">since ${fmtTime(act.startISO)}</div></div>
      </div>
      <button class="btn btn-gold" style="width:auto;padding:9px 14px;" onclick="endActivity('${act.id}')">Check Out</button>
    </div>`;
  } else {
    html += `<div class="section-title">Check In</div><div class="chip-row" style="margin-bottom:14px;">`;
    ACTIVITY_TYPES.forEach(a=>{ html += `<button class="chip" onclick="startActivity('${a.key}')">${a.key}</button>`; });
    html += `</div>`;
  }
  html += `<div class="section-title">Today's Log</div><div class="card">`;
  const logs = todaysLogs();
  if(logs.length===0){ html += `<div class="empty">No activity logged yet today.</div>`; }
  else logs.forEach(l=>{ html += logRowHTML(l); });
  html += `</div>`;
  document.getElementById('main').innerHTML = html;
}

/* ---------- DEEN (accessed via link, not in nav) ---------- */
async function startActivity(name){
  if(activeLog()){ showToast("Check out your current activity first"); return; }
  state.logs.push({id:uid(), activity:name, startISO:new Date().toISOString(), endISO:null});
  await save('logs'); showToast(`Checked in: ${name}`); render();
}
async function endActivity(id){
  const l = state.logs.find(l=>l.id===id); if(!l) return;
  if(l.activity==='Sleep'){ openSleepCheckoutModal(id); return; }
  l.endISO = new Date().toISOString();
  await save('logs'); showToast(`Checked out: ${l.activity}`); render();
}
function openSleepCheckoutModal(id){
  let html = `<div class="modal-title">Sleep Check-out</div>
    <div class="field"><label>Sleep Quality</label>
      <div class="chip-row" id="qualityChips">${[1,2,3,4,5].map(n=>`<button class="chip" data-q="${n}" onclick="selectQuality(${n})">${n}</button>`).join('')}</div>
    </div>
    <div class="chip-row" style="margin-bottom:6px;"><button class="chip" id="headacheChip" onclick="this.classList.toggle('active')">Woke up with headache</button></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Skip</button>
      <button class="btn btn-gold" onclick="finalizeSleepCheckout('${id}')">Save</button>
    </div>`;
  showModal(html); window._sleepQuality = null;
}
function selectQuality(n){ window._sleepQuality = n; document.querySelectorAll('#qualityChips .chip').forEach(c=>c.classList.toggle('active', parseInt(c.dataset.q)===n)); }
async function finalizeSleepCheckout(id){
  const l = state.logs.find(l=>l.id===id);
  l.endISO = new Date().toISOString(); l.quality = window._sleepQuality || null;
  l.headache = document.getElementById('headacheChip').classList.contains('active');
  await save('logs'); closeModal(); showToast("Sleep logged"); render();
}
function openCheckinModal(){
  let html = `<div class="modal-title">Start Activity</div><div class="chip-row">`;
  ACTIVITY_TYPES.forEach(a=>{ html += `<button class="chip" onclick="closeModal();startActivity('${a.key}')">${a.key}</button>`; });
  html += `</div><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>`;
  showModal(html);
}
