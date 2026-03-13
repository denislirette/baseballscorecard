// Dark mode toggle — persists to localStorage, re-renders scorecards on toggle
(function () {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function updateLabel() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? 'Light' : 'Dark';
  }

  btn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
    updateLabel();
    updateLogos();

    // Re-render scorecards if the refresh button exists (game page)
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.click();
  });

  function updateLogos() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.team-logo, .team-logo-sm').forEach(img => {
      const id = img.src.match(/\/(\d+)\.svg/)?.[1];
      if (!id) return;
      img.src = isDark
        ? `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${id}.svg`
        : `https://www.mlbstatic.com/team-logos/${id}.svg`;
    });
  }

  updateLabel();
})();
