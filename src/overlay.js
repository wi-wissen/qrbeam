// QRbeam overlay: the projector view with address and QR code.
// Used two ways:
//   1. injected into a tab by background.js -> QRbeam.toggle()
//   2. loaded by view.html (fallback for pages that block injection) -> QRbeam.mount(...)
// Depends on vendor/qrcode.js (global `qrcode`) and clean.js (global `QRbeamClean`).
(() => {
  if (globalThis.QRbeam) return;

  const api = globalThis.browser ?? globalThis.chrome;
  const isFirefox = /\bFirefox\//.test(navigator.userAgent);

  const FALLBACK = {
    dialogLabel: 'Address and QR code',
    shorten: 'Shorten link',
    shortening: 'Shortening…',
    shortenFailed: 'Couldn’t shorten link',
    undo: 'Undo',
    close: 'Close',
    escToClose: 'to close',
    qrLabel: 'QR code',
    noAddress: 'This page has no address that can be shared.',
    waitingForPermission: 'Waiting for permission…',
  };
  const t = (key) => {
    try { return api?.i18n?.getMessage(key) || FALLBACK[key] || key; } catch { return FALLBACK[key] || key; }
  };

  const ICON_SCISSORS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="4" cy="4.5" r="2"/><circle cx="4" cy="11.5" r="2"/><path d="M5.7 5.6 14 12M5.7 10.4 14 4"/></svg>';
  const ICON_CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13"/></svg>';

  // One spacing unit (--s) drives the layout. The row under the address has a
  // fixed height, so the QR code never jumps when the link gets shortened.
  const CSS = `
:host{all:initial}
.root{
  --bg:#f9f9fb; --fg:#15141a; --faint:#c9c9d1; --muted:#6b6b76; --btn:rgba(21,20,26,.07); --btn-hover:rgba(21,20,26,.12); --focus:#0061e0;
  --tile-shadow:0 0 0 1px rgba(0,0,0,.06),0 .4cqh 1.6cqh rgba(0,0,0,.06);
  position:relative;width:100%;height:100%;container-type:size;color-scheme:light;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,Cantarell,"Noto Sans",sans-serif;
  -webkit-font-smoothing:antialiased;
}
.root.cr{--bg:#ffffff; --fg:#202124; --faint:#cdd0d4; --muted:#6a6e73; --focus:#0b57d0}
@media (prefers-color-scheme: dark){
  .root{--bg:#1c1b22; --fg:#fbfbfe; --faint:#4d4c57; --muted:#a5a4b0; --btn:rgba(251,251,254,.09); --btn-hover:rgba(251,251,254,.15); --focus:#00ddff; --tile-shadow:none; color-scheme:dark}
  .root.cr{--bg:#202124; --fg:#e8eaed; --faint:#4a4c50; --muted:#9aa0a6; --focus:#a8c7fa}
}
.ov{--s:2.4cqh;position:absolute;inset:0;background:var(--bg);color:var(--fg);box-sizing:border-box;
  display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;justify-items:center;
  padding:calc(var(--s)*3) calc(var(--s)*4) calc(var(--s)*1.5);animation:fade .14s ease-out;outline:none}
@keyframes fade{from{opacity:0;transform:scale(.992)}to{opacity:1;transform:none}}
.head{display:contents}
.url{font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono","SF Mono","Roboto Mono","Liberation Mono","DejaVu Sans Mono",Menlo,Consolas,monospace;
  font-size:min(3.1cqw,6.2cqh);line-height:1.3;padding-block:.06em;font-weight:450;text-align:center;max-width:100%;overflow-wrap:anywhere;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;letter-spacing:0;
  font-variant-ligatures:none;transition:opacity .18s ease,filter .18s ease,transform .18s ease}
.url.out{opacity:0;filter:blur(6px);transform:translateY(-.25em) scale(.98)}
.url.pre{opacity:0;filter:blur(6px);transform:translateY(.25em) scale(.98);transition:none}
.scheme{color:var(--faint);font-weight:400}
.host{font-weight:700}
.path{opacity:.8}
.empty{font-size:min(2.4cqw,5cqh);color:var(--muted);text-align:center}
.meta{margin-top:var(--s);height:calc(var(--s)*1.7);min-height:24px;display:flex;align-items:center;justify-content:center;gap:1.2cqw;
  font-size:max(12px,min(1.45cqw,2.8cqh));color:var(--muted);max-width:100%;min-width:0}
.orig{font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono","SF Mono","Roboto Mono","Liberation Mono","DejaVu Sans Mono",Menlo,Consolas,monospace;font-size:.95em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.orig[hidden]{display:none}
button{font:inherit;color:inherit}
.pill{font-size:inherit;display:inline-flex;align-items:center;gap:.5em;border:0;border-radius:999px;padding:.35em .95em;
  background:var(--btn);color:var(--fg);cursor:pointer;flex:none;white-space:nowrap;line-height:1.2}
.pill:hover{background:var(--btn-hover)}
.pill:focus-visible,.x:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.pill svg{width:1.05em;height:1.05em}
.pill.link{background:transparent;padding:.35em .4em;color:var(--muted);text-decoration:underline;text-underline-offset:.2em}
.pill.link:hover{color:var(--fg)}
.pill[disabled]{cursor:default}
.spin{width:1em;height:1em;box-sizing:border-box;border-radius:50%;border:2px solid var(--faint);border-top-color:var(--fg);animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.qr{margin-top:calc(var(--s)*2);min-height:0;align-self:stretch;width:100%;display:flex;align-items:center;justify-content:center}
.tile{height:100%;aspect-ratio:1;max-width:100%;background:#ffffff;border-radius:min(3.2cqh,1.8cqw);box-sizing:border-box;
  padding:min(2.4cqh,1.35cqw);overflow:hidden;box-shadow:var(--tile-shadow);transition:opacity .2s ease}
.tile.dim{opacity:.15}
.tile svg{width:100%;height:100%;display:block}
.foot{margin-top:calc(var(--s)*1.5);font-size:max(11px,min(1.2cqw,2.4cqh));color:var(--muted)}
kbd{font:inherit;border:1px solid var(--faint);border-radius:.3em;padding:0 .4em}
.x{position:absolute;top:calc(var(--s)*1.5);right:calc(var(--s)*1.5);width:min(4cqw,7cqh);height:min(4cqw,7cqh);min-width:28px;min-height:28px;
  border-radius:50%;border:0;background:var(--btn);color:var(--fg);cursor:pointer;display:grid;place-items:center;padding:0}
.x:hover{background:var(--btn-hover)}
.x svg{width:40%;height:40%}
@media (prefers-reduced-motion:reduce){.ov,.url,.tile{animation:none;transition:none}.spin{animation-duration:2s}}
`;

    const restOf = (u) => (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function span(cls, text) {
    const el = document.createElement('span');
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function svgFrom(markup) {
    // Only used with the static icon strings above.
    return new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  }

  function setUrl(el, href) {
    const u = new URL(href);
    el.replaceChildren(span('scheme', u.protocol + '//'), span('host', u.host), span('path', restOf(u)));
  }

  function qrSvg(text) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const m = 2; // the tile's padding supplies the rest of the quiet zone
    const size = n + 2 * m;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    }
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('qrLabel'));
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', size);
    bg.setAttribute('height', size);
    bg.setAttribute('fill', '#ffffff');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#000000');
    svg.append(bg, path);
    return svg;
  }

  function shareable(href) {
    try { return /^(https?|ftp):$/.test(new URL(href).protocol); } catch { return false; }
  }

  async function requestShort(url) {
    if (!api?.runtime?.sendMessage) return { ok: false };
    try {
      const res = await api.runtime.sendMessage({ type: 'qrbeam:shorten', url });
      // Pass the reply through unchanged: { consent: true } means Firefox needs permission first.
      return res && typeof res === 'object' ? res : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  // Builds the view inside `shadow` and returns a cleanup function.
  function render(shadow, rawUrl, onClose) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const style = document.createElement('style');
    style.textContent = CSS;
    const root = document.createElement('div');
    root.className = 'root' + (isFirefox ? '' : ' cr');
    root.innerHTML =
      '<div class="ov" role="dialog" aria-modal="true" tabindex="-1">' +
        '<div class="head"><div class="url" aria-live="polite"></div>' +
          '<div class="meta"><span class="orig" hidden></span><button class="pill" type="button"></button></div></div>' +
        '<div class="qr"><div class="tile"></div></div>' +
        '<div class="foot"><kbd>Esc</kbd> <span class="esc"></span></div>' +
        '<button class="x" type="button"></button>' +
      '</div>';
    shadow.append(style, root);

    const $ = (sel) => root.querySelector(sel);
    $('.x').append(svgFrom(ICON_CLOSE));
    const ov = $('.ov'), urlEl = $('.url'), orig = $('.orig'), btn = $('.pill'), tile = $('.tile');
    ov.setAttribute('aria-label', t('dialogLabel'));
    $('.x').setAttribute('aria-label', t('close'));
    $('.x').title = t('close');
    $('.esc').textContent = t('escToClose');

    if (!shareable(rawUrl)) {
      urlEl.replaceChildren(span('empty', t('noAddress')));
      $('.meta').style.visibility = 'hidden';
      $('.qr').style.visibility = 'hidden';
    }

    const cleaned = shareable(rawUrl) ? globalThis.QRbeamClean(rawUrl) : rawUrl;
    let state = 'long';
    let shortUrl = null;
    let timer = null;

    function paint() {
      if (!shareable(rawUrl)) return;
      const shown = state === 'short' ? shortUrl : cleaned;
      setUrl(urlEl, shown);
      tile.replaceChildren(qrSvg(shown));
      if (state === 'short') {
        orig.hidden = false;
        orig.textContent = cleaned;
        btn.className = 'pill link';
        btn.textContent = t('undo');
      } else if (state === 'loading') {
        btn.replaceChildren(span('spin'), span(null, t('shortening')));
      } else {
        orig.hidden = true;
        btn.className = 'pill';
        btn.replaceChildren(svgFrom(ICON_SCISSORS), span(null, t('shorten')));
      }
    }

    function swap(to) {
      if (reduce) { state = to; paint(); return; }
      urlEl.classList.add('out');
      tile.classList.add('dim');
      timer = setTimeout(() => {
        state = to;
        paint();
        urlEl.classList.remove('out');
        urlEl.classList.add('pre');
        void urlEl.offsetWidth;
        urlEl.classList.remove('pre');
        tile.classList.remove('dim');
      }, 180);
    }

    btn.addEventListener('click', async () => {
      if (state === 'short') { swap('long'); return; }
      if (state === 'loading') return;
      if (shortUrl) { swap('short'); return; }
      state = 'loading';
      paint();
      const res = await requestShort(cleaned);
      if (state !== 'loading') return;
      if (res.consent) {
        // Firefox: the first shortening needs the user's permission, asked in a small window.
        state = 'consent';
        btn.replaceChildren(span('spin'), span(null, t('waitingForPermission')));
        btn.disabled = true;
        api.runtime.sendMessage({ type: 'qrbeam:ask-consent' }).catch(() => {});
        return;
      }
      if (res.ok && shareable(res.short)) {
        shortUrl = res.short;
        swap('short');
      } else {
        state = 'long';
        btn.replaceChildren(span(null, t('shortenFailed')));
        btn.disabled = true;
        timer = setTimeout(() => { btn.disabled = false; paint(); }, 2500);
      }
    });
    $('.x').addEventListener('click', () => onClose());

    const onConsent = (msg) => {
      if (!msg || msg.type !== 'qrbeam:consent-result' || state !== 'consent') return;
      state = 'long';
      btn.disabled = false;
      paint();
      if (msg.granted) btn.click();
    };
    api?.runtime?.onMessage?.addListener(onConsent);

    paint();
    ov.focus({ preventScroll: true });

    return () => {
      clearTimeout(timer);
      api?.runtime?.onMessage?.removeListener(onConsent);
    };
  }

  // ---------- in-page overlay ----------
  let current = null;

  function open() {
    const previousFocus = document.activeElement;
    const host = document.createElement('qrbeam-overlay');
    host.setAttribute('style', [
      'all:initial', 'position:fixed', 'inset:0', 'width:100vw', 'height:100vh', 'max-width:none', 'max-height:none',
      'margin:0', 'padding:0', 'border:0', 'background:transparent', 'z-index:2147483647', 'display:block', 'overflow:hidden',
    ].map((d) => d + ' !important').join(';'));
    const shadow = host.attachShadow({ mode: 'closed' });

    // Attach first: focus only works on connected elements.
    document.documentElement.append(host);
    // The top layer keeps the overlay above page dialogs and fullscreen elements.
    if (typeof host.showPopover === 'function') {
      host.setAttribute('popover', 'manual');
      try { host.showPopover(); } catch { /* not connected or unsupported */ }
    }
    const cleanup = render(shadow, location.href, close);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
        return;
      }
      if (e.key === 'Tab') {
        // Keep keyboard focus inside the overlay instead of the page behind it.
        const items = [...shadow.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
        if (!items.length) return;
        const i = items.indexOf(shadow.activeElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === -1 || i === items.length - 1 ? 0 : i + 1);
        e.preventDefault();
        e.stopImmediatePropagation();
        items[next].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);

    current = { host, cleanup, onKey, previousFocus };
  }

  function close() {
    if (!current) return;
    const { host, cleanup, onKey, previousFocus } = current;
    current = null;
    cleanup();
    window.removeEventListener('keydown', onKey, true);
    host.remove();
    if (previousFocus && typeof previousFocus.focus === 'function') {
      try { previousFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  }

  function toggle() {
    if (current) close();
    else open();
  }

  // ---------- standalone page (view.html) ----------
  function mount(container, rawUrl, onClose) {
    const shadow = container.attachShadow({ mode: 'open' });
    render(shadow, rawUrl, onClose);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') onClose(); });
  }

  globalThis.QRbeam = { toggle, mount };
})();
