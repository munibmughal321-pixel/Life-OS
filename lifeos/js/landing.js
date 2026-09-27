const steps=[
 ['↗','Big ideas. Small next steps.','Learn a language, finish a project, build a routine. Define progress in a way that fits your life.','My next milestone','One step at a time','35%'],
 ['◷','A little focus goes a long way.','Choose an activity and a finish time. Give the next part of your day a clear intention.','A focused study session','25 minutes','65%'],
 ['✦','Look back. Move forward.','Review what you recorded, capture something you learned and choose a next step that feels achievable.','Today’s reflection','One thing I learned','100%']
];
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-step]').forEach(other=>{const active=other===button;other.classList.toggle('active',active);other.setAttribute('aria-pressed',String(active));});
 const [symbol,title,description,task,value,progress]=steps[Number(button.dataset.step)];
 for(const [id,text] of Object.entries({stepSymbol:symbol,stepTitle:title,stepDescription:description,stepTask:task,stepValue:value}))document.getElementById(id).textContent=text;
 document.getElementById('stepProgress').style.width=progress;
}));
