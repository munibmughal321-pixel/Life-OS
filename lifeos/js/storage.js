// Persistence and data migration
async function loadAll(){
  for(const k of STORAGE_KEYS){
    try{ const r = await window.storage.get(k, false); if(r && r.value) state[k] = JSON.parse(r.value); }
    catch(e){ /* not found, keep default */ }
  }
  migrateLegacySavings();
  state.skills.forEach(s=>{ if(s.xp===undefined) s.xp = 0; });
}
async function save(key){
  try{ await window.storage.set(key, JSON.stringify(state[key]), false); }
  catch(e){ console.error("save failed", key, e); showToast("Couldn't save — try again"); }
}
function migrateLegacySavings(){
  if(state.profile && state.profile.savingsGoal && !state.goals.some(g=>g.name==='Laptop')){
    const g = {id: uid(), name:"Laptop", category:"Savings", target: state.profile.savingsGoal, current: state.profile.savingsCurrent||0, deadline:"", status:"progress"};
    state.goals.push(g);
    state.mission.goalId = g.id;
    delete state.profile.savingsGoal; delete state.profile.savingsCurrent;
    save('goals'); save('profile'); save('mission');
  }
}
