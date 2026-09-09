// Welcome screen — the very first thing shown.
// A short 3-slide carousel introduces the app, then hands off to login.

const SLIDES = [
  { icon: '⏱', title: 'Track your day', text: 'Log activities and see exactly where your 24 hours go — built around your night shift schedule.' },
  { icon: '📚', title: 'Grow your skills', text: 'Level up coding, trading, and your degree with goals, XP, and a GPA tracker.' },
  { icon: '🕌', title: 'Build your deen', text: 'Prayers, Quran, adhkar, and streaks — consistency made visible, one day at a time.' }
];

export function renderWelcome(container, onGetStarted) {
  let slideIndex = 0;

  function draw() {
    const slide = SLIDES[slideIndex];
    const isLast = slideIndex === SLIDES.length - 1;

    container.innerHTML = `
      <div class="center-screen fade-in-up">
        <div class="brand-icon">${slide.icon}</div>
        <h1 class="brand-title" style="font-size:26px;">${slide.title}</h1>
        <p class="brand-sub">${slide.text}</p>

        <div class="carousel-dots">
          ${SLIDES.map((_, i) => `<span class="dot ${i === slideIndex ? 'active' : ''}" data-index="${i}"></span>`).join('')}
        </div>

        <div class="carousel-nav-row">
          ${isLast ? '' : `<button class="btn-text" id="skip-btn">Skip</button>`}
          <button class="btn btn-gold" id="next-btn">${isLast ? 'Get Started' : 'Next'}</button>
        </div>
      </div>
    `;

    // Clicking a dot jumps straight to that slide.
    document.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', () => {
        slideIndex = parseInt(dot.dataset.index);
        draw();
      });
    });

    document.getElementById('next-btn').addEventListener('click', () => {
      if (isLast) { onGetStarted(); return; }
      slideIndex++;
      draw();
    });

    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) skipBtn.addEventListener('click', onGetStarted);
  }

  draw();
}
