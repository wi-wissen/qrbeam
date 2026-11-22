// Builds dist/chrome and dist/firefox from src/ and zips them.
// Usage: VERSION=1.2.0 node scripts/build.mjs
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
const version = process.env.VERSION || '0.0.0';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version "${version}". Use three numbers like 1.2.0.`);
  process.exit(1);
}

const ONLY = {
  chrome: ['offscreen.html', 'offscreen.js', 'icons/toolbar-light-16.png', 'icons/toolbar-light-32.png', 'icons/toolbar-dark-16.png', 'icons/toolbar-dark-32.png'],
  firefox: ['icons/page-action.svg', 'icons/icon.svg'],
};
const ALWAYS_SKIP = ['icons/toolbar-light.svg', 'icons/toolbar-dark.svg'];

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (Array.isArray(v) && Array.isArray(a[k])) out[k] = [...new Set([...a[k], ...v])];
    else if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') out[k] = merge(a[k], v);
    else out[k] = v;
  }
  return out;
}

const readJson = async (p) => JSON.parse(await readFile(root + p, 'utf8'));
const base = await readJson('manifest/base.json');

await rm(root + 'dist', { recursive: true, force: true });
for (const target of ['chrome', 'firefox']) {
  const out = `${root}dist/${target}/`;
  const other = target === 'chrome' ? 'firefox' : 'chrome';
  const skip = new Set([...ALWAYS_SKIP, ...ONLY[other]].map((f) => root + 'src/' + f));
  await mkdir(out, { recursive: true });
  await cp(root + 'src/', out, { recursive: true, filter: (src) => !skip.has(src) });

  const manifest = merge(base, await readJson(`manifest/${target}.json`));
  manifest.version = version;
  await writeFile(out + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');

  execFileSync('zip', ['-qrX', `${root}dist/qrbeam-${target}.zip`, '.'], { cwd: out });
  console.log(`dist/qrbeam-${target}.zip (${version})`);
}
