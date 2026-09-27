// History editing is separate from the running timer and persistence.
function sessionGoalField(selected){
 return '<div class="field"><label for="sessionGoal">Linked goal (optional)</label><select id="sessionGoal"><option value="">No linked goal</option>'+state.goals.map(g=>'<option value="'+esc(g.id)+'" '+(selected===g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select><p class="field-hint">Configure linked hours or sessions in Growth → Goals.</p></div>';
}
function openActivityEditor(id){
 const log=id?state.logs.find(l=>l.id===id):null;
 if(id && (!log || !log.endISO)){showToast('Check out before editing history.');return;}
 const end=log?new Date(log.endISO):new Date(),start=log?new Date(log.startISO):new Date(end.getTime()-3600000);
 showModal('<div class="modal-title">'+(log?'Edit activity':'Log a past activity')+'</div><form id="activityEditor"><div class="field"><label for="editActivity">Activity</label><select id="editActivity">'+ACTIVITY_TYPES.map(a=>'<option '+(a.key===(log?.activity || 'Study')?'selected':'')+'>'+esc(a.key)+'</option>').join('')+'</select></div><div class="field"><label for="editStart">Start (device timezone)</label><input id="editStart" type="datetime-local" required value="'+localDateTime(start)+'"></div><div class="field"><label for="editEnd">End (device timezone)</label><input id="editEnd" type="datetime-local" required value="'+localDateTime(end)+'"></div>'+sessionGoalField(log?.goalId)+'<div class="field"><label for="editIntention">Intention or note</label><textarea id="editIntention" maxlength="180">'+esc(log?.intention || '')+'</textarea></div><p class="field-hint">The end must be in the past. Activities cannot overlap. Existing check-out reviews are preserved.</p><p id="activityEditError" role="alert"></p><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-gold" type="submit">Save activity</button></div></form>');
 document.getElementById('activityEditor').onsubmit=async event=>{
  event.preventDefault();
  const begin=new Date(document.getElementById('editStart').value).getTime(),finish=new Date(document.getElementById('editEnd').value).getTime();
  const error=document.getElementById('activityEditError');
  if(!Number.isFinite(begin)||!Number.isFinite(finish)||begin>=finish||finish>Date.now()){error.textContent='Choose a start before the end, with both in the past.';return;}
  const data={activity:document.getElementById('editActivity').value,startISO:new Date(begin).toISOString(),endISO:new Date(finish).toISOString(),goalId:document.getElementById('sessionGoal').value || null,intention:document.getElementById('editIntention').value.trim()};
  const button=event.submitter;button.disabled=true;
  const outcome=await sessionTransaction(records=>{
   const existing=id?records.find(l=>l.id===id):null;
   if(id && (!existing || !existing.endISO || JSON.stringify(existing)!==JSON.stringify(log)))return 'This activity changed elsewhere. Close and reopen the editor.';
   if(records.some(l=>l.id!==id && begin<Date.parse(l.endISO || new Date().toISOString()) && finish>Date.parse(l.startISO)))return 'This time overlaps another activity. Adjust the start or end.';
   if(existing)Object.assign(existing,data,{plannedEndISO:null,endedAutomatically:false,editedAt:new Date().toISOString()});
   else records.push({id:uid(),...data,plannedEndISO:null,manual:true,reviewPending:false});
   return '';
  });
  if(!outcome.ok || outcome.result){error.textContent=outcome.result || sessionStoreError;button.disabled=false;return;}
  closeModal();render();updateSessionPanel();showToast('Activity saved on this device.');
 };
}
function localDayBounds(date=new Date()){
 const start=new Date(date.getFullYear(),date.getMonth(),date.getDate()),end=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1);
 return [start.getTime(),end.getTime()];
}
function activityDaySummary(now=Date.now()){
 const [start,end]=localDayBounds(new Date(now));
 const spans=state.logs.map(l=>({activity:l.activity,start:Math.max(start,Date.parse(l.startISO)),end:Math.min(now,end,Date.parse(l.endISO || new Date(now).toISOString()))})).filter(l=>l.end>l.start);
 const byActivity={};spans.forEach(l=>byActivity[l.activity]=(byActivity[l.activity] || 0)+l.end-l.start);
 // Union spans so overlapping legacy entries cannot inflate total tracked time.
 let tracked=0,until=start;
 spans.sort((a,b)=>a.start-b.start).forEach(l=>{tracked+=Math.max(0,l.end-Math.max(until,l.start));until=Math.max(until,l.end);});
 return {tracked,untracked:Math.max(0,now-start-tracked),byActivity};
}
function activitySummaryHTML(){
 const summary=activityDaySummary();
 return '<div class="section-title">Today’s time</div><div class="card"><div class="row-between"><span>Tracked <strong>'+fmtDur(summary.tracked)+'</strong></span><span>Untracked so far <strong>'+fmtDur(summary.untracked)+'</strong></span></div><p class="field-hint">Local midnight to now; overnight sessions are split at midnight.</p>'+Object.entries(summary.byActivity).map(([name,ms])=>'<div class="row-between"><span>'+esc(name)+'</span><span>'+fmtDur(ms)+'</span></div>').join('')+'</div>';
}
function linkedGoalAmount(goal){
 const logs=state.logs.filter(l=>l.goalId===goal.id && l.endISO);
 if(goal.sessionProgress==='hours')return logs.reduce((sum,l)=>sum+(Date.parse(l.endISO)-Date.parse(l.startISO))/3600000,0);
 if(goal.sessionProgress==='sessions')return logs.length;
 return 0;
}
function goalCurrentValue(goal){return Number(goal.current || 0)+linkedGoalAmount(goal);}
async function extendSession(id){
 const result=await sessionTransaction(records=>{
  const log=records.find(l=>l.id===id);
  if(!log || log.endISO || !log.plannedEndISO || Date.parse(log.plannedEndISO)<=Date.now())return false;
  if(Date.parse(log.plannedEndISO)+600000-Date.parse(log.startISO)>31*86400000)return false;
  log.plannedEndISO=new Date(Date.parse(log.plannedEndISO)+600000).toISOString();return true;
 });
 updateSessionPanel();showToast(result.ok&&result.result?'Added 10 minutes.':'Could not extend this session. It may already have ended.');
}
function nextStepsHTML(){
 const goals=state.goals.filter(g=>!/done/i.test(g.status || '')).sort((a,b)=>{
  if(a.id===state.mission.goalId)return -1;
  if(b.id===state.mission.goalId)return 1;
  return (a.deadline || '9999').localeCompare(b.deadline || '9999');
 }).slice(0,3);
 return '<div class="section-title">Your priorities</div><div class="card">'+(goals.length?goals.map(g=>'<div class="row-between priority-row"><div><strong>'+esc(g.name)+'</strong><p class="field-hint">'+esc(goalProgressText(g))+(g.deadline?' · Due '+esc(g.deadline):'')+'</p></div><button class="btn btn-outline btn-sm" onclick="openGoalModal(&quot;'+esc(g.id)+'&quot;)">Review goal</button></div>').join(''):'<p>Choose a goal to give your next session a purpose.</p><button class="btn btn-outline" onclick="openGoalModal()">Set a goal</button>')+'</div>';
}
