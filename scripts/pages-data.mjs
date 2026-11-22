// Prepares the GitHub Pages folder: copies site/, writes latest.json and the
// Firefox updates.json from the GitHub releases, and copies the newest signed
// .xpi next to the page (GitHub Pages serves it so Firefox installs it in one click).
// Usage: GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/pages-data.mjs _site
import { cp, mkdir, writeFile } from 'node:fs/promises';

const out = process.argv[2] || '_site';
const repo = process.env.GITHUB_REPOSITORY || 'wi-wissen/qrbeam';
const ADDON_ID = 'qrbeam@wi-wissen.github.io';
const XPI = 'qrbeam-firefox.xpi';

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'qrbeam-pages' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers });
if (!res.ok) throw new Error(`GitHub API ${res.status}`);
const releases = (await res.json())
  .filter((r) => !r.draft && !r.prerelease && /^v\d+\.\d+\.\d+$/.test(r.tag_name))
  .map((r) => ({ version: r.tag_name.slice(1), xpi: r.assets.find((a) => a.name === XPI) }))
  .filter((r) => r.xpi);

const byVersion = (a, b) => {
  const pa = a.version.split('.').map(Number), pb = b.version.split('.').map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
};
releases.sort(byVersion);

await mkdir(out, { recursive: true });
await cp('site', out, { recursive: true });

const updates = {
  addons: {
    [ADDON_ID]: {
      updates: releases.map((r) => ({ version: r.version, update_link: r.xpi.browser_download_url })),
    },
  },
};
await writeFile(`${out}/updates.json`, JSON.stringify(updates, null, 2) + '\n');

const latest = releases.at(-1);
await writeFile(`${out}/latest.json`, JSON.stringify(latest ? { version: latest.version } : {}) + '\n');

if (latest) {
  const file = await fetch(latest.xpi.browser_download_url, { headers: { 'User-Agent': 'qrbeam-pages' } });
  if (!file.ok) throw new Error(`Download of ${XPI} failed: ${file.status}`);
  await writeFile(`${out}/${XPI}`, Buffer.from(await file.arrayBuffer()));
}
console.log(latest ? `Pages data for ${latest.version}` : 'No release yet');
