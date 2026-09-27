// Presentation only: no credentials leave this form or enter browser storage.
const form = document.getElementById('accountForm');
const status = document.getElementById('formStatus');
const confirmation = document.getElementById('confirmPassword');
document.querySelectorAll('[data-reveal]').forEach(button => {
 button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.reveal);
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.textContent = visible ? 'Hide' : 'Show';
  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-label', (visible ? 'Hide ' : 'Show ') + (input.id === 'confirmPassword' ? 'confirm password' : 'password'));
 });
});
function validateConfirmation(){
 if(confirmation) confirmation.setCustomValidity(confirmation.value !== document.getElementById('password').value ? 'Passwords must match.' : '');
}
form.addEventListener('input', () => { status.textContent = ''; validateConfirmation(); });
form.addEventListener('submit', event => {
 event.preventDefault();
 validateConfirmation();
 if(!form.reportValidity()) return;
 const name = document.getElementById('displayName');
 if(name && !name.value.trim()){name.setCustomValidity('Enter a display name.');name.reportValidity();name.addEventListener('input',()=>name.setCustomValidity(''),{once:true});return;}
 const messages = {
  login: 'Form checked. Sign-in is not connected yet; you have not been logged in.',
  signup: 'Form checked. No account was created. Registration will be connected in the backend phase.',
  'forgot-password': 'Form checked. No reset email was sent. Email recovery is not connected yet.',
  'reset-password': 'Form checked. No password was changed. This preview does not verify reset links.'
 };
 status.textContent = messages[form.dataset.mode];
 form.querySelectorAll('input[type="password"], input[name="password"], input[name="confirmPassword"]').forEach(input=>input.value='');
 status.focus();
});
