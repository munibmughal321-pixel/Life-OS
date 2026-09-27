// Shared feedback, form labels, and accessible dialog behavior.
let toastTimer;
let modalTrigger;
function showToast(message){
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}
function enhanceControls(container){
  container.querySelectorAll('.field').forEach(field => {
    const label = field.querySelector('label');
    const input = field.querySelector('input, select, textarea');
    if(label && input?.id) label.htmlFor = input.id;
  });
  container.querySelectorAll('[onclick]:not(button):not(a):not(input):not(select):not(textarea)').forEach(control => {
    control.setAttribute('role','button');
    control.tabIndex = 0;
    control.onkeydown = event => {
      if(event.target === control && (event.key === 'Enter' || event.key === ' ')){
        event.preventDefault(); control.click();
      }
    };
  });
}
function showModal(html){
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modalBody');
  if(!backdrop.classList.contains('open')) modalTrigger = document.activeElement;
  modal.innerHTML = '<button class="dialog-close" aria-label="Close dialog" onclick="closeModal()">×</button>' + html;
  enhanceControls(modal);
  const title = modal.querySelector('.modal-title');
  if(title){ title.id = 'dialogTitle'; modal.setAttribute('aria-labelledby',title.id); }
  else modal.removeAttribute('aria-labelledby');
  backdrop.classList.add('open');
  document.querySelectorAll('#root > :not(.modal-backdrop):not(.toast)').forEach(element => element.inert = true);
  document.body.classList.add('dialog-open');
  (modal.querySelector('input, select, textarea') || modal.querySelector('button') || modal).focus();
}
function closeModal(){
  document.getElementById('modalBackdrop').classList.remove('open');
  document.querySelectorAll('#root > [inert]').forEach(element => element.inert = false);
  document.body.classList.remove('dialog-open');
  if(modalTrigger?.isConnected) modalTrigger.focus();
  else document.getElementById('main').focus();
}
document.addEventListener('keydown', event => {
  if(!document.getElementById('modalBackdrop').classList.contains('open')) return;
  if(event.key === 'Escape'){ event.preventDefault(); closeModal(); }
  if(event.key !== 'Tab') return;
  const controls = [...document.getElementById('modalBody').querySelectorAll('button, input, select, textarea, [tabindex="0"]')]
    .filter(element => !element.disabled && element.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if(event.shiftKey && document.activeElement === first){event.preventDefault(); last?.focus();}
  else if(!event.shiftKey && document.activeElement === last){event.preventDefault(); first?.focus();}
});

// A second click during a pending save must not submit the same form twice.
document.addEventListener('click',event=>{
  if(typeof pendingWrites!=='undefined' && pendingWrites>0 && event.target.closest('button,[onclick]')){
    event.preventDefault();event.stopImmediatePropagation();
  }
},true);
document.addEventListener('submit',event=>{
  if(typeof pendingWrites!=='undefined' && pendingWrites>0){event.preventDefault();event.stopImmediatePropagation();}
},true);
