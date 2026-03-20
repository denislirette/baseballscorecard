import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Dev-only plugin: POST /api/save-layout writes layout-config.js DEFAULTS
function layoutSavePlugin() {
  return {
    name: 'layout-save',
    configureServer(server) {
      server.middlewares.use('/api/save-layout', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const config = JSON.parse(body);
            const filePath = resolve('js/layout-config.js');
            const src = readFileSync(filePath, 'utf-8');
            // Replace each known key in the DEFAULTS block
            let updated = src;
            for (const [key, value] of Object.entries(config)) {
              const re = new RegExp(`(${key}:\\s*)([\\d.]+)`);
              if (re.test(updated)) {
                updated = updated.replace(re, `$1${value}`);
              }
            }
            writeFileSync(filePath, updated);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

// Dev-only plugin: POST /api/save-tokens writes CSS variables back to style.css
function tokenSavePlugin() {
  return {
    name: 'token-save',
    configureServer(server) {
      server.middlewares.use('/api/save-tokens', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { light, dark } = JSON.parse(body);
            const filePath = resolve('css/style.css');
            let css = readFileSync(filePath, 'utf-8');

            // Split CSS into :root section and dark section
            const darkStart = css.indexOf('[data-theme="dark"]');
            if (darkStart === -1) throw new Error('Dark theme block not found in CSS');
            let rootSection = css.substring(0, darkStart);
            let darkSection = css.substring(darkStart);

            // Replace light values only within the :root section
            for (const [varName, value] of Object.entries(light)) {
              if (!value || !value.startsWith('#')) continue;
              const re = new RegExp(`(${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*)#[0-9a-fA-F]{3,8}`);
              rootSection = rootSection.replace(re, `$1${value}`);
            }

            // Replace dark values only within the dark section
            for (const [varName, value] of Object.entries(dark)) {
              if (!value || !value.startsWith('#')) continue;
              const re = new RegExp(`(${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*)#[0-9a-fA-F]{3,8}`);
              darkSection = darkSection.replace(re, `$1${value}`);
            }

            css = rootSection + darkSection;
            writeFileSync(filePath, css);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

// Dev-only plugin: inject a "DEVELOPMENT" banner at the top of every page
function devBannerPlugin() {
  let isDev = false;
  return {
    name: 'dev-banner',
    configResolved(config) { isDev = config.command === 'serve'; },
    transformIndexHtml(html) {
      if (!isDev) return html;
      const banner = `<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#000;text-align:center;font:bold 12px/24px system-ui;letter-spacing:0.05em;">DEVELOPMENT</div><div style="height:24px;"></div>`;
      return html.replace('<body>', `<body>${banner}`);
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [layoutSavePlugin(), tokenSavePlugin(), devBannerPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        game: 'game.html',
        guide: 'guide.html',
        standings: 'standings.html',
        contact: 'contact.html',
        contactSuccess: 'contact-success.html',
        about: 'about.html',
        accessibility: 'accessibility.html',
        analytics: 'analytics.html',
        disclaimer: 'disclaimer.html',
      },
    },
  },
});
