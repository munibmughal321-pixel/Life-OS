// Wallet, transactions, loans, and recurring expenses
function renderFinance(){
  const balance = walletBalance();
  const tf = todayFinance();
  const income = tf.filter(f=>f.type==='income').reduce((s,f)=>s+f.amount,0);
  const expense = tf.filter(f=>f.type==='expense').reduce((s,f)=>s+f.amount,0);
  const monthKey = today().slice(0,7);
  const mf = state.finance.filter(f=>f.date.startsWith(monthKey));
  const mIncome = mf.filter(f=>f.type==='income').reduce((s,f)=>s+f.amount,0);
  const mExpense = mf.filter(f=>f.type==='expense').reduce((s,f)=>s+f.amount,0);

  let html = `<div class="stat-grid">
    <div class="stat"><div class="stat-label">Balance</div><div class="stat-value mono">${balance.toLocaleString()}</div><div class="stat-sub">PKR</div></div>
    <div class="stat"><div class="stat-label">Today</div><div class="stat-value amount-pos" style="font-size:16px;">+${income.toLocaleString()}</div><div class="stat-sub amount-neg">-${expense.toLocaleString()}</div></div>
  </div>`;

  html += `<button class="btn btn-gold" onclick="openFinanceModal()" style="margin-bottom:14px;">＋ Add Transaction</button>`;

  html += `<div class="section-title">Monthly Summary</div><div class="card">
    <div class="row-between"><span class="muted">Income</span><span class="amount-pos" style="font-weight:600;">+${mIncome.toLocaleString()}</span></div>
    <div class="row-between" style="margin-top:6px;"><span class="muted">Expenses</span><span class="amount-neg" style="font-weight:600;">-${mExpense.toLocaleString()}</span></div>
    <div class="row-between" style="margin-top:6px;padding-top:8px;border-top:1px solid var(--line);"><span class="muted">Net</span><span style="font-weight:700;">${(mIncome-mExpense).toLocaleString()}</span></div>
  </div>`;

  html += `<div class="section-title">Recent</div><div class="card">`;
  const recent = [...state.finance].sort((a,b)=>b.id.localeCompare(a.id)).slice(0,8);
  if(recent.length===0){ html += `<div class="empty">No transactions yet.</div>`; }
  else recent.forEach(f=>{
    html += `<div class="log-row">
      <div class="log-info"><div class="log-act">${f.category||f.type}</div><div class="log-time">${f.date}${f.note?' · '+f.note:''}</div></div>
      <div class="${f.type==='income'?'amount-pos':'amount-neg'}" style="font-weight:600;">${f.type==='income'?'+':'-'}${f.amount.toLocaleString()}</div>
    </div>`;
  });
  html += `</div>`;

  html += `<div class="section-title">Loans <button class="section-link" onclick="openLoanModal()">＋ Add</button></div><div class="card">`;
  if(state.loans.length===0) html += `<div class="empty">No loans tracked.</div>`;
  else state.loans.forEach(l=>{
    html += `<div class="item-row" onclick="openLoanModal('${l.id}')">
      <div class="item-top"><span class="item-name">${l.name}</span><span class="badge ${l.settled?'status-done':'status-pending'}">${l.settled?'Settled':(l.type==='given'?'Given':'Received')}</span></div>
      <div class="item-meta">${l.amount.toLocaleString()} PKR · ${l.date}</div>
    </div>`;
  });
  html += `</div>`;

  html += `<div class="section-title">Recurring Expenses <button class="section-link" onclick="openRecurringModal()">＋ Add</button></div><div class="card">`;
  if(state.recurring.length===0) html += `<div class="empty">No recurring expenses set.</div>`;
  else state.recurring.forEach(r=>{
    html += `<div class="item-row" onclick="openRecurringModal('${r.id}')">
      <div class="item-top"><span class="item-name">${r.name}</span><span class="faint mono" style="font-size:12px;">${r.amount.toLocaleString()}</span></div>
      <div class="item-meta">${r.category} · ${r.frequency}</div>
    </div>`;
  });
  html += `</div>`;

  document.getElementById('main').innerHTML = html;
}

function openFinanceModal(){
  let html = `<div class="modal-title">Add Transaction</div>
    <div class="chip-row" style="margin-bottom:12px;">
      <button class="chip active" id="typeIncome" onclick="setFinType('income')">Income</button>
      <button class="chip" id="typeExpense" onclick="setFinType('expense')">Expense</button>
    </div>
    <div class="field"><label>Amount (PKR)</label><input type="number" id="finAmount" placeholder="0"></div>
    <div class="field"><label>Category</label><input id="finCategory" placeholder="e.g. Salary, Food, Transport"></div>
    <div class="field"><label>Note (optional)</label><input id="finNote" placeholder="..."></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-gold" onclick="addFinance()">Save</button>
    </div>`;
  showModal(html);
  window._finType = 'income';
}
function setFinType(t){
  window._finType = t;
  document.getElementById('typeIncome').classList.toggle('active', t==='income');
  document.getElementById('typeExpense').classList.toggle('active', t==='expense');
}
async function addFinance(){
  const amount = parseFloat(document.getElementById('finAmount').value);
  const category = document.getElementById('finCategory').value.trim() || 'General';
  const note = document.getElementById('finNote').value.trim();
  if(!amount || amount<=0){ showToast("Enter a valid amount"); return; }
  state.finance.push({id:uid(), type:window._finType||'income', amount, category, note, date:today()});
  await save('finance'); closeModal(); showToast("Transaction added"); render();
}

function openLoanModal(id){
  const l = id ? state.loans.find(x=>x.id===id) : null;
  let html = `<div class="modal-title">${l?'Edit':'Add'} Loan</div>
    <div class="field"><label>Name / Person</label><input id="loanName" value="${l?esc(l.name):''}" placeholder="e.g. Ahmed"></div>
    <div class="field-row">
      <div class="field"><label>Type</label>
        <select id="loanType"><option value="given" ${l&&l.type==='given'?'selected':''}>Given by me</option><option value="received" ${l&&l.type==='received'?'selected':''}>Received by me</option></select>
      </div>
      <div class="field"><label>Amount (PKR)</label><input type="number" id="loanAmount" value="${l?l.amount:''}"></div>
    </div>
    <div class="field"><label>Notes</label><input id="loanNotes" value="${l?esc(l.notes||''):''}"></div>
    <div class="chip-row" style="margin-bottom:6px;">
      <button class="chip ${l&&l.settled?'active':''}" id="loanSettled" onclick="this.classList.toggle('active')">Settled</button>
    </div>
    <div class="modal-actions">
      ${l?`<button class="btn btn-danger" onclick="deleteLoan('${l.id}')">Delete</button>`:`<button class="btn btn-outline" onclick="closeModal()">Cancel</button>`}
      <button class="btn btn-gold" onclick="saveLoan(${l?`'${l.id}'`:'null'})">Save</button>
    </div>`;
  showModal(html);
}
async function saveLoan(id){
  const name = document.getElementById('loanName').value.trim();
  const amount = parseFloat(document.getElementById('loanAmount').value);
  if(!name || !amount){ showToast("Name and amount required"); return; }
  const data = { name, type: document.getElementById('loanType').value, amount, notes: document.getElementById('loanNotes').value.trim(), settled: document.getElementById('loanSettled').classList.contains('active'), date: today() };
  if(id){ const existing = state.loans.find(l=>l.id===id); data.date = existing.date; Object.assign(existing, data); }
  else state.loans.push({id:uid(), ...data});
  await save('loans'); closeModal(); showToast("Saved"); render();
}
async function deleteLoan(id){ state.loans = state.loans.filter(l=>l.id!==id); await save('loans'); closeModal(); render(); }

function openRecurringModal(id){
  const r = id ? state.recurring.find(x=>x.id===id) : null;
  let html = `<div class="modal-title">${r?'Edit':'Add'} Recurring Expense</div>
    <div class="field"><label>Name</label><input id="recName" value="${r?esc(r.name):''}" placeholder="e.g. Internet, Rent"></div>
    <div class="field-row">
      <div class="field"><label>Amount (PKR)</label><input type="number" id="recAmount" value="${r?r.amount:''}"></div>
      <div class="field"><label>Frequency</label>
        <select id="recFreq"><option ${r&&r.frequency==='Monthly'?'selected':''}>Monthly</option><option ${r&&r.frequency==='Weekly'?'selected':''}>Weekly</option></select>
      </div>
    </div>
    <div class="field"><label>Category</label><input id="recCategory" value="${r?esc(r.category||''):''}" placeholder="e.g. Bills"></div>
    <div class="modal-actions">
      ${r?`<button class="btn btn-danger" onclick="deleteRecurring('${r.id}')">Delete</button>`:`<button class="btn btn-outline" onclick="closeModal()">Cancel</button>`}
      <button class="btn btn-gold" onclick="saveRecurring(${r?`'${r.id}'`:'null'})">Save</button>
    </div>`;
  showModal(html);
}
async function saveRecurring(id){
  const name = document.getElementById('recName').value.trim();
  const amount = parseFloat(document.getElementById('recAmount').value);
  if(!name || !amount){ showToast("Name and amount required"); return; }
  const data = { name, amount, frequency: document.getElementById('recFreq').value, category: document.getElementById('recCategory').value.trim()||'General' };
  if(id){ Object.assign(state.recurring.find(r=>r.id===id), data); } else state.recurring.push({id:uid(), ...data});
  await save('recurring'); closeModal(); showToast("Saved"); render();
}
async function deleteRecurring(id){ state.recurring = state.recurring.filter(r=>r.id!==id); await save('recurring'); closeModal(); render(); }

/* ---------- ME ---------- */
