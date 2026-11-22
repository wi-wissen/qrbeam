// Firefox only: asks once for permission to send addresses to is.gd.
const api = globalThis.browser ?? globalThis.chrome;
const tab = Number(new URLSearchParams(location.search).get('tab'));

for (const el of document.querySelectorAll('[data-i18n]')) {
  el.textContent = api.i18n.getMessage(el.dataset.i18n);
}
document.title = api.i18n.getMessage('consentTitle');

async function done(granted) {
  await api.runtime.sendMessage({ type: 'qrbeam:consent-done', tab, granted }).catch(() => {});
  window.close();
}

document.getElementById('allow').addEventListener('click', async () => {
  const wanted = { data_collection: ['browsingActivity'] };
  let granted = false;
  try {
    // permissions.request must be the first await after the click, or Firefox
    // no longer treats it as a user action. contains() is only a fallback.
    granted = await api.permissions.request(wanted);
  } catch {
    granted = await api.permissions.contains(wanted).catch(() => false);
  }
  done(granted);
});
document.getElementById('deny').addEventListener('click', () => done(false));
document.getElementById('allow').focus();
