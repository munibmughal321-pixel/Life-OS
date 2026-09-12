// Shared UI helpers
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}
function showModal(html){ document.getElementById('modalBody').innerHTML = html; document.getElementById('modalBackdrop').classList.add('open'); }
function closeModal(){ document.getElementById('modalBackdrop').classList.remove('open'); }
