// Onboarding preferences only. Tracker records and credentials use separate systems.
window.LifeOSPreferences = (() => {
  const key = 'lifeos.preferences.v1';
  const interests = [
    ['focus', 'Focus & time', 'Make space for work, study and rest.', '◷'],
    ['learning', 'Learning', 'Build skills and stay curious.', '▥'],
    ['projects', 'Projects & goals', 'Turn a big idea into smaller steps.', '↗'],
    ['finance', 'Everyday money', 'Organize income, expenses and savings.', '◒'],
    ['wellbeing', 'Wellbeing & reflection', 'Check in with yourself and your day.', '✳'],
    ['deen', 'Deen & intention', 'Make room for spiritual routines.', '☾']
  ];
  const priorities = [
    ['day', 'Organize my day', 'Choose a focus and start one activity.'],
    ['learn', 'Learn something new', 'Pick a skill to work on.'],
    ['project', 'Move a project forward', 'Break a project into useful steps.'],
    ['consistency', 'Build consistency', 'Choose a manageable routine.'],
    ['money', 'Understand my spending', 'Review the money coming in and going out.'],
    ['balance', 'Make time for reflection', 'Pause and check in with yourself.']
  ];
  const times = [['10','10 minutes'],['20','20 minutes'],['30','30 minutes'],['later',"I'll decide later"]];
  function validate(value){
    return value && value.version === 1 && Array.isArray(value.interests) && value.interests.length > 0 &&
      value.interests.length <= interests.length && new Set(value.interests).size === value.interests.length &&
      value.interests.every(id => interests.some(item => item[0] === id)) &&
      priorities.some(item => item[0] === value.priority) && times.some(item => item[0] === value.time);
  }
  function read(){
    try { const raw = localStorage.getItem(key); if(!raw) return {value:null};
      const value = JSON.parse(raw); return validate(value) ? {value} : {value:null,error:'Saved preferences could not be read. You can set them up again.'};
    } catch { return {value:null,error:'Browser preferences are unavailable. You can still explore LifeOS.'}; }
  }
  function save(value){
    if(!validate(value)) return {ok:false,error:'Please finish all three questions.'};
    try { localStorage.setItem(key, JSON.stringify({version:1,interests:value.interests,priority:value.priority,time:value.time}));return {ok:true}; }
    catch { return {ok:false,error:'This browser could not save your preferences. Allow site storage and try again, or continue without saving.'}; }
  }
  function reset(){try{localStorage.removeItem(key);return {ok:true};}catch{return {ok:false,error:'Preferences could not be reset. Check browser storage permissions.'};}}
  return {interests,priorities,times,read,save,reset};
})();
