// Shared controls for Learning, Skills and Vault. Stored collection names stay
// unchanged so existing records remain available after the redesign.
const skillCategories = {
 Technology:['Coding','Spreadsheets','Shopify','Data analysis'],
 Communication:['Public speaking','Writing','Listening','Negotiation'],
 Languages:['English conversation','Arabic reading','Language learning'],
 Creative:['Drawing','Photography','Design','Music'],
 'Business and career':['Sales','Customer service','Leadership','Interviewing'],
 'Everyday life':['Cooking','Budgeting','Organization','Basic repairs'],
 'Movement and sport':['Swimming','Football','Mobility'],
 Custom:[]
};
const learningPaths=['School or college','University','Online courses or certifications','Independent learning','Professional training','Just exploring'];
const learningTypes=['Course','Book','School subject','Workshop','Certification','Project','Language','Exam','Other'];
const vaultTypes=['Note','Idea','Link','Checklist','Learning summary'];
const libraryFilters={education:'',skills:'',vault:''};
let vaultView='active';
function libraryInput(id,label,value='',type='text',extra=''){
 return '<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></div>';
}
function libraryText(id,label,value=''){
 return '<div class="field"><label for="'+id+'">'+label+'</label><textarea id="'+id+'" rows="4" maxlength="20000">'+esc(value)+'</textarea></div>';
}
function librarySelect(id,label,values,selected){
 const choices=[...values];if(selected && !choices.includes(selected))choices.push(selected);
 return '<div class="field"><label for="'+id+'">'+label+'</label><select id="'+id+'">'+choices.map(v=>'<option '+(v===selected?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></div>';
}
function libraryValue(id){return document.getElementById(id).value.trim();}
function safeLibraryURL(value){
 if(!value)return '';
 try{const url=new URL(value);if(['http:','https:'].includes(url.protocol))return url.href;}catch{}
 throw Error('Use a full http:// or https:// link.');
}
function libraryForm(title,html,onSave,onDelete){
 showModal('<div class="modal-title">'+title+'</div><form id="libraryForm">'+html+'<p id="libraryError" role="alert"></p><div class="modal-actions">'+(onDelete?'<button type="button" class="btn btn-danger" id="libraryDelete">Delete</button>':'<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>')+'<button type="submit" class="btn btn-gold">Save</button></div></form>');
 document.getElementById('libraryForm').onsubmit=async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;
  try{if([...document.querySelectorAll("#libraryForm [required]")].some(input=>!input.value.trim()))throw Error("Fill in the required fields.");if(await onSave()){closeModal();render();showToast('Saved on this device.');}else document.getElementById('libraryError').textContent=storageError || 'Could not save.';}
  catch(error){document.getElementById('libraryError').textContent=error.message;}
  finally{button.disabled=false;}
 };
 if(onDelete)document.getElementById('libraryDelete').onclick=async()=>{
  if(!confirm('Delete this entry?'))return;
  if(await onDelete()){closeModal();render();}else document.getElementById('libraryError').textContent=storageError;
 };
}
async function storeLibraryEntry(key,id,data){
 const item=id?state[key].find(x=>x.id===id):{id:uid()};
 if(!item)throw Error('This entry no longer exists. Close and reopen this form.');
 Object.assign(item,data);if(!id)state[key].push(item);
 return save(key);
}
async function deleteLibraryEntry(key,id){
 state[key]=state[key].filter(x=>x.id!==id);return save(key);
}
function libraryHeader(section,title,description,action,label){
 return '<div class="library-heading"><div><h2>'+title+'</h2><p>'+description+'</p></div><button class="btn btn-gold" onclick="'+action+'">'+label+'</button></div>'+libraryInput('librarySearch','Search '+title,libraryFilters[section],'search','oninput="filterLibrary(this.value)" placeholder="Search by title, topic or tags"')+'<div id="libraryResults">'+libraryResults(section)+'</div>';
}
function filterLibrary(value){
 libraryFilters[growthSub]=value;
 document.getElementById('libraryResults').innerHTML=libraryResults(growthSub);
}
function libraryResults(section){
 const query=libraryFilters[section].toLowerCase();
 const key=section==='education'?'education':section==='vault'?'notes':'skills';
 const records=state[key].filter(item=>JSON.stringify(item).toLowerCase().includes(query));
 if(section==='education')records.sort((a,b)=>Number(a.status==='Done')-Number(b.status==='Done') || Number(b.status==='In Progress')-Number(a.status==='In Progress') || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
 const list=section==='vault'?records.filter(n=>vaultView==='all' || (vaultView==='archived'?!!n.archived:!n.archived)).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)):records;
 if(!list.length)return '<div class="card empty"><strong>'+ (query?'No matching entries.':section==='education'?'Make room for something new.':section==='skills'?'What would you like to get better at?':'A place for your next idea.')+'</strong><span>'+(query?'Try a different search.':'Add your first entry using the button above.')+'</span></div>';
 return '<div class="library-grid">'+list.map(item=>section==='education'?learningCard(item):section==='skills'?skillCard(item):vaultCard(item)).join('')+'</div>';
}
function learningCard(item){
 const total=Number(item.total || 0),done=Number(item.completed || 0);
 return '<article class="card library-card"><span class="library-kicker">'+esc(item.type || 'Learning')+'</span><h3>'+esc(item.name)+'</h3><p>'+esc(item.status || 'Pending')+(item.deadline?' · Due '+esc(item.deadline):'')+'</p>'+(total?'<progress max="'+total+'" value="'+done+'" aria-label="Learning progress"></progress><p>'+done+' / '+total+' '+esc(item.progressUnit || 'lessons')+'</p>':'')+'<div class="library-actions"><button class="btn btn-outline btn-sm" onclick="openEducationModal(&quot;'+esc(item.id)+'&quot;)">Review learning</button>'+librarySourceLink(item.source)+'</div></article>';
}
function librarySourceLink(value){
 try{const url=safeLibraryURL(value);return url?'<a class="section-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Open resource ↗</a>':'';}catch{return '';}
}
function renderEducationList(){
 const paths=state.profile.learningPaths || [];
 const academic=state.profile.academicTools ?? state.courses.length>0;
 return '<details class="card library-settings"><summary>Learning preferences</summary><p>Choose any paths that fit you. All learning types remain available.</p><div class="chip-row">'+learningPaths.map((path,index)=>'<label class="goal-step"><input type="checkbox" id="learningPath'+index+'" '+(paths.includes(path)?'checked':'')+'>'+esc(path)+'</label>').join('')+'</div><label class="goal-step"><input type="checkbox" id="academicTools" '+(academic?'checked':'')+'>Show academic tools (GPA and graded courses)</label><button class="btn btn-outline" onclick="saveLearningPreferences()">Save preferences</button></details>'+libraryHeader('education','Learning','Courses, books, classes and independent exploration.','openEducationModal()','Add learning')+(academic?'<details class="library-academic"><summary>Academic tools · '+state.courses.length+' graded courses</summary>'+renderAcademicTools()+'</details>':'');
}
async function saveLearningPreferences(){
 state.profile.learningPaths=learningPaths.filter((_,index)=>document.getElementById('learningPath'+index).checked);
 state.profile.academicTools=document.getElementById('academicTools').checked;
 if(await save('profile')){render();showToast('Learning preferences saved.');}
}
function openEducationModal(id){
 const item=state.education.find(x=>x.id===id);
 libraryForm(item?'Edit learning':'Add learning',
  libraryInput('eduName','What are you learning?',item?.name,'text','required maxlength="120" placeholder="English course, cooking basics, a book…"')+
  librarySelect('eduType','Learning type',learningTypes,item?.type || suggestedLearningType())+
  librarySelect('eduStatus','Status',['Pending','In Progress','Done'],item?.status || 'Pending')+
  libraryInput('eduSource','Resource link (optional)',item?.source,'url')+
  '<details class="library-details" '+(item?.total?'open':'')+'><summary>Track chapters, lessons or milestones</summary>'+
  librarySelect('eduUnit','Progress unit',['lessons','chapters','pages','milestones'],item?.progressUnit || ((item?.type || suggestedLearningType())==='Book'?'chapters':'lessons'))+
  '<div class="field-row">'+libraryInput('eduCompleted','Completed',item?.completed ?? 0,'number','min="0" step="1"')+libraryInput('eduTotal','Total (optional)',item?.total || '','number','min="1" step="1"')+'</div></details>'+
  libraryInput('eduDeadline','Deadline (optional)',item?.deadline,'date')+libraryText('eduNotes','Notes',item?.notes),
  ()=>{
   const completed=Number(libraryValue('eduCompleted')),total=Number(libraryValue('eduTotal'));
   if(!Number.isInteger(completed)||completed<0||!Number.isInteger(total)||total<0||(total && completed>total))throw Error('Progress must be whole numbers; completed cannot exceed total.');
   return storeLibraryEntry('education',id,{name:libraryValue('eduName'),type:libraryValue('eduType'),status:libraryValue('eduStatus'),source:safeLibraryURL(libraryValue('eduSource')),completed,total,progressUnit:libraryValue('eduUnit'),deadline:libraryValue('eduDeadline'),notes:libraryValue('eduNotes')});
  },item?()=>deleteLibraryEntry('education',id):null);
}
function suggestedLearningType(){
 const paths=state.profile.learningPaths || [];
 return paths.includes('Independent learning')?'Book':paths.includes('School or college')?'School subject':paths.includes('Professional training')?'Workshop':'Course';
}
function skillCard(item){
 const practice=item.practice || [],minutes=practice.reduce((sum,p)=>sum+Number(p.minutes || 0),0);
 return '<article class="card library-card"><span class="library-kicker">'+esc(item.category || 'Custom')+'</span><h3>'+esc(item.name)+'</h3><p>'+esc(item.level || 'Not assessed')+' · Self-assessed</p><p>'+esc(item.milestone || 'Set a next milestone.')+'</p><p class="field-hint">'+practice.length+' practices · '+fmtDur(minutes*60000)+'</p><div class="library-actions"><button class="btn btn-outline btn-sm" onclick="openSkillModal(&quot;'+esc(item.id)+'&quot;)">Review skill</button><button class="btn btn-gold btn-sm" onclick="openSkillPractice(&quot;'+esc(item.id)+'&quot;)">Log practice</button></div></article>';
}
function renderSkillsList(){return libraryHeader('skills','Skills','Build abilities through practice, milestones and feedback.','openSkillModal()','Add skill');}
function skillSuggestions(){
 const category=document.getElementById('skCategory').value;
 document.getElementById('skillSuggestions').innerHTML=skillCategories[category]?.map(name=>'<button type="button" class="chip" data-skill-name="'+esc(name)+'">'+esc(name)+'</button>').join('') || '<p class="field-hint">Give your skill any name you choose.</p>';
 document.querySelectorAll('[data-skill-name]').forEach(button=>button.onclick=()=>document.getElementById('skName').value=button.dataset.skillName);
}
function openSkillModal(id){
 const item=state.skills.find(x=>x.id===id);
 libraryForm(item?'Edit skill':'Add skill',
  librarySelect('skCategory','Skill area',Object.keys(skillCategories),item ? (item.category || 'Custom') : 'Everyday life')+
  '<div id="skillSuggestions" class="chip-row"></div>'+
  libraryInput('skName','Skill name',item?.name,'text','required maxlength="120" placeholder="Cooking, public speaking, coding…"')+
  librarySelect('skLevel','Current level (your assessment)',['Not assessed','Beginner','Developing','Confident','Advanced'],item?.level || 'Not assessed')+
  libraryInput('skMilestone','Next milestone',item?.milestone,'text','maxlength="200" placeholder="Cook three meals independently"')+
  libraryText('skEvidence','Evidence or feedback',item?.evidence)+libraryText('skNotes','Notes',item?.notes)+
  '<details class="library-details"><summary>Optional legacy XP and projects</summary><p class="field-hint">Motivational history, not a measurement of mastery.</p><div class="field-row">'+libraryInput('skXp','XP',item?.xp || 0,'number','min="0" step="1"')+libraryInput('skProjects','Projects',item?.projects || 0,'number','min="0" step="1"')+'</div></details>'+
  (item?.practice?.length?'<details class="library-details"><summary>Practice history</summary>'+item.practice.slice().reverse().map(p=>'<p>'+esc(p.date)+' · '+Number(p.minutes)+' min<br>'+esc(p.note)+'</p>').join('')+'</details>':''),
  ()=>{
   const xp=Number(libraryValue('skXp')),projects=Number(libraryValue('skProjects'));
   if(![xp,projects].every(n=>Number.isInteger(n)&&n>=0))throw Error('XP and project counts must be non-negative whole numbers.');
   return storeLibraryEntry('skills',id,{name:libraryValue('skName'),category:libraryValue('skCategory'),level:libraryValue('skLevel'),milestone:libraryValue('skMilestone'),evidence:libraryValue('skEvidence'),notes:libraryValue('skNotes'),xp,projects});
  },item?()=>deleteLibraryEntry('skills',id):null);
 document.getElementById('skCategory').onchange=skillSuggestions;skillSuggestions();
}
function openSkillPractice(id){
 const item=state.skills.find(x=>x.id===id);if(!item)return;
 libraryForm('Practise '+esc(item.name),libraryInput('practiceDate','Date',today(),'date','required max="'+today()+'"')+libraryInput('practiceMinutes','Minutes','','number','required min="1" max="1440" step="1"')+libraryText('practiceNote','What did you practise or learn?'),()=>{
  const minutes=Number(libraryValue('practiceMinutes')),date=libraryValue('practiceDate');
  if(!Number.isInteger(minutes)||minutes<1||minutes>1440||!date||date>today())throw Error('Use a past or current date and 1–1440 minutes.');
  return storeLibraryEntry('skills',id,{practice:[...(item.practice || []),{id:uid(),date,minutes,note:libraryValue('practiceNote')}]});
 });
}
function vaultCard(item){
 return '<article class="card library-card"><span class="library-kicker">'+(item.pinned?'★ Pinned · ':'')+esc(item.kind || 'Note')+(item.archived?' · Archived':'')+'</span><h3>'+esc(item.title)+'</h3><p class="vault-excerpt">'+esc((item.content || '').slice(0,180))+'</p><p class="field-hint">'+esc((item.tags || []).join(' · '))+'</p>'+((item.checklist || []).length?'<p>'+item.checklist.filter(s=>s.done).length+' / '+item.checklist.length+' tasks complete</p>':'')+'<div class="library-actions"><button class="btn btn-outline btn-sm" onclick="openNoteModal(&quot;'+esc(item.id)+'&quot;)">Open entry</button>'+librarySourceLink(item.url)+'</div></article>';
}
function renderVaultList(){
 return '<div class="library-toolbar"><label for="vaultView">Show</label><select id="vaultView" onchange="vaultView=this.value;filterLibrary(document.getElementById(&quot;librarySearch&quot;).value)">'+['active','archived','all'].map(v=>'<option '+(vaultView===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div>'+libraryHeader('vault','Vault','Notes, ideas and resources. Search by text or tags.','openNoteModal()','Capture something');
}
function vaultRelatedOptions(selected){
 return '<div class="field"><label for="noteRelated">Connect to learning, a skill or goal</label><select id="noteRelated"><option value="">No connection</option>'+[['education','Learning'],['skills','Skill'],['goals','Goal']].map(([key,label])=>state[key].map(item=>'<option value="'+key+':'+esc(item.id)+'" '+(selected===key+':'+item.id?'selected':'')+'>'+label+': '+esc(item.name)+'</option>').join('')).join('')+(selected && !['education','skills','goals'].some(key=>state[key].some(item=>selected===key+':'+item.id))?'<option selected value="'+esc(selected)+'">Previously linked item (unavailable)</option>':'')+'</select></div>';
}
function openNoteModal(id){
 const item=state.notes.find(x=>x.id===id);
 libraryForm(item?'Edit Vault entry':'Capture something',
  (!item?librarySelect('noteTemplate','Start with a template',['Blank','Course notes','Book takeaways','Project idea','Practice reflection'],'Blank'):'')+
  libraryInput('noteTitle','Title',item?.title,'text','required maxlength="160"')+
  librarySelect('noteKind','Entry type',vaultTypes,item?.kind || 'Note')+
  libraryText('noteContent','Content',item?.content)+
  '<div id="noteChecklistFields">'+libraryText('noteChecklist','Checklist (one task per line)',(item?.checklist || []).map(s=>s.text).join('\n'))+'<div id="noteCheckControls"></div></div>'+
  libraryInput('noteURL','Resource URL (optional)',item?.url,'url')+
  libraryInput('noteTags','Tags (comma separated)',(item?.tags || []).join(', '),'text','maxlength="300" placeholder="cooking, ideas, English"')+
  vaultRelatedOptions(item?.related)+
  '<details class="library-details"><summary>Organize entry</summary><label class="goal-step"><input id="notePinned" type="checkbox" '+(item?.pinned?'checked':'')+'>Pin to the top</label><label class="goal-step"><input id="noteArchived" type="checkbox" '+(item?.archived?'checked':'')+'>Archive entry</label>'+libraryInput('noteCategory','Category (optional)',item?.category || '','text','maxlength="80"')+'</details>',
  ()=>{
   const tags=[...new Set(libraryValue('noteTags').split(',').map(t=>t.trim()).filter(Boolean))];
   return storeLibraryEntry('notes',id,{title:libraryValue('noteTitle'),kind:libraryValue('noteKind'),content:libraryValue('noteContent'),url:safeLibraryURL(libraryValue('noteURL')),tags,related:libraryValue('noteRelated'),pinned:document.getElementById('notePinned').checked,archived:document.getElementById('noteArchived').checked,category:libraryValue('noteCategory'),date:item?.date || today(),updatedAt:new Date().toISOString(),checklist:[...document.querySelectorAll('[data-note-task]')].map(input=>({text:input.dataset.noteTask,done:input.checked}))});
  },item?()=>deleteLibraryEntry('notes',id):null);
 const checked=new Set((item?.checklist || []).filter(s=>s.done).map(s=>s.text));
 const updateTasks=()=>{
  document.querySelectorAll('[data-note-task]').forEach(input=>input.checked?checked.add(input.dataset.noteTask):checked.delete(input.dataset.noteTask));
  const tasks=[...new Set(libraryValue('noteChecklist').split('\n').map(t=>t.trim()).filter(Boolean))];
  document.getElementById('noteCheckControls').innerHTML=tasks.map(text=>'<label class="goal-step"><input type="checkbox" data-note-task="'+esc(text)+'" '+(checked.has(text)?'checked':'')+'>'+esc(text)+'</label>').join('');
 };
 document.getElementById('noteChecklist').oninput=updateTasks;updateTasks();
 const toggle=()=>document.getElementById('noteChecklistFields').hidden=libraryValue('noteKind')!=='Checklist';
 document.getElementById('noteKind').onchange=toggle;toggle();
 if(!item)document.getElementById('noteTemplate').onchange=()=>{
  const templates={'Course notes':'Topic:\nKey ideas:\nQuestions:\nNext action:','Book takeaways':'Book:\nMain takeaway:\nHow I will apply it:','Project idea':'Problem:\nWho it helps:\nFirst small step:','Practice reflection':'What I tried:\nWhat improved:\nWhat to practise next:'};
  if(libraryValue('noteContent') && !confirm('Replace the current content with this template?'))return;
  document.getElementById('noteContent').value=templates[libraryValue('noteTemplate')] || '';
 };
}
