import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Dev-only plugin: POST /api/save-tokens writes design-tokens.json + runs sync
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
            const tokens = JSON.parse(body);
            const tokenPath = resolve('design-tokens.json');
            writeFileSync(tokenPath, JSON.stringify(tokens, null, 2) + '\n');
            // Run sync script to update CSS + layout-config
            execSync('node scripts/sync-tokens.js --write', { cwd: resolve('.') });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
      // GET endpoint to read current tokens
      server.middlewares.use('/api/tokens', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
        const tokenPath = resolve('design-tokens.json');
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(tokenPath, 'utf-8'));
      });
    },
  };
}

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
  plugins: [tokenSavePlugin(), layoutSavePlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        game: 'game.html',
        styles: 'styles.html',
      },
    },
  },
});
