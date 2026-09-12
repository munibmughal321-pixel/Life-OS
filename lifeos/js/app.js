// Application rendering, navigation, and initialization
/* ---------- NAV / RENDER ---------- */
function render(){
  renderHeader();
  if(currentScreen==='dashboard') renderDashboard();
  else if(currentScreen==='activities') renderActivities();
  else if(currentScreen==='growth') renderGrowth();
  else if(currentScreen==='finance') renderFinance();
  else if(currentScreen==='me') renderMe();
  else if(currentScreen==='deen') renderDeen();
  if(currentScreen!=='deen') renderArc();
}
function goToScreen(name){
  currentScreen = name;
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.dataset.screen===name));
  render();
}
document.querySelectorAll('.navbtn').forEach(btn=>{ btn.addEventListener('click', ()=> goToScreen(btn.dataset.screen)); });
document.getElementById('modalBackdrop').addEventListener('click', (e)=>{ if(e.target.id==='modalBackdrop') closeModal(); });

(async function init(){
  await loadAll();
  render();
  setInterval(render, 60000);
})();
