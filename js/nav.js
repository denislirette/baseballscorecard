// Global navigation + footer - injected dynamically on every page
// Single source of truth for site-wide UI elements

const NAV_ITEMS = [
  { href: '/legend.html', label: 'Legend' },
  { href: '/standings.html', label: 'Standings' },
  { href: '/advanced-stats.html', label: 'Stats' },
  { href: '/releases.html', label: 'Releases' },
];

const FOOTER_LINKS = [
  { href: '/contact.html', label: 'Contact' },
  { href: '/accessibility.html', label: 'Accessibility' },
  { href: '/releases.html', label: 'Releases' },
  { href: 'https://github.com/denislirette/baseballscorebook', label: 'GitHub' },
];

function initNav() {
  const header = document.querySelector('.app-header');
  if (!header) return;

  const themeToggle = header.querySelector('#theme-toggle');
  header.querySelectorAll('.global-nav-link').forEach(el => el.remove());

  for (const item of NAV_ITEMS) {
    const a = document.createElement('a');
    a.href = item.href;
    a.className = 'header-btn global-nav-link';
    a.textContent = item.label;
    if (themeToggle) {
      header.insertBefore(a, themeToggle);
    } else {
      header.appendChild(a);
    }
  }
}

function initFooter() {
  // Don't add footer if one already exists
  if (document.querySelector('.site-footer')) return;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  const links = FOOTER_LINKS.map(item => {
    const isExternal = item.href.startsWith('http');
    return `<a href="${item.href}"${isExternal ? ' target="_blank" rel="noopener"' : ''}>${item.label}</a>`;
  }).join('');

  footer.innerHTML = `
    <div class="footer-content">
      <span class="footer-brand">BaseballScorebook.org v2.0.0</span>
      <nav class="footer-links">${links}</nav>
    </div>`;

  document.body.appendChild(footer);
}

// Auto-init
initNav();
initFooter();
