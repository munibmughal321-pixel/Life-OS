import { state } from './state.js';
import { loadState } from './storage.js';
import { initNav } from './nav.js';
import { getAuthStatus, rememberSession, hasRememberedSession, clearSession } from './auth.js';

import { renderWelcome } from './welcome.js';
import { renderLogin } from './login.js';

import { renderDashboard } from './dashboard.js';
import { renderActivities } from './activities.js';
import { renderGrowth } from './growth.js';
import { renderFinance } from './finance.js';
import { renderMe } from './me.js';
import { renderDeen } from './deen.js';

// Maps a screen name to the function that draws it.
// Adding a new screen later = add one line here.
const screens = {
  dashboard: renderDashboard,
  activities: renderActivities,
  growth: renderGrowth,
  finance: renderFinance,
  me: renderMe,
  deen: renderDeen
};

let currentScreen = 'dashboard';
const screenContent = document.getElementById('screen-content');
const topbar = document.getElementById('topbar');
const bottomNav = document.getElementById('bottom-nav');
const logoutBtn = document.getElementById('logout-btn');

/* ---------- main app (post-login) ---------- */
function showApp() {
  topbar.style.display = 'flex';
  bottomNav.style.display = 'flex';
  logoutBtn.style.display = 'block';
  renderCurrentScreen();
}

function renderCurrentScreen() {
  updateGreeting();
  const renderFn = screens[currentScreen];
  renderFn(screenContent, state);
}

function updateGreeting() {
  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? 'Still up' :
    hour < 12 ? 'Good Morning' :
    hour < 17 ? 'Good Afternoon' :
    hour < 21 ? 'Good Evening' : 'Good Night';

  document.getElementById('greet-name').textContent = `${greeting}, ${state.profile.name}`;
  document.getElementById('date-label').textContent =
    new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

// Lets any screen navigate elsewhere (e.g. a "Deen →" link on the Dashboard).
export function goToScreen(name) {
  currentScreen = name;
  renderCurrentScreen();
}
window.goToScreen = goToScreen; // so inline onclick="goToScreen(...)" works from screen HTML

/* ---------- pre-app flow: welcome -> login -> app ---------- */
function hideChrome() {
  topbar.style.display = 'none';
  bottomNav.style.display = 'none';
  logoutBtn.style.display = 'none';
}

async function showLogin(hasAccount) {
  hideChrome();
  renderLogin(screenContent, {
    hasAccount,
    onSuccess: async (username, rememberMe) => {
      if (rememberMe) rememberSession();
      state.profile.name = username;
      await loadState();
      state.profile.name = username; // keep the just-used username even if saved data had an older one
      currentScreen = 'dashboard';
      showApp();
    }
  });
}

function showWelcome(hasAccount) {
  hideChrome();
  renderWelcome(screenContent, () => showLogin(hasAccount));
}

logoutBtn.addEventListener('click', () => {
  clearSession();
  getAuthStatus().then(({ hasAccount }) => showLogin(hasAccount));
});

function showServerUnreachableError() {
  hideChrome();
  screenContent.innerHTML = `
    <div class="center-screen">
      <div class="brand-icon">⚠️</div>
      <h1 class="brand-title" style="font-size:22px;">Can't reach the server</h1>
      <p class="brand-sub">
        This page needs to be opened through LifeOS's own server, not a different
        one (like VS Code's "Live Server").<br><br>
        In a terminal, inside this project folder, run:<br>
        <code style="color:var(--gold);">node server.js</code><br><br>
        Then open <code style="color:var(--gold);">http://localhost:3000</code> — not this address.
      </p>
    </div>
  `;
}

async function init() {
  // Wire the nav buttons once up front — they just sit hidden until showApp() reveals them.
  initNav((screenName) => { currentScreen = screenName; renderCurrentScreen(); });

  try {
    const { hasAccount, username } = await getAuthStatus();

    if (hasAccount && hasRememberedSession()) {
      await loadState();
      if (username) state.profile.name = username;
      showApp();
    } else {
      showWelcome(hasAccount);
    }
  } catch (e) {
    console.error(e);
    showServerUnreachableError();
  }
}

init();
