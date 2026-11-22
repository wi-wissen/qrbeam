// QRbeam background: opens the overlay and talks to is.gd.
const api = globalThis.browser ?? globalThis.chrome;

const CONTENT_FILES = ['vendor/qrcode.js', 'clean.js', 'overlay.js'];

async function showOverlay(tab) {
  if (!tab || tab.id == null) return;
  try {
    const target = { tabId: tab.id };
    const [probe] = await api.scripting.executeScript({ target, func: () => !!globalThis.QRbeam });
    if (!probe || !probe.result) await api.scripting.executeScript({ target, files: CONTENT_FILES });
    await api.scripting.executeScript({ target, func: () => globalThis.QRbeam.toggle() });
  } catch {
    // Browser pages, the extension stores and some viewers refuse scripts.
    // Show the same view in a tab of our own instead.
    const url = api.runtime.getURL('view.html') + '?u=' + encodeURIComponent(tab.url || '');
    await api.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });
  }
}

api.action?.onClicked.addListener(showOverlay);
api.pageAction?.onClicked.addListener(showOverlay);
api.commands?.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-overlay') return;
  if (!tab) [tab] = await api.tabs.query({ active: true, currentWindow: true });
  showOverlay(tab);
});

// ---------- link shortening (only on explicit click) ----------
const memory = new Map();

// Firefox asks for consent before data leaves the browser. Sending an address
// to is.gd counts as "browsing activity", declared as optional in the manifest
// and requested on first use from consent.html (requests need a click in an
// extension page, the overlay lives inside the website).
const CONSENT = { data_collection: ['browsingActivity'] };
const needsConsent = typeof api.runtime.getBrowserInfo === 'function';

async function hasConsent() {
  if (!needsConsent) return true;
  try {
    return await api.permissions.contains(CONSENT);
  } catch {
    return true; // Firefox without data consent support
  }
}

async function askConsent(tab) {
  const url = api.runtime.getURL('consent.html') + '?tab=' + tab.id;
  try {
    await api.windows.create({ url, type: 'popup', width: 460, height: 400 });
  } catch {
    await api.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });
  }
}

async function shorten(url) {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url) || url.length > 5000) return { ok: false };
  if (!(await hasConsent())) return { ok: false, consent: true };
  if (memory.has(url)) return { ok: true, short: memory.get(url) };
  const key = 'short:' + url;
  try {
    const stored = await api.storage.session.get(key);
    if (stored[key]) {
      memory.set(url, stored[key]);
      return { ok: true, short: stored[key] };
    }
  } catch { /* storage.session unavailable */ }

  try {
    const res = await fetch('https://is.gd/create.php?format=json&url=' + encodeURIComponent(url), {
      credentials: 'omit',
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const short = data && data.shorturl;
    if (typeof short !== 'string' || !short.startsWith('https://is.gd/')) return { ok: false };
    memory.set(url, short);
    try { await api.storage.session.set({ [key]: short }); } catch { /* ignore */ }
    return { ok: true, short };
  } catch {
    return { ok: false };
  }
}

// ---------- toolbar icon that follows light/dark (Chromium only) ----------
const ICONS = {
  light: { 16: 'icons/toolbar-light-16.png', 32: 'icons/toolbar-light-32.png' },
  dark: { 16: 'icons/toolbar-dark-16.png', 32: 'icons/toolbar-dark-32.png' },
};

async function ensureOffscreen() {
  if (!api.offscreen) return;
  try {
    if (await api.offscreen.hasDocument()) return;
    await api.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['MATCH_MEDIA'],
      justification: 'Match the toolbar icon to light or dark mode.',
    });
  } catch { /* already exists or unsupported */ }
}

api.runtime.onInstalled.addListener(ensureOffscreen);
api.runtime.onStartup.addListener(ensureOffscreen);
ensureOffscreen();

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== api.runtime.id || !msg) return;
  if (msg.type === 'qrbeam:shorten') {
    shorten(msg.url).then(sendResponse);
    return true;
  }
  if (msg.type === 'qrbeam:ask-consent' && sender.tab) {
    askConsent(sender.tab);
    return;
  }
  if (msg.type === 'qrbeam:consent-done' && Number.isInteger(msg.tab)) {
    api.tabs.sendMessage(msg.tab, { type: 'qrbeam:consent-result', granted: !!msg.granted }).catch(() => {});
    if (msg.granted) api.tabs.update(msg.tab, { active: true }).catch(() => {});
    return;
  }
  if (msg.type === 'qrbeam:scheme' && api.action) {
    api.action.setIcon({ path: msg.dark ? ICONS.dark : ICONS.light });
  }
});
