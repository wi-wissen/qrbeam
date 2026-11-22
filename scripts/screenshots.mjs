// Renders the overlay as preview images for the website (light and dark).
// Run after `npm run build`: node scripts/screenshots.mjs (needs Playwright + Chromium).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = new URL('../', import.meta.url).pathname;

const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, colorScheme: scheme, deviceScaleFactor: 2 });
  await page.route('https://example.org/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>Example</title>' }));
  await page.goto('https://example.org/projekttage-2026/anmeldung?klasse=8b&utm_source=newsletter');
  for (const f of ['vendor/qrcode.js', 'clean.js', 'overlay.js']) await page.addScriptTag({ path: root + 'dist/chrome/' + f });
  await page.evaluate(() => globalThis.QRbeam.toggle());
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${root}site/assets/preview-${scheme}.png` });
  await page.close();
}
await browser.close();
console.log('site/assets/preview-{light,dark}.png written');
