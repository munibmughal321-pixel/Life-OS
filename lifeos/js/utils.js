// Shared helpers, calculations, and formatting

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function fmtTime(iso){ return new Date(iso).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); }
function fmtDur(ms){ const m = Math.round(ms/60000); const h = Math.floor(m/60), mm = m%60; return h>0 ? `${h}h ${mm}m` : `${mm}m`; }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function daysUntil(dateStr){ if(!dateStr) return null; return Math.ceil((new Date(dateStr)-new Date(today()))/DAY_MS); }
function todaysLogs(){ const [start,end]=localDayBounds();return state.logs.filter(l=>Date.parse(l.startISO)<end && Date.parse(l.endISO || new Date().toISOString())>start).sort((a,b)=>Date.parse(b.startISO)-Date.parse(a.startISO)); }
function activeLog(){ return state.logs.find(l=>!l.endISO); }
function todaysPrayers(){ return state.prayers[today()] || {Fajr:false,Dhuhr:false,Asr:false,Maghrib:false,Isha:false}; }
function countPrayersToday(){ const p=todaysPrayers(); return PRAYER_NAMES.filter(n=>p[n]).length; }
function walletBalance(){ return state.finance.reduce((sum,f)=> sum + (f.type==='income'? f.amount : -f.amount), 0); }
function todayFinance(){ return state.finance.filter(f=>f.date===today()); }
function latestCheckin(){ return state.checkins.length ? state.checkins[state.checkins.length-1] : null; }
function last7Dates(){ const arr=[]; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); arr.push(localDateKey(d)); } return arr; }

function hoursByActivityInRange(activityName, sinceDate){
  const since = new Date(sinceDate).getTime(); let ms = 0;
  state.logs.forEach(l=>{ if(l.activity!==activityName || !l.endISO) return; if(new Date(l.startISO).getTime() < since) return; ms += (new Date(l.endISO) - new Date(l.startISO)); });
  return ms/3600000;
}
function weekAgoISO(){ const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString(); }
function weeklyStudyHours(){ return hoursByActivityInRange('Study', weekAgoISO()); }
function todayStudyHours(){ return (activityDaySummary().byActivity.Study || 0)/3600000; }
function sleepLogsInRange(days){ const since = Date.now() - days*DAY_MS; return state.logs.filter(l=>l.activity==='Sleep' && l.endISO && new Date(l.startISO).getTime()>=since); }
function lastNightSleepMs(){ const sleeps = state.logs.filter(l=>l.activity==='Sleep' && l.endISO).sort((a,b)=>new Date(b.endISO)-new Date(a.endISO)); return sleeps.length ? (new Date(sleeps[0].endISO)-new Date(sleeps[0].startISO)) : null; }
function sleepStats7d(){
  const logs = sleepLogsInRange(7);
  const totalMs = logs.reduce((s,l)=>s+(new Date(l.endISO)-new Date(l.startISO)),0);
  const avgMs = logs.length ? totalMs/logs.length : 0;
  const targetMs = 7*3600000;
  const debtMs = Math.max(0, (targetMs*7) - totalMs);
  const trend = last7Dates().map(d=>{
    const dayLogs = state.logs.filter(l=>l.activity==='Sleep' && l.endISO && l.startISO.slice(0,10)===d);
    const ms = dayLogs.reduce((s,l)=>s+(new Date(l.endISO)-new Date(l.startISO)),0);
    return {date:d, hours: ms/3600000};
  });
  return {avgMs, debtMs, trend, count:logs.length};
}

/* ---------- MAIN MISSION / SMART SAVINGS ---------- */
function mainMissionGoal(){
  if(state.mission.goalId){ const g = state.goals.find(g=>g.id===state.mission.goalId); if(g) return g; }
  return state.goals.find(g=>!/done/i.test(g.status || '')) || null;
}
function dailySavingsRate(days){
  const since = today.length ? null : null;
  const dates = []; for(let i=days-1;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); dates.push(localDateKey(d)); }
  const recent = state.finance.filter(f=>dates.includes(f.date));
  const net = recent.reduce((s,f)=> s + (f.type==='income'? f.amount : -f.amount), 0);
  return net/days;
}
function missionForecast(g){
  if(!g || g.category!=='Savings' || (g.tracking && g.tracking!=='number') || Number(g.start || 0)!==0) return null;
  const remaining = Math.max(0, g.target - g.current);
  if(remaining<=0) return { done:true };
  let dailyTarget, weeklyTarget, etaText;
  if(g.deadline){
    const days = Math.max(1, daysUntil(g.deadline));
    dailyTarget = remaining/days; weeklyTarget = dailyTarget*7;
    etaText = `${days} day${days===1?'':'s'} to deadline`;
  } else {
    const rate = dailySavingsRate(14);
    if(rate>0){
      const days = Math.ceil(remaining/rate);
      const eta = new Date(); eta.setDate(eta.getDate()+days);
      dailyTarget = rate; weeklyTarget = rate*7;
      etaText = `On pace for ${eta.toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})}`;
    } else {
      dailyTarget = remaining/90; weeklyTarget = dailyTarget*7;
      etaText = `No savings trend yet — suggested pace shown (90-day default)`;
    }
  }
  return { remaining, dailyTarget, weeklyTarget, etaText, done:false };
}

/* ---------- PHASE / COACH ---------- */
function currentPhase(){
  const h = new Date().getHours() + new Date().getMinutes()/60;
  if(h>=17.5 || h<2.5) return {icon:'🌙', label:'Work Shift'};
  if(h>=2.5 && h<9.5) return {icon:'📚', label:'Growth Window'};
  return {icon:'😴', label:'Sleep Window'};
}
function computeMission(){
  const openGoals = state.goals.filter(g=>g.status!=='done' && g.deadline).sort((a,b)=> new Date(a.deadline) - new Date(b.deadline));
  if(openGoals.length){
    const g = openGoals[0]; const days = daysUntil(g.deadline);
    if(days>=0) return `Focus on <b>${esc(g.name)}</b> — ${days} day${days===1?'':'s'} to deadline.`;
  }
  const studyWeek = weeklyStudyHours();
  if(studyWeek < 2) return `Only <b>${studyWeek.toFixed(1)}h</b> of study this week — squeeze in a session today.`;
  const pendingEdu = state.education.find(e=>e.status!=='Done');
  if(pendingEdu) return `Push forward on <b>${esc(pendingEdu.name)}</b> — status: ${pendingEdu.status}.`;
  return `No urgent deadlines. Good day to build a skill or read Quran.`;
}
function computeSuggestion(){
  const sleepMs = lastNightSleepMs();
  const prayerToday = countPrayersToday();
  const studyWeek = weeklyStudyHours();
  const hour = new Date().getHours();
  if(sleepMs !== null && sleepMs < 5.5*3600000) return "Sleep debt is building — prioritize rest before anything else today.";
  if(prayerToday < 5 && hour>=21) return "A few prayers are still open today — don't let the day close without them.";
  if(studyWeek < 2) return "Study time is low this week — even 30 minutes on Maths moves the needle.";
  if(!todayFinance().length && new Date().getDate()<=3) return "New month — log your income so the dashboard stays accurate.";
  return "You're on track. Keep the streak going.";
}

/* ---------- HEALTH SCORE ---------- */
function healthScore(){
  const dates = last7Dates();
  const recent = state.checkins.filter(c=>dates.includes(c.date));
  if(!recent.length) return null;
  const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
  const scores = [];
  scores.push(avg(recent.map(c=>c.energy))*10);
  const sleep7 = sleepStats7d();
  if(sleep7.count) scores.push(Math.min(100, (sleep7.avgMs/(7*3600000))*100));
  const waterVals = recent.filter(c=>c.water).map(c=>c.water);
  if(waterVals.length) scores.push(Math.min(100, avg(waterVals)/2000*100));
  const exVals = recent.filter(c=>c.exercise).map(c=>c.exercise);
  if(exVals.length) scores.push(Math.min(100, avg(exVals)/30*100));
  const headacheDays = recent.filter(c=>c.headache).length;
  scores.push(100 - (headacheDays/recent.length)*100);
  return Math.round(avg(scores));
}

/* ---------- SVG helpers ---------- */
function circularProgress(pct, size, strokeColor, label, sub){
  const r = (size-14)/2, cx=size/2, cy=size/2, c = 2*Math.PI*r;
  const dash = Math.max(0, Math.min(1,pct/100)) * c;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1B2740" stroke-width="9"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${dash} ${c}" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy-2}" text-anchor="middle" fill="#E8EAF0" font-size="${size*0.16}" font-family="Space Grotesk" font-weight="700">${label}</text>
    ${sub?`<text x="${cx}" y="${cy+16}" text-anchor="middle" fill="#8B93A7" font-size="${size*0.075}">${sub}</text>`:''}
  </svg>`;
}

// One progress calculation shared by goal cards and the main-focus dashboard.
function goalPercent(g){
 if(/done/i.test(g.status || ''))return 100;
 if(g.tracking==='completion')return 0;
 if(g.tracking==='checklist')return g.steps?.length ? Math.round(g.steps.filter(s=>s.done).length/g.steps.length*100):0;
 const start=Number(g.start || 0),target=Number(g.target),current=goalCurrentValue(g);
 return Number.isFinite(target)&&target!==start?Math.max(0,Math.min(100,Math.round((current-start)/(target-start)*100))):0;
}
function goalProgressText(g){
 if(g.tracking==='completion')return /done/i.test(g.status || '')?'Completed':'Not completed yet';
 if(g.tracking==='checklist')return (g.steps || []).filter(s=>s.done).length+' / '+(g.steps || []).length+' steps';
 return goalCurrentValue(g).toLocaleString(undefined,{maximumFractionDigits:2})+' / '+Number(g.target || 0).toLocaleString()+' '+(g.unit || (g.category==='Savings'?'PKR':'units'));
}
