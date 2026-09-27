// Deterministic suggestions based on explicit choices, not AI or automatic goals.
function renderPersonalization(){
 const host=document.getElementById('main');
 if(currentScreen!=='dashboard' && currentScreen!=='me')return;
 const result=LifeOSPreferences.read(),prefs=result.value;
 const card=document.createElement('section');card.className='card personalization-card';card.setAttribute('aria-label','Your LifeOS preferences');
 const eyebrow=document.createElement('p');eyebrow.className='workspace-eyebrow';eyebrow.textContent=prefs?'YOUR STARTING POINT':'MAKE LIFEOS YOURS';card.append(eyebrow);
 const title=document.createElement('h2');title.className='personalization-title';
 const description=document.createElement('p');description.className='personalization-description';
 const actions=document.createElement('div');actions.className='personalization-actions';
 if(prefs){
  const routes={day:['Start with one activity','activities',null],learn:['Choose a skill to practice','growth','skills'],project:['Break your project into steps','growth','goals'],consistency:['Choose one routine to work on','growth','goals'],money:['Review your everyday money','finance',null],balance:['Take a moment to check in','me',null]};
  const [label,screen,sub]=routes[prefs.priority];title.textContent=label;
  const interests=prefs.interests.map(id=>LifeOSPreferences.interests.find(row=>row[0]===id)[1]);
  description.textContent=(prefs.time==='later'?'Choose a pace that suits today.':'Set aside '+prefs.time+' minutes as a starting intention.')+' Your interests: '+interests.join(', ')+'.';
  if(currentScreen==='dashboard'){
   const open=document.createElement('button');open.type='button';open.className='btn btn-gold btn-sm';open.textContent='Take the first step →';
   open.addEventListener('click',()=>{if(sub)growthSub=sub;goToScreen(screen);});actions.append(open);
   const shortcuts=document.createElement('div');shortcuts.className='personalization-interests';shortcuts.setAttribute('aria-label','Your interests');
   const map={focus:['activities',null],learning:['growth','skills'],projects:['growth','goals'],finance:['finance',null],wellbeing:['me',null],deen:['deen',null]};
   prefs.interests.forEach(id=>{const button=document.createElement('button');button.type='button';button.className='chip';button.textContent=LifeOSPreferences.interests.find(row=>row[0]===id)[1];button.onclick=()=>{const [target,tab]=map[id];if(tab)growthSub=tab;goToScreen(target);};shortcuts.append(button);});card.append(title,description,shortcuts);
  }else card.append(title,description);
 }else{title.textContent='A workspace with your priorities in mind.';description.textContent=result.error || 'Choose your interests, a priority and your starting pace. Every module stays available.';card.append(title,description);}
 const edit=document.createElement('a');edit.className='preference-link';edit.href='welcome.html';edit.textContent=prefs?'Edit preferences':'Set up my preferences';actions.append(edit);
 // Reset only this feature's key: never clear tracker data or other local storage.
 if(prefs || result.error){
  const reset=document.createElement('button');reset.type='button';reset.className='btn btn-outline btn-sm';reset.textContent='Reset preferences';
  reset.onclick=()=>{if(!window.confirm('Reset your interests, priority and daily time preference on this browser? Your tracker entries will not be changed.'))return;const cleared=LifeOSPreferences.reset();if(!cleared.ok){showToast(cleared.error);return;}card.remove();renderPersonalization();showToast('Preferences reset.');};actions.append(reset);
 }
 card.append(actions);
 if(prefs){const note=document.createElement('p');note.className='personalization-note';note.textContent='Preferences remembered in this browser only. Tracker saving and cloud syncing are separate.';card.append(note);}
 host.prepend(card);
}
window.addEventListener('storage',event=>{if(event.key==='lifeos.preferences.v1' || event.key===null){document.querySelector('.personalization-card')?.remove();renderPersonalization();}});
