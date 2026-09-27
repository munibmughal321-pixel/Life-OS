const preferences = window.LifeOSPreferences;
const saved = preferences.read();
const draft = saved.value ? {...saved.value,interests:[...saved.value.interests]} : {version:1,interests:[],priority:'',time:''};
let step = 0;
const questions = [
  ['What would you like to make room for?', 'Choose all that interest you. There is no need to do everything at once.', preferences.interests, 'interests', 'checkbox'],
  ['What matters most right now?', 'Pick one starting priority. You can change direction later.', preferences.priorities, 'priority', 'radio'],
  ['What feels like a manageable start?', 'Choose a daily time intention. This does not schedule notifications or start a timer.', preferences.times, 'time', 'radio']
];
const form = document.getElementById('setupForm');
const status = document.getElementById('setupStatus');
function draw(focus = true){
  status.textContent = '';
  const review = step === 3;
  document.getElementById('stepLabel').textContent = review ? 'Your starting point' : 'Step '+(step+1)+' of 3';
  document.getElementById('setupProgress').value = Math.min(step+1,3);
  const title = document.getElementById('setupTitle');
  title.textContent = review ? 'A starting point that feels like you.' : questions[step][0];
  document.getElementById('setupDescription').textContent = review ? 'Review your choices before saving them in this browser.' : questions[step][1];
  document.getElementById('setupBack').hidden = step === 0;
  document.getElementById('setupNext').textContent = review ? 'Save & open my dashboard →' : 'Continue →';
  document.getElementById('setupChoices').hidden = review;
  const reviewPanel = document.getElementById('setupReview');reviewPanel.hidden = !review;
  const grid = document.getElementById('choiceGrid');grid.replaceChildren();
  if(review){
    reviewPanel.replaceChildren();
    const selected = [
      ['Your interests',draft.interests.map(id=>preferences.interests.find(row=>row[0]===id)[1]).join(', ')],
      ['Your priority',preferences.priorities.find(row=>row[0]===draft.priority)[1]],
      ['Your starting pace',preferences.times.find(row=>row[0]===draft.time)[1]]
    ];
    selected.forEach(([label,text])=>{const item=document.createElement('div'),heading=document.createElement('h2'),body=document.createElement('p');heading.textContent=label;body.textContent=text;item.append(heading,body);reviewPanel.append(item);});
  }else{
    const [question,,options,key,type]=questions[step];document.getElementById('choiceLegend').textContent=question;
    options.forEach(([id,label,description,icon])=>{
      const wrapper=document.createElement('label');wrapper.className='setup-choice';
      const input=document.createElement('input');input.type=type;input.name=key;input.value=id;input.checked=key==='interests'?draft.interests.includes(id):draft[key]===id;
      const content=document.createElement('span');content.className='choice-content';
      const heading=document.createElement('strong');heading.textContent=label;content.append(heading);
      if(description){const detail=document.createElement('small');detail.textContent=description;content.append(detail);}
      if(icon){const symbol=document.createElement('span');symbol.className='choice-icon';symbol.setAttribute('aria-hidden','true');symbol.textContent=icon;wrapper.append(symbol);}
      input.addEventListener('change',()=>{status.textContent='';if(key==='interests')draft.interests=[...grid.querySelectorAll('input:checked')].map(item=>item.value);else draft[key]=id;});
      wrapper.append(content,input);grid.append(wrapper);
    });
  }
  if(focus)title.focus({preventScroll:true});
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  if(step<3){const key=questions[step][3];if(key==='interests'?!draft.interests.length:!draft[key]){status.textContent='Choose '+(key==='interests'?'at least one interest':'an option')+' to continue, or skip setup.';return;}step++;draw();window.scrollTo({top:0});return;}
  const result=preferences.save(draft);if(!result.ok){status.textContent=result.error;return;}
  window.location.href='dashboard.html';
});
document.getElementById('setupBack').addEventListener('click',()=>{if(step>0){step--;draw();}});
draw(false);if(saved.error)status.textContent=saved.error;
