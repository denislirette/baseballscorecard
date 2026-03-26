// Global navigation + footer - injected dynamically on every page
// Same header on every page: site title + nav links, classic HTML link style

const VERSION = '0.8.0';

const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const NAV_ITEMS = [
  { href: '/', label: 'Games' },
  { href: '/standings.html', label: 'Standings' },
  { href: '/guide.html', label: 'Guide' },
  ...(IS_LOCAL ? [{ href: '/design-system.html', label: 'Design System', dev: true }] : []),
];

const FOOTER_LINKS = [
  { href: '/about.html', label: 'About the Project' },
  { href: '/contact.html', label: 'Contact' },
  { href: '/disclaimer.html', label: 'Disclaimer' },
  { href: 'https://github.com/denislirette/baseballscorecard/blob/master/docs/ACCESSIBILITY.md', label: 'Accessibility Statement' },
  { href: 'https://www.buymeacoffee.com/baseballscorecard.org', label: 'Buy Me a Coffee' },
];

const HAMBURGER_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect y="3" width="20" height="2"/><rect y="9" width="20" height="2"/><rect y="15" width="20" height="2"/></svg>';
const CLOSE_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4.3 4.3L15.7 15.7M15.7 4.3L4.3 15.7" stroke="currentColor" stroke-width="2" fill="none"/></svg>';

function initNav() {
  // Hide the old .app-header if it exists
  const oldHeader = document.querySelector('.app-header');
  if (oldHeader) oldHeader.style.display = 'none';

  // Don't double-init
  if (document.querySelector('.site-header')) return;

  // Skip-to-content link (first focusable element on the page)
  const mainEl = document.querySelector('main') || document.querySelector('[role="main"]');
  if (mainEl) {
    if (!mainEl.id) mainEl.id = 'main-content';
    const skip = document.createElement('a');
    skip.href = `#${mainEl.id}`;
    skip.className = 'skip-link';
    skip.textContent = 'Skip to content';
    document.body.insertBefore(skip, document.body.firstChild);
  }

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

  const brand = document.createElement('div');
  brand.className = 'header-brand';


  const h1 = document.createElement('h1');
  const homeLink = document.createElement('a');
  homeLink.href = '/';
  homeLink.innerHTML = 'BaseballScorecard.org <span class="header-tagline">Every game tells a story.</span>';
  homeLink.setAttribute('aria-label', 'BaseballScorecard.org — go to home page');
  h1.appendChild(homeLink);
  brand.appendChild(h1);

  top.appendChild(brand);

  // ── Nav bar: same row as logo, pushed right ──
  const nav = document.createElement('nav');
  nav.className = 'nav-bar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  for (const item of NAV_ITEMS) {
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.label;
    if (item.dev) {
      a.style.opacity = '0.5';
      a.style.fontSize = '0.85em';
    }
    const itemPath = item.href;
    if (currentPath === itemPath || (itemPath !== '/' && currentPath.startsWith(itemPath))) {
      a.className = 'nav-active';
    }
    nav.appendChild(a);
  }

  top.appendChild(nav);

  // Theme toggle (always visible, before hamburger)
  const LIGHT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-800v-120h80v120h-80Zm0 760v-120h80v120h-80Zm360-400v-80h120v80H800Zm-760 0v-80h120v80H40Zm708-252-56-56 70-72 58 58-72 70ZM198-140l-58-58 72-70 56 56-70 72Zm564 0-70-72 56-56 72 70-58 58ZM212-692l-72-70 58-58 70 72-56 56Zm98 382q-70-70-70-170t70-170q70-70 170-70t170 70q70 70 70 170t-70 170q-70 70-170 70t-170-70Zm283.5-56.5Q640-413 640-480t-46.5-113.5Q547-640 480-640t-113.5 46.5Q320-547 320-480t46.5 113.5Q413-320 480-320t113.5-46.5ZM480-480Z"/></svg>';
  const DARK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M484-80q-84 0-157.5-32t-128-86.5Q144-253 112-326.5T80-484q0-146 93-257.5T410-880q-18 99 11 193.5T521-521q71 71 165.5 100T880-410q-26 144-138 237T484-80Zm0-80q88 0 163-44t118-121q-86-8-163-43.5T464-465q-61-61-97-138t-43-163q-77 43-120.5 118.5T160-484q0 135 94.5 229.5T484-160Zm-20-305Z"/></svg>';
  const themeBtn = document.createElement('button');
  themeBtn.id = 'theme-toggle';
  themeBtn.className = 'nav-theme-btn';

  function updateThemeBtn() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeBtn.innerHTML = isDark ? LIGHT_ICON : DARK_ICON;
    themeBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
    updateThemeBtn();
    // Re-render scorecard if on game page
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.click();
  });

  updateThemeBtn();
  top.appendChild(themeBtn);

  // Keyboard shortcuts: D for dark, L for light
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === 'd' || e.key === 'D') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      updateThemeBtn();
    } else if (e.key === 'l' || e.key === 'L') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
      updateThemeBtn();
    }
  });

  // Hamburger button (mobile only)
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-label', 'Open navigation menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.innerHTML = HAMBURGER_SVG;
  top.appendChild(hamburger);

  header.appendChild(top);

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

  const releasesURL = 'https://github.com/denislirette/baseballscorecard/releases';

  footer.innerHTML = `
    <div class="footer-content">
      <div class="footer-nav-row">
        <nav class="footer-links">${links}</nav>
        <a href="${releasesURL}" target="_blank" rel="noopener" class="footer-version" id="footer-version">Version ${VERSION}</a>
      </div>
      <p class="footer-fine-print">
        © 2026 BaseballScorecard.org. This site is not affiliated with Major League Baseball or FanGraphs. Data and logos are provided for informational and educational purposes only. All logos are the trademark and property of their respective owners. Double-check stats before committing pen to paper.
      </p>
    </div>`;

  // Keep the version link up to date with the latest GitHub release
  fetch('https://api.github.com/repos/denislirette/baseballscorecard/releases/latest')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data?.tag_name) return;
      const tag = data.tag_name.replace(/^v/, '');
      const link = document.getElementById('footer-version');
      if (link) {
        link.textContent = `Version ${tag}`;
        link.href = data.html_url;
      }
    })
    .catch(() => {});

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

  // Click highlight: highlight both nav link + target heading until next click
  function clearHighlights() {
    document.querySelectorAll('.target-highlight').forEach(el => el.classList.remove('target-highlight'));
  }

  function highlightTarget(href) {
    clearHighlights();
    const target = document.querySelector(href);
    if (!target) return;

    // Highlight the most specific element possible:
    // - If the target IS a heading, highlight it
    // - If the target is a tr/td/dt/dd/strong/span/li, highlight it directly (specific term)
    // - If the target is a section/div wrapper, find its heading child
    const tag = target.tagName;
    if (tag.match(/^H[2-6]$/i) || tag.match(/^(TR|TD|TH|DT|DD|STRONG|SPAN|LI|P)$/i)) {
      target.classList.add('target-highlight');
    } else {
      const heading = target.querySelector('h2, h3, h4, h5, h6');
      if (heading) heading.classList.add('target-highlight');
      else target.classList.add('target-highlight');
    }

    // Also highlight the matching subnav link if one exists
    links.forEach(navLink => {
      if (navLink.getAttribute('href') === href) navLink.classList.add('target-highlight');
    });
  }

  // Subnav links
  links.forEach(a => {
    a.addEventListener('click', () => highlightTarget(a.getAttribute('href')));
  });

  // Any in-page anchor link in the content area
  document.querySelector('.page-content')?.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a) highlightTarget(a.getAttribute('href'));
  });
}

// Global progress bar API — only shows after 1s delay
let progressTimer = null;

window.showProgress = () => {
  const bar = document.querySelector('.progress-bar');
  if (!bar) return;
  // Clear any pending hide
  clearTimeout(progressTimer);
  bar.classList.remove('progress-done', 'progress-fade', 'progress-active');
  bar.style.width = '0%';
  bar.setAttribute('aria-valuenow', '0');
  // Delay showing — don't flash for fast loads
  progressTimer = setTimeout(() => {
    bar.setAttribute('aria-busy', 'true');
    void bar.offsetWidth;
    bar.classList.add('progress-active');
  }, 1000);
};

window.hideProgress = () => {
  const bar = document.querySelector('.progress-bar');
  if (!bar) return;
  // Cancel the delayed show if load finished fast
  clearTimeout(progressTimer);
  bar.setAttribute('aria-busy', 'false');
  if (!bar.classList.contains('progress-active')) {
    // Never showed — nothing to hide
    return;
  }
  bar.classList.remove('progress-active');
  bar.classList.add('progress-done');
  bar.setAttribute('aria-valuenow', '100');
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