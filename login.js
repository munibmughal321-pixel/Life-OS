import { signup, login } from './auth.js';

// mode: 'login' or 'signup'. Starts on 'login' if an account already
// exists, otherwise 'signup' (nothing to log into yet).
export function renderLogin(container, { hasAccount, onSuccess }) {
  let mode = hasAccount ? 'login' : 'signup';
  let passwordVisible = false;

  function draw() {
    const isSignup = mode === 'signup';
    container.innerHTML = `
      <div class="center-screen fade-in-up">
        <h1 class="brand-title" style="font-size:26px;">${isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p class="brand-sub">${isSignup ? 'Set a username and password to lock LifeOS to you.' : 'Log in to continue.'}</p>

        <form id="auth-form" class="auth-form">
          <div class="field">
            <label>Username</label>
            <input type="text" id="auth-username" autocomplete="username" placeholder="e.g. munib" autofocus>
          </div>

          <div class="field">
            <label>Password</label>
            <div class="pw-field-wrap">
              <input type="password" id="auth-password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="At least 4 characters">
              <button type="button" class="pw-toggle" id="pw-toggle" aria-label="Show password">👁</button>
            </div>
            ${isSignup ? `
              <div class="pw-strength" id="pw-strength">
                <div class="pw-strength-bar"><span id="pw-strength-fill"></span></div>
                <span class="pw-strength-label" id="pw-strength-label"></span>
              </div>` : ''}
          </div>

          ${isSignup ? `
          <div class="field">
            <label>Confirm Password</label>
            <input type="password" id="auth-confirm" autocomplete="new-password" placeholder="Type it again">
            <div class="pw-match" id="pw-match"></div>
          </div>` : ''}

          <div id="auth-error" class="auth-error"></div>

          <div class="remember-row">
            <label class="checkbox-row">
              <input type="checkbox" id="remember-me" checked>
              <span>Keep me logged in on this browser</span>
            </label>
          </div>

          <button type="submit" class="btn btn-gold" id="submit-btn">${isSignup ? 'Sign Up' : 'Log In'}</button>
        </form>

        ${!isSignup ? `<p class="forgot-note">Forgot your password? Since LifeOS runs only on your computer, delete <code>auth.json</code> in the project folder and restart the server to create a new account.</p>` : ''}

        ${hasAccount ? '' : `
        <p class="auth-toggle">
          ${isSignup ? 'Already set up?' : "Don't have an account?"}
          <button type="button" id="auth-toggle-btn">${isSignup ? 'Log In' : 'Sign Up'}</button>
        </p>`}
      </div>
    `;

    wireEvents(isSignup);
  }

  function wireEvents(isSignup) {
    document.getElementById('auth-form').addEventListener('submit', handleSubmit);

    const toggleBtn = document.getElementById('auth-toggle-btn');
    if (toggleBtn) toggleBtn.addEventListener('click', () => { mode = isSignup ? 'login' : 'signup'; passwordVisible = false; draw(); });

    // --- Show/hide password ---
    document.getElementById('pw-toggle').addEventListener('click', () => {
      passwordVisible = !passwordVisible;
      const pwInput = document.getElementById('auth-password');
      pwInput.type = passwordVisible ? 'text' : 'password';
      document.getElementById('pw-toggle').textContent = passwordVisible ? '🙈' : '👁';
    });

    if (isSignup) {
      // --- Password strength meter, updates as you type ---
      document.getElementById('auth-password').addEventListener('input', updateStrength);
      // --- Confirm-password live match check ---
      document.getElementById('auth-confirm').addEventListener('input', updateMatch);
    }
  }

  function updateStrength() {
    const password = document.getElementById('auth-password').value;
    const fill = document.getElementById('pw-strength-fill');
    const label = document.getElementById('pw-strength-label');
    if (!fill || !label) return;

    const score = passwordStrength(password);
    const levels = [
      { width: '0%',   color: 'var(--line)', text: '' },
      { width: '33%',  color: 'var(--red)',  text: 'Weak' },
      { width: '66%',  color: 'var(--gold)', text: 'Fair' },
      { width: '100%', color: 'var(--green)', text: 'Strong' }
    ];
    const level = levels[score];
    fill.style.width = level.width;
    fill.style.background = level.color;
    label.textContent = level.text;
    label.style.color = level.color;
  }

  // Very simple scoring: length + variety of character types.
  // Returns 0 (empty) to 3 (strong). Not cryptographic — just a
  // friendly nudge, since this app has no real attacker model.
  function passwordStrength(password) {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score++;
    return Math.min(score, 3);
  }

  function updateMatch() {
    const password = document.getElementById('auth-password').value;
    const confirm = document.getElementById('auth-confirm').value;
    const matchEl = document.getElementById('pw-match');
    if (!confirm) { matchEl.textContent = ''; return; }
    if (password === confirm) {
      matchEl.textContent = '✓ Passwords match';
      matchEl.className = 'pw-match ok';
    } else {
      matchEl.textContent = '✗ Passwords do not match';
      matchEl.className = 'pw-match bad';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const isSignup = mode === 'signup';
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    const errorEl = document.getElementById('auth-error');
    const form = document.getElementById('auth-form');
    const submitBtn = document.getElementById('submit-btn');
    errorEl.textContent = '';

    if (!username || !password) {
      showError('Enter both a username and password.');
      return;
    }
    if (isSignup) {
      if (password.length < 4) { showError('Password should be at least 4 characters.'); return; }
      const confirm = document.getElementById('auth-confirm').value;
      if (password !== confirm) { showError('Passwords do not match.'); return; }
    }

    // --- Loading state: disable the button and show progress while we wait ---
    submitBtn.disabled = true;
    submitBtn.textContent = isSignup ? 'Creating account…' : 'Logging in…';

    const result = isSignup
      ? await signup(username, password)
      : await login(username, password);

    if (result.ok) {
      onSuccess(result.username, rememberMe);
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = isSignup ? 'Sign Up' : 'Log In';
      showError(result.error || 'Something went wrong.');
    }

    function showError(msg) {
      errorEl.textContent = msg;
      // --- Shake animation: re-trigger by removing then re-adding the class ---
      form.classList.remove('shake');
      void form.offsetWidth; // forces the browser to notice the class was removed
      form.classList.add('shake');
    }
  }

  draw();
}
