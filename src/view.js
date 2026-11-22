// Fallback page for tabs that do not allow the overlay to be injected.
const target = new URLSearchParams(location.search).get('u') || '';
globalThis.QRbeam.mount(document.getElementById('view'), target, () => window.close());
