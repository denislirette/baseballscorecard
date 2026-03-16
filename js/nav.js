// Global navigation + footer - injected dynamically on every page
// Same header on every page: site title + nav links, classic HTML link style

const VERSION = '0.3.2';

const NAV_ITEMS = [
  { href: '/', label: 'Scorecards' },
  { href: '/reference.html', label: 'Reference' },
  { href: '/standings.html', label: 'Standings' },
  { href: '/releases.html', label: 'Releases' },
];

const FOOTER_LINKS = [
  { href: '/contact.html', label: 'Contact' },
  { href: '/accessibility.html', label: 'Accessibility' },
  { href: '/analytics.html', label: 'Analytics' },
];

const HAMBURGER_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect y="3" width="20" height="2"/><rect y="9" width="20" height="2"/><rect y="15" width="20" height="2"/></svg>';
const CLOSE_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4.3 4.3L15.7 15.7M15.7 4.3L4.3 15.7" stroke="currentColor" stroke-width="2" fill="none"/></svg>';

function initNav() {
  // Hide the old .app-header if it exists
  const oldHeader = document.querySelector('.app-header');
  if (oldHeader) oldHeader.style.display = 'none';

  // Don't double-init
  if (document.querySelector('.site-header')) return;

  const currentPath = window.location.pathname;

  // Build header
  const header = document.createElement('header');
  header.className = 'site-header';

  // Progress bar (rainbow, top of page)
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-label', 'Loading content');
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');
  progressBar.setAttribute('aria-valuenow', '0');
  progressBar.setAttribute('aria-busy', 'false');
  header.appendChild(progressBar);

  // ── Top row: site title (always the same on every page) ──
  const top = document.createElement('div');
  top.className = 'header-top';

  const h1 = document.createElement('h1');
  h1.textContent = 'BaseballScorecard.org';
  top.appendChild(h1);

  // Version badge (top right)
  const versionBadge = document.createElement('span');
  versionBadge.className = 'header-version';
  versionBadge.textContent = `v${VERSION}`;
  top.appendChild(versionBadge);

  // Hamburger button (mobile only)
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-label', 'Open navigation menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.innerHTML = HAMBURGER_SVG;
  top.appendChild(hamburger);

  header.appendChild(top);

  // ── Nav bar: second row ──
  const nav = document.createElement('nav');
  nav.className = 'nav-bar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  for (const item of NAV_ITEMS) {
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.label;
    if (item.external) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    const itemPath = item.href;
    if (!item.external && (currentPath === itemPath || (itemPath !== '/' && currentPath.startsWith(itemPath)))) {
      a.className = 'nav-active';
    }
    nav.appendChild(a);
  }

  // Theme toggle (in nav bar)
  const themeBtn = document.createElement('button');
  themeBtn.id = 'theme-toggle';
  themeBtn.className = 'nav-theme-btn';
  themeBtn.setAttribute('aria-label', 'Toggle dark mode');
  nav.appendChild(themeBtn);

  header.appendChild(nav);

  // Insert at top of body
  document.body.insertBefore(header, document.body.firstChild);

  // ── Hamburger toggle ──
  hamburger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('nav-open');
    hamburger.innerHTML = isOpen ? CLOSE_SVG : HAMBURGER_SVG;
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    hamburger.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  });

  // Close menu on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('nav-open')) {
      nav.classList.remove('nav-open');
      hamburger.innerHTML = HAMBURGER_SVG;
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });
}

function initFooter() {
  if (document.querySelector('.site-footer')) return;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  const links = FOOTER_LINKS.map(item => {
    const isExternal = item.href.startsWith('http');
    const attrs = isExternal ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${item.href}"${attrs}>${item.label}</a>`;
  }).join('');

  footer.innerHTML = `
    <div class="footer-content">
      <span class="footer-brand">BaseballScorecard.org <span class="footer-version">v${VERSION}</span></span>
      <nav class="footer-links">${links}</nav>
    </div>`;

  document.body.appendChild(footer);
}

function loadLocalOverrides() {
  // Load local.css (gitignored) — silently fails in prod
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/local.css';
  document.head.appendChild(link);

  // Load style panel (gitignored) — only activates with ?panel
  const script = document.createElement('script');
  script.src = '/js/style-panel.js';
  document.body.appendChild(script);
}

function initScrollSpy() {
  const links = document.querySelectorAll('.subnav a');
  if (!links.length) return;
  const sections = [...links].map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!sections.length) return;

  function onScroll() {
    let current = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= 80) current = s;
    }
    links.forEach(a => {
      a.classList.toggle('subnav-active', a.getAttribute('href') === '#' + current?.id);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Global progress bar API
window.showProgress = () => {
  const bar = document.querySelector('.progress-bar');
  if (!bar) return;
  bar.classList.remove('progress-done', 'progress-fade');
  bar.style.width = '0%';
  bar.setAttribute('aria-valuenow', '0');
  bar.setAttribute('aria-busy', 'true');
  // Force reflow so animation restarts
  void bar.offsetWidth;
  bar.classList.add('progress-active');
};

window.hideProgress = () => {
  const bar = document.querySelector('.progress-bar');
  if (!bar) return;
  bar.classList.remove('progress-active');
  bar.classList.add('progress-done');
  bar.setAttribute('aria-valuenow', '100');
  bar.setAttribute('aria-busy', 'false');
  setTimeout(() => {
    bar.classList.add('progress-fade');
    setTimeout(() => {
      bar.classList.remove('progress-done', 'progress-fade');
      bar.style.width = '0%';
    }, 500);
  }, 300);
};

// Auto-init
initNav();
initFooter();
initScrollSpy();
loadLocalOverrides();
