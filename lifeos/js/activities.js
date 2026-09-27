const activitySymbols = {Sleep:'☾',Work:'▣',Study:'✎',Quran:'◇',Workout:'↗',Travel:'➝',Gaming:'⊕','Social Media':'#','Family/Friends':'♡',Other:'⋯'};
function activityTile(activity, inDialog){
 const button = document.createElement('button');
 button.className = 'activity-tile';
 button.setAttribute('onclick', (inDialog ? 'closeModal();' : '') + 'startActivity(' + JSON.stringify(activity.key) + ')');
 button.innerHTML = '<span class="activity-symbol" aria-hidden="true">' + activitySymbols[activity.key] + '</span><span>' + esc(activity.key) + '</span><span class="activity-arrow" aria-hidden="true">↗</span>';
 return button.outerHTML;
}
// Activity tracking and sleep checkout
function renderActivities(){
  const act = activeLog();
  let html = activitySummaryHTML()+'<button class="btn btn-outline" style="margin-bottom:16px" onclick="openActivityEditor()">Log a past activity</button>';
  if(act){
    html += `<div class="live-banner">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="live-dot"></div>
        <div><div style="font-weight:600;font-size:14px;">${act.activity}</div><div class="faint" style="font-size:11px;">since ${fmtTime(act.startISO)}</div></div>
      </div>
      <button class="btn btn-gold" style="width:auto;padding:9px 14px;" onclick="endActivity('${act.id}')">Check Out</button>
    </div>`;
  } else {
    html += `<div class="section-title">Check In</div><div class="activity-picker">`;
    ACTIVITY_TYPES.forEach(a=>{ html += activityTile(a, false); });
    html += `</div>`;
  }
  html += `<div class="section-title">Today's Log</div><div class="card">`;
  const logs = todaysLogs();
  if(logs.length===0){ html += `<div class="empty"><span class="empty-icon" aria-hidden="true">◷</span><strong>Your day starts here.</strong><span>Choose an activity above to begin your timeline.</span></div>`; }
  else logs.forEach(l=>{ html += logRowHTML(l); });
  html += `</div>`;
  const older=state.logs.filter(l=>!logs.includes(l)).sort((a,b)=>Date.parse(b.startISO)-Date.parse(a.startISO));
  if(older.length)html+='<details class="card"><summary>Earlier activities ('+older.length+')</summary>'+older.map(logRowHTML).join('')+'</details>';
  document.getElementById('main').innerHTML = html;
}

function openCheckinModal(){
  let html = `<div class="modal-title">Start an activity</div><p class="dialog-description">What are you making time for?</p><div class="activity-picker">`;
  ACTIVITY_TYPES.forEach(a=>{ html += activityTile(a, true); });
  html += `</div><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>`;
  showModal(html);
}
