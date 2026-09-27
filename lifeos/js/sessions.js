// Session records are browser-local. Cloud sync and recurring schedules are separate work.
const SESSION_KEY = 'lifeos.sessions.v1';
let sessionStoreError = '';
let sessionAudio;
let sessionTickBusy = false;
function validSession(log){
 return log && typeof log.id==='string' && /^[a-zA-Z0-9_-]+$/.test(log.id) && ACTIVITY_TYPES.some(a=>a.key===log.activity) &&
  Number.isFinite(Date.parse(log.startISO)) && (!log.endISO || (Number.isFinite(Date.parse(log.endISO)) && Date.parse(log.endISO)>=Date.parse(log.startISO))) &&
  (!log.plannedEndISO || (Number.isFinite(Date.parse(log.plannedEndISO)) && Date.parse(log.plannedEndISO)>Date.parse(log.startISO)));
}
function localDateTime(date){
 const pad=n=>String(n).padStart(2,'0');
 return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes());
}
function startActivity(name, goalId){
 if(!ACTIVITY_TYPES.some(a=>a.key===name))return;
 if(activeLog()){showToast('Check out your current activity first.');return;}
 const minutes=name==='Sleep'?480:name==='Work'?60:25;
 showModal('<div class="modal-title">Plan your '+esc(name.toLowerCase())+' session</div><p class="dialog-description">Nothing starts until you confirm.</p><form id="sessionSetup"><div class="field"><label for="sessionMode">Session timing</label><select id="sessionMode"><option value="scheduled">Finish at a specific date and time</option><option value="open">Open-ended — I will check out</option></select></div><div class="field" id="sessionEndField"><label for="sessionEnd">End date and time (your device timezone)</label><input type="datetime-local" id="sessionEnd" value="'+localDateTime(new Date(Date.now()+minutes*60000))+'"><div class="chip-row session-presets"><button type="button" data-minutes="25">25 min</button><button type="button" data-minutes="60">1 hour</button><button type="button" data-minutes="480">8 hours</button><button type="button" data-minutes="1440">Tomorrow</button></div></div><div class="field"><label for="sessionIntention">What would you like to do? (optional)</label><input id="sessionIntention" maxlength="180" placeholder="One small intention for this session"></div>'+sessionGoalField(goalId)+'<label class="session-option"><input id="sessionSound" type="checkbox"> Play a short end sound</label><button type="button" class="btn btn-outline" id="testSessionSound">Test reminder sound</button><button type="button" class="btn btn-outline" id="enableSessionNotifications">Enable browser notifications</button><p id="notificationStatus" class="field-hint">Optional. Notifications depend on browser permission and support.</p><p class="field-hint">Sessions are saved in this browser. Keep LifeOS open for timely reminders. Closed or sleeping devices cannot be used as reliable alarms; overdue sessions finish when you return.</p><p id="sessionSetupError" role="alert"></p><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-gold" type="submit">Start session</button></div></form>');
 const mode=document.getElementById('sessionMode'),end=document.getElementById('sessionEnd');
 mode.onchange=()=>{document.getElementById('sessionEndField').hidden=mode.value==='open';};
 document.querySelectorAll('[data-minutes]').forEach(button=>button.onclick=()=>end.value=localDateTime(new Date(Date.now()+Number(button.dataset.minutes)*60000)));
 document.getElementById('testSessionSound').onclick=async()=>{
  try{sessionAudio ||= new (window.AudioContext || window.webkitAudioContext)();await sessionAudio.resume();soundSessionEnd();}
  catch{document.getElementById('notificationStatus').textContent='Sound is unavailable in this browser. In-app reminders remain available.';}
 };
 let notify=false;
 document.getElementById('enableSessionNotifications').onclick=async()=>{
  const status=document.getElementById('notificationStatus');
  if(!('Notification' in window) || !window.isSecureContext){status.textContent='Browser notifications are unavailable here. In-app reminders still work.';return;}
  try{const permission=await Notification.requestPermission();notify=permission==='granted';status.textContent=notify?'Browser notifications enabled for this session.':'Notifications were not allowed. In-app reminders still work.';}
  catch{status.textContent='This browser could not enable notifications. In-app reminders still work.';}
 };
 document.getElementById('sessionSetup').onsubmit=async event=>{
  event.preventDefault();const error=document.getElementById('sessionSetupError');const now=Date.now();
  const scheduled=mode.value==='scheduled';const finish=scheduled?new Date(end.value).getTime():null;
  if(scheduled && (!Number.isFinite(finish) || finish<=now || finish-now>31*86400000)){error.textContent='Choose an end time in the future, within the next 31 days.';return;}
  const sound=document.getElementById('sessionSound').checked;
  if(sound){try{sessionAudio ||= new (window.AudioContext || window.webkitAudioContext)();await sessionAudio.resume();}catch{/* In-app reminders remain available. */}}
  const intention=document.getElementById('sessionIntention').value.trim();
  const goalId=document.getElementById('sessionGoal').value || null;
  const button=event.submitter;button.disabled=true;
  const outcome=await sessionTransaction(records=>{
   if(records.some(l=>!l.endISO))return false;
   records.push({id:uid(),activity:name,startISO:new Date(now).toISOString(),endISO:null,plannedEndISO:scheduled?new Date(finish).toISOString():null,intention,goalId,sound,notify,reviewPending:false});return true;
  });
  if(!outcome.ok || !outcome.result){button.disabled=false;error.textContent=outcome.ok?'Another session is already running.':sessionStoreError;return;}
  closeModal();render();updateSessionPanel();showToast('Session started.');
 };
}
function nextSessionSuggestion(log){
 if(log.activity==='Sleep')return log.quality && log.quality<=2?'Start gently: pause and choose a light next activity.':'Take a moment to wake up and choose your first priority.';
 if(['Study','Work','Quran'].includes(log.activity))return 'Consider a short break before your next focused session.';
 if(log.activity==='Workout')return 'Take a comfortable cool-down break before your next activity.';
 if(['Gaming','Social Media'].includes(log.activity))return 'Consider a screen break, or make time for a personal goal.';
 return 'Pause for a moment, then choose what you want to make time for next.';
}
function soundSessionEnd(){
 if(!sessionAudio || sessionAudio.state!=='running')return;
 try{const oscillator=sessionAudio.createOscillator(),gain=sessionAudio.createGain();oscillator.connect(gain);gain.connect(sessionAudio.destination);oscillator.frequency.value=660;gain.gain.setValueAtTime(.1,sessionAudio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,sessionAudio.currentTime+.6);oscillator.start();oscillator.stop(sessionAudio.currentTime+.6);}catch{}
}
function notifySessionEnd(log){
 if(log.sound)soundSessionEnd();
 if(log.notify && 'Notification' in window && Notification.permission==='granted'){
  try{const notification=new Notification('LifeOS session complete',{body:log.activity+' is complete. Your check-out review is ready.',tag:'lifeos-'+log.id});notification.onclick=()=>{window.focus();notification.close();};}catch{/* Mobile/unsupported browsers retain the in-app reminder. */}
 }
}
async function finishSession(id,automatic=false){
 const outcome=await sessionTransaction(records=>{
  const log=records.find(item=>item.id===id);if(!log || log.endISO)return null;
  const due=log.plannedEndISO && Date.parse(log.plannedEndISO)<=Date.now();
  if(automatic && !due)return null;
  log.endISO=due?log.plannedEndISO:new Date().toISOString();log.endedAutomatically=Boolean(due);log.reviewPending=true;
  return {...log};
 });
 if(!outcome.ok)return null;
 if(outcome.result){notifySessionEnd(outcome.result);if(!document.getElementById('modalBackdrop').classList.contains('open') && ['dashboard','activities'].includes(currentScreen))render();}
 updateSessionPanel();return outcome.result;
}
async function endActivity(id){
 const ended=await finishSession(id);
 if(ended)openSessionReview(id);
 else if(sessionStoreError)showToast(sessionStoreError);
}
function openSessionReview(id){
 const log=state.logs.find(item=>item.id===id);if(!log || !log.endISO)return;
 const sleep=log.activity==='Sleep';const label=sleep?'Sleep quality':['Study','Work','Quran'].includes(log.activity)?'How focused did you feel?':'How did the session feel?';
 showModal('<div class="modal-title">'+esc(log.activity)+' check-out</div><p class="dialog-description">Session finished at '+esc(new Date(log.endISO).toLocaleString())+'. This review is optional.</p><form id="sessionReview"><div class="field"><label for="sessionRating">'+label+'</label><select id="sessionRating"><option value="">Skip rating</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+(n===1?' — Low':n===5?' — Great':'')+'</option>').join('')+'</select></div>'+(sleep?'<div class="field"><label for="sessionHeadache">Woke up with a headache?</label><select id="sessionHeadache"><option value="">Prefer not to say</option><option value="no">No</option><option value="yes">Yes</option></select></div>':'')+'<div class="field"><label for="sessionReflection">A note for next time (optional)</label><textarea id="sessionReflection" maxlength="500"></textarea></div><p class="session-suggestion">'+esc(nextSessionSuggestion(log))+'</p><p id="reviewError" role="alert"></p><div class="modal-actions"><button type="button" class="btn btn-outline" id="skipSessionReview">Skip review</button><button class="btn btn-gold" type="submit">Finish review</button></div></form>');
 async function complete(skip){
  const rating=skip?null:Number(document.getElementById('sessionRating').value)||null;
  const note=skip?'':document.getElementById('sessionReflection').value.trim();
  const headache=sleep&&!skip?document.getElementById('sessionHeadache').value:'';
  const outcome=await sessionTransaction(records=>{const item=records.find(l=>l.id===id);if(!item)return false;item.reviewPending=false;item.reviewSkipped=skip;item.rating=rating;item.reflection=note;if(sleep){item.quality=rating;item.headache=headache===''?null:headache==='yes';}return true;});
  if(!outcome.ok){document.getElementById('reviewError').textContent=sessionStoreError;return;}
  closeModal();render();updateSessionPanel();showToast('Session review complete.');
 }
 document.getElementById('sessionReview').onsubmit=event=>{event.preventDefault();complete(false);};
 document.getElementById('skipSessionReview').onclick=()=>complete(true);
}
function updateSessionPanel(){
 const panel=document.getElementById('sessionPanel');if(!panel)return;
 const running=activeLog();
 const signature=JSON.stringify([sessionStoreError,state.logs,running, state.logs.filter(log=>log.reviewPending),running?Math.round((running.plannedEndISO?Date.parse(running.plannedEndISO)-Date.now():Date.now()-Date.parse(running.startISO))/60000):null]);
 if(panel.dataset.signature===signature)return;panel.dataset.signature=signature;
 panel.replaceChildren();
 if(sessionStoreError){const error=document.createElement('p');error.setAttribute('role','alert');error.textContent=sessionStoreError;panel.append(error);}
 const active=activeLog();
 if(active){const title=document.createElement('strong');title.textContent=active.activity+' session';const text=document.createElement('p');text.textContent=active.plannedEndISO?'Ends '+new Date(active.plannedEndISO).toLocaleString()+' · '+fmtDur(Math.max(0,Date.parse(active.plannedEndISO)-Date.now()))+' remaining':'Open-ended · '+fmtDur(Math.max(0,Date.now()-Date.parse(active.startISO)))+' elapsed';const end=document.createElement('button');end.type='button';end.className='btn btn-outline btn-sm';end.textContent='Check out now';end.onclick=()=>endActivity(active.id);panel.append(title,text,end);if(active.plannedEndISO){const extend=document.createElement("button");extend.className="btn btn-outline btn-sm";extend.textContent="+10 minutes";extend.onclick=()=>extendSession(active.id);panel.append(extend);}if(active.intention){const intention=document.createElement('p');intention.textContent=active.intention;panel.append(intention);}}
 const pending=state.logs.filter(log=>log.reviewPending).slice(-5).reverse();
 pending.forEach(log=>{const row=document.createElement('div');row.className='session-finished';const text=document.createElement('span');text.textContent=log.activity+' finished'+(log.endedAutomatically?' at the planned time':'')+'. '+nextSessionSuggestion(log);const review=document.createElement('button');review.type='button';review.className='btn btn-gold btn-sm';review.textContent='Review '+log.activity;review.onclick=()=>openSessionReview(log.id);row.append(text,review);panel.append(row);});
 if(!active && !pending.length){const last=state.logs.filter(log=>log.endISO).sort((a,b)=>Date.parse(b.endISO)-Date.parse(a.endISO))[0];if(last){const text=document.createElement('p');text.textContent=last.activity+' complete. '+nextSessionSuggestion(last);const choose=document.createElement('button');choose.type='button';choose.className='btn btn-outline btn-sm';choose.textContent='Choose your next activity';choose.onclick=openCheckinModal;panel.append(text,choose);}}
 panel.hidden=!panel.childElementCount;
}
async function tickSessions(){
 if(sessionTickBusy)return;sessionTickBusy=true;
 try{const active=activeLog();if(active?.plannedEndISO && Date.parse(active.plannedEndISO)<=Date.now())await finishSession(active.id,true);updateSessionPanel();}finally{sessionTickBusy=false;}
}
function initSessions(){
 updateSessionPanel();tickSessions();setInterval(tickSessions,1000);
 window.addEventListener('focus',async()=>{await restoreSessions();tickSessions();});
 document.addEventListener('visibilitychange',async()=>{if(!document.hidden){await restoreSessions();tickSessions();}});
 window.addEventListener('storage',async event=>{if(event.key===SESSION_KEY){await restoreSessions();tickSessions();}});
}
