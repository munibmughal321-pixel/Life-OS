// Dashboard, header, and 24-hour activity arc
/* ---------- ARC (24h ring) ---------- */
function renderArc(){
  const size=180, cx=size/2, cy=size/2, r=76;
  const logs = todaysLogs(); const now = new Date();
  let svg = `<svg class="arc-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1B2740" stroke-width="14"/>`;
  logs.forEach(l=>{
    const start = new Date(l.startISO); const end = l.endISO ? new Date(l.endISO) : now;
    const startFrac = (start.getHours()*60+start.getMinutes())/1440;
    const endFrac = Math.min(1,(end.getHours()*60+end.getMinutes())/1440 + (end<start?1:0));
    const a0 = startFrac*360 - 90, a1 = Math.max(a0+2, endFrac*360-90);
    svg += arcPath(cx,cy,r,a0,a1,colorFor(l.activity));
  });
  const nowFrac = (now.getHours()*60+now.getMinutes())/1440;
  const ang = (nowFrac*360-90) * Math.PI/180;
  const nx = cx + (r)*Math.cos(ang), ny = cy + (r)*Math.sin(ang);
  svg += `<circle cx="${nx}" cy="${ny}" r="4" fill="#E8A33D"/>`;
  svg += `<text x="${cx}" y="${cy-4}" text-anchor="middle" fill="#E8EAF0" font-size="20" font-family="Space Grotesk" font-weight="600">${now.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</text>`;
  svg += `<text x="${cx}" y="${cy+14}" text-anchor="middle" fill="#8B93A7" font-size="10">${logs.length} logged today</text>`;
  svg += `</svg>`;
  document.getElementById('arcWrap').innerHTML = `${svg}<p class="arc-caption">Your 24 hours — tap Activities to log more</p>`;
}
function arcPath(cx,cy,r,a0,a1,color){
  const toXY = (ang)=>{ const rad=ang*Math.PI/180; return [cx+r*Math.cos(rad), cy+r*Math.sin(rad)]; };
  const [x0,y0]=toXY(a0), [x1,y1]=toXY(a1);
  const large = (a1-a0)>180?1:0;
  return `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>`;
}

/* ---------- HEADER ---------- */
function renderHeader(){
  const h = new Date().getHours();
  const greeting = h<5?"Still up":h<12?"Good Morning":h<17?"Good Afternoon":h<21?"Good Evening":"Good Night";
  document.getElementById('greetName').textContent = `${greeting}, ${NAME}`;
  document.getElementById('dateLabel').textContent = new Date().toLocaleDateString([], {weekday:'long', month:'long', day:'numeric'});
  document.getElementById('backBtn').style.display = (currentScreen==='deen') ? 'block' : 'none';
  document.getElementById('arcWrap').style.display = (currentScreen==='deen') ? 'none' : 'block';
}

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  const ci = latestCheckin();
  const prayerCount = countPrayersToday();
  const act = activeLog();
  const phase = currentPhase();
  const sleepMs = lastNightSleepMs();
  const studyWeek = weeklyStudyHours();
  const hs = healthScore();
  const mission = mainMissionGoal();
  const forecast = missionForecast(mission);

  let html = '';
  if(act){
    html += `<div class="live-banner">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="live-dot"></div>
        <div><div style="font-weight:600;font-size:14px;">${act.activity}</div>
        <div class="faint" style="font-size:11px;">since ${fmtTime(act.startISO)}</div></div>
      </div>
      <button class="btn btn-gold" style="width:auto;padding:9px 14px;" onclick="endActivity('${act.id}')">Check Out</button>
    </div>`;
  } else {
    html += `<button class="btn btn-gold" style="margin-bottom:12px;" onclick="openCheckinModal()">＋ Start Activity</button>`;
  }

  html += `<div class="coach-card">
    <div class="coach-head"><span class="coach-title">LifeOS Coach</span></div>
    <div class="phase-pill">${phase.icon} ${phase.label}</div>
    <div class="coach-stats">
      <div class="coach-stat"><div class="v">${sleepMs!==null?fmtDur(sleepMs):'—'}</div><div class="l">Sleep</div></div>
      <div class="coach-stat"><div class="v">${prayerCount}/5</div><div class="l">Prayer</div></div>
      <div class="coach-stat"><div class="v">${studyWeek.toFixed(1)}h</div><div class="l">Study/wk</div></div>
      <div class="coach-stat"><div class="v">${hs!==null?hs:'—'}</div><div class="l">Health</div></div>
    </div>
    <div class="mission">${computeMission()}<br><span class="faint" style="font-size:11.5px;">💡 ${computeSuggestion()}</span></div>
  </div>`;

  if(mission){
    const pct = mission.target ? Math.min(100, Math.round(mission.current/mission.target*100)) : 0;
    html += `<div class="mission-card">
      <div style="flex-shrink:0;">${circularProgress(pct, 84, 'var(--blue)', pct+'%')}</div>
      <div class="mission-info">
        <div class="mission-label">🎯 Main Mission</div>
        <div class="mission-name">${mission.name}</div>
        <div class="mission-nums">${mission.current.toLocaleString()} / ${mission.target.toLocaleString()} PKR</div>
        ${forecast && !forecast.done ? `<div class="mission-nums">Save <b style="color:var(--gold);">${Math.ceil(forecast.dailyTarget).toLocaleString()}/day</b> · ${Math.ceil(forecast.weeklyTarget).toLocaleString()}/wk</div>
        <div class="mission-forecast">${forecast.etaText}</div>` : forecast && forecast.done ? `<div class="mission-forecast" style="color:var(--green);">🎉 Goal reached!</div>` : ''}
      </div>
    </div>`;
  }

  html += `<div class="section-title">Quick Stats</div><div class="stat-grid">
    <div class="stat"><div class="stat-label">Energy</div><div class="stat-value">${ci?ci.energy:'—'}<span style="font-size:12px;color:var(--faint);">/10</span></div></div>
    <div class="stat"><div class="stat-label">Mood</div><div class="stat-value">${ci?ci.mood:'—'}<span style="font-size:12px;color:var(--faint);">/10</span></div></div>
    <div class="stat"><div class="stat-label">Prayer</div><div class="stat-value">${prayerCount}<span style="font-size:12px;color:var(--faint);">/5</span></div></div>
    <div class="stat"><div class="stat-label">Sleep (last)</div><div class="stat-value" style="font-size:16px;">${sleepMs!==null?fmtDur(sleepMs):'—'}</div></div>
    <div class="stat"><div class="stat-label">Savings</div><div class="stat-value mono" style="font-size:16px;">${mission?Math.round(mission.current/mission.target*100)+'%':'—'}</div></div>
    <div class="stat"><div class="stat-label">Study Today</div><div class="stat-value" style="font-size:16px;">${todayStudyHours().toFixed(1)}h</div></div>
  </div>`;

  const sleep7 = sleepStats7d();
  html += `<div class="section-title">Sleep Intelligence <button class="section-link" onclick="goToScreen('me')">Log check-in →</button></div><div class="card">
    <div class="row-between"><span>Avg (7d): <b>${fmtDur(sleep7.avgMs)}</b></span><span class="faint">Debt: ${fmtDur(sleep7.debtMs)}</span></div>
    <div class="sleep-trend">
      ${sleep7.trend.map(t=>`<div class="sleep-bar-wrap"><div class="sleep-bar" style="height:${Math.min(100,(t.hours/9)*100)}%;background:${t.hours<6&&t.hours>0?'var(--red)':'var(--blue)'};"></div><div class="sleep-day-label">${new Date(t.date).toLocaleDateString([],{weekday:'narrow'})}</div></div>`).join('')}
    </div>
  </div>`;

  html += `<div class="section-title">Deen <button class="section-link" onclick="goToScreen('deen')">Open →</button></div><div class="card">
    <div class="prayer-grid">${PRAYER_NAMES.map(n=>{
      const done = !!todaysPrayers()[n];
      return `<div class="prayer-cell ${done?'done':''}" onclick="togglePrayer('${n}')"><div class="prayer-name">${n}</div><div class="prayer-check">${done?'✓':''}</div></div>`;
    }).join('')}</div>
  </div>`;

  html += `<div class="section-title">Recent Activity</div><div class="card">`;
  const logs = todaysLogs().slice(0,4);
  if(logs.length===0){ html += `<div class="empty">Nothing logged yet today. Start your first check-in.</div>`; }
  else { logs.forEach(l=>{ html += logRowHTML(l); }); }
  html += `</div>`;

  document.getElementById('main').innerHTML = html;
}

function logRowHTML(l){
  const dur = l.endISO ? fmtDur(new Date(l.endISO)-new Date(l.startISO)) : 'ongoing';
  return `<div class="log-row">
    <div class="log-dot" style="background:${colorFor(l.activity)}"></div>
    <div class="log-info"><div class="log-act">${l.activity}</div><div class="log-time">${fmtTime(l.startISO)}${l.endISO?' – '+fmtTime(l.endISO):''}</div></div>
    <div class="log-dur">${dur}</div>
  </div>`;
}

/* ---------- ACTIVITIES ---------- */
