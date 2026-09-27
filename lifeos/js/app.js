// Screen navigation stays separate from each feature's renderer.
const screenRenderers = { dashboard: renderDashboard, activities: renderActivities,
  growth: renderGrowth, finance: renderFinance, me: renderMe, deen: renderDeen };
const screenCopy = {
 dashboard:['Overview','A clear view of your day, priorities and progress.'],
 activities:['Activities','Choose your focus. Give every part of your day its space.'],
 growth:['Growth','Small steps today. Meaningful progress over time.'],
 finance:['Finance','Keep your everyday money in perspective.'],
 deen:['Deen','Make room for consistency, intention and reflection.'],
 me:['My space','Check in with yourself and shape your next chapter.']
};
function render(){
  document.getElementById('root').dataset.currentScreen = currentScreen;
  document.getElementById('screenTitle').textContent = screenCopy[currentScreen][0];
  document.getElementById('screenDescription').textContent = screenCopy[currentScreen][1];
  document.getElementById('screenNumber').textContent = String(Object.keys(screenCopy).indexOf(currentScreen)+1).padStart(2,'0') + ' / 06';
  renderHeader();
  screenRenderers[currentScreen]();
  renderPersonalization();
  enhanceControls(document.getElementById('main'));
  document.getElementById('main').setAttribute('aria-label', currentScreen);
  document.querySelectorAll('.navbtn').forEach(button => {
    const active = button.dataset.screen === currentScreen;
    button.classList.toggle('active', active);
    if(active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if(currentScreen !== 'deen') renderArc();
}
function goToScreen(name){
  if(!Object.hasOwn(screenRenderers, name)) return;
  currentScreen = name;
  render();
  document.getElementById('main').focus({preventScroll:true});
  window.scrollTo({top:0, behavior:'instant'});
}
document.querySelectorAll('.navbtn').forEach(button => {
  button.addEventListener('click', () => goToScreen(button.dataset.screen));
});
document.getElementById('modalBackdrop').addEventListener('click', event => {
  if(event.target.id === 'modalBackdrop') closeModal();
});
(async function init(){
  // Modules finish before DOMContentLoaded; wait for the account-specific database selection.
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  try{await window.LifeOSNativeReady;await window.LifeOSCloud?.ready;}catch(error){
    STORAGE_KEYS.forEach(key=>blockedCollections.add(key));reportStorage(error.message);return;
  }
  await loadAll();
  await restoreSessions();
  render();
  initSessions();
  window.dispatchEvent(new Event('lifeos-dashboard-ready'));
  window.LifeOSCloud?.start().catch(()=>{document.getElementById('syncStatus').textContent='Sync unavailable. Local data was preserved; reload to retry.';});
  // Refresh the clock, not forms: replacing main would erase unfinished input.
  setInterval(() => { renderHeader(); if(currentScreen !== 'deen') renderArc(); }, 60000);
})();
