/**
 * Broken link checker for all HTML pages.
 *
 * Starts the Vite dev server, crawls all internal pages,
 * and reports any broken internal links (404s).
 * External links are skipped to avoid flaky CI from third-party downtime.
 */
import { SiteChecker } from 'broken-link-checker';

const PORT = 5179;
const BASE = `http://localhost:${PORT}`;

// Start Vite dev server
const { createServer } = await import('vite');
const server = await createServer({ server: { port: PORT, strictPort: true } });
await server.listen();

const broken = [];
let checked = 0;

const checker = new SiteChecker({
  excludeExternalLinks: true,
  filterLevel: 1,
  honorRobotExclusions: false,
}, {
  link(result) {
    checked++;
    if (result.broken) {
      broken.push({
        page: result.base.resolved,
        link: result.url.resolved,
        reason: result.brokenReason,
      });
    }
  },
  end() {
    server.close();
    console.log(`Checked ${checked} internal links`);
    if (broken.length > 0) {
      console.error(`\nFound ${broken.length} broken link(s):\n`);
      for (const b of broken) {
        console.error(`  ${b.link}`);
        console.error(`    on page: ${b.page}`);
        console.error(`    reason:  ${b.reason}\n`);
      }
      process.exit(1);
    } else {
      console.log('No broken links found.');
    }
  },
});

checker.enqueue(BASE);
