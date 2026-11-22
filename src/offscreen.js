// Chromium only: the service worker cannot see the color scheme, this page can.
const scheme = matchMedia('(prefers-color-scheme: dark)');
const report = () => chrome.runtime.sendMessage({ type: 'qrbeam:scheme', dark: scheme.matches }).catch(() => {});
scheme.addEventListener('change', report);
report();
