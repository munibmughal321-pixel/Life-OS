// Talks to the server's /api/auth/* endpoints.
// Every function returns { ok: true, ... } or { ok: false, error: '...' }.

async function safeFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    // fetch() itself threw — almost always means nothing is listening
    // on this port (wrong server running, or no server running at all).
    throw new Error('SERVER_UNREACHABLE');
  }
  return res;
}

export async function getAuthStatus() {
  const res = await safeFetch('/api/auth/status');
  if (!res.ok) throw new Error('SERVER_UNREACHABLE');
  return res.json(); // { hasAccount, username }
}

export async function signup(username, password) {
  const res = await safeFetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  return res.ok ? { ok: true, username: data.username } : { ok: false, error: data.error };
}

export async function login(username, password) {
  const res = await safeFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  return res.ok ? { ok: true, username: data.username } : { ok: false, error: data.error };
}

// "Remember me" is just a local flag saying this browser already logged in —
// the server still owns the real credential check on every signup/login call.
const SESSION_KEY = 'lifeos_logged_in';

export function rememberSession() {
  localStorage.setItem(SESSION_KEY, 'true');
}
export function hasRememberedSession() {
  return localStorage.getItem(SESSION_KEY) === 'true';
}
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
