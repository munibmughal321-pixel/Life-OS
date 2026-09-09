// Wires up the bottom nav buttons. Doesn't know anything about
// screens or state — it just reports which button was clicked.

export function initNav(onNavigate) {
  document.querySelectorAll('.navbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveNav(btn.dataset.screen);
      onNavigate(btn.dataset.screen);
    });
  });
}

export function setActiveNav(screenName) {
  document.querySelectorAll('.navbtn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenName);
  });
}
