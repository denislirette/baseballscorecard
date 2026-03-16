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

export default defineConfig({
  root: '.',
  plugins: [layoutSavePlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        game: 'game.html',
        reference: 'reference.html',
        standings: 'standings.html',
        releases: 'releases.html',
        contact: 'contact.html',
        accessibility: 'accessibility.html',
      },
    },
  },
});
