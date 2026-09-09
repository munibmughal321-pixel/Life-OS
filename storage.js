import { state, setState } from './state.js';

// Fetches saved data from the server and loads it into `state`.
// Called once when the app starts.
export async function loadState() {
  try {
    const res = await fetch('/api/data');
    const saved = await res.json();
    setState(saved);
  } catch (err) {
    console.error('Could not load data from server:', err);
    // App still works with default (empty) state if this fails.
  }
}

// Sends the current `state` to the server to be written to data.json.
// Call this after every change (e.g. adding a transaction, toggling a prayer).
export async function saveState() {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (!res.ok) throw new Error('Server rejected save');
  } catch (err) {
    console.error('Could not save data:', err);
    showSaveError();
  }
}

function showSaveError() {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = "Couldn't save — check the server is running";
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
