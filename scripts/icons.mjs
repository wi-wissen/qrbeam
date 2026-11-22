// Generates all icons from one glyph definition.
// Run after changing the glyph: node scripts/icons.mjs (needs Playwright + Chromium).
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OUT = new URL('../src/icons/', import.meta.url);

// 16x16 pixel grid, every edge on a whole pixel so the icon stays crisp at 1x:
// three finder marks (6x6 with a 2px ring) and five 2px modules in a dice pattern,
// matching the 2px weight of the browser's own toolbar icons.
function glyph(fill) {
  const finder = (x, y) =>
    `<path fill-rule="evenodd" d="M${x + 1} ${y}h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z M${x + 2} ${y + 2}v2h2v-2z"/>`;
  const mod = (x, y) => `<rect x="${x}" y="${y}" width="2" height="2"/>`;
  return `<g fill="${fill}">${finder(1, 1)}${finder(9, 1)}${finder(1, 9)}` +
    mod(9, 9) + mod(13, 9) + mod(11, 11) + mod(9, 13) + mod(13, 13) + '</g>';
}

const svg = (body, size = 16) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16">${body}</svg>\n`;

// Firefox address bar: follows the browser's light/dark appearance.
const pageAction =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
  '<style>g{fill:#2a292e}@media (prefers-color-scheme:dark){g{fill:#fbfbfe}}</style>' +
  glyph('#2a292e').replace(' fill="#2a292e"', '') + '</svg>\n';

// App icon for extension managers: dark glyph on a white rounded tile.
const app = svg(
  '<rect x=".5" y=".5" width="15" height="15" rx="3.5" fill="#ffffff" stroke="#d0d4da" stroke-width=".5"/>' +
  `<g transform="translate(3.2 3.2) scale(.6)">${glyph('#1f2328')}</g>`, 128);

const files = {
  'page-action.svg': pageAction,
  'toolbar-light.svg': svg(glyph('#5f6368')),
  'toolbar-dark.svg': svg(glyph('#e3e3e3')),
  'icon.svg': app,
};
for (const [name, content] of Object.entries(files)) await writeFile(new URL(name, OUT), content);

const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
async function png(source, size, name) {
  await page.setViewportSize({ width: size, height: size });
  const content = source.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${content}`);
  await page.screenshot({ path: new URL(name, OUT).pathname, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
for (const s of [16, 32]) {
  await png(files['toolbar-light.svg'], s, `toolbar-light-${s}.png`);
  await png(files['toolbar-dark.svg'], s, `toolbar-dark-${s}.png`);
}
for (const s of [48, 96, 128]) await png(app, s, `icon-${s}.png`);
await browser.close();
console.log('icons written');
