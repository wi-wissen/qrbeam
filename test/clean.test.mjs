import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/clean.js';

const clean = globalThis.QRbeamClean;

test('drops utm and click ids, keeps real parameters', () => {
  assert.equal(
    clean('https://example.org/a?klasse=8b&utm_source=news&utm_medium=email&fbclid=x&gclid=y'),
    'https://example.org/a?klasse=8b');
});

test('removes an empty query entirely and keeps the fragment', () => {
  assert.equal(clean('https://example.org/a?utm_campaign=x#teil-2'), 'https://example.org/a#teil-2');
});

test('amazon product links become /dp/ASIN', () => {
  assert.equal(
    clean('https://www.amazon.de/Ravensburger-Puzzle/dp/B07XYZ1234/ref=sr_1_3?crid=2K&keywords=puzzle&qid=1&sr=8-3&th=1'),
    'https://www.amazon.de/dp/B07XYZ1234');
  assert.equal(clean('https://www.amazon.com/gp/product/B000000001?tag=aff-20'), 'https://www.amazon.com/dp/B000000001');
});

test('amazon non-product pages only lose tracking', () => {
  assert.equal(clean('https://www.amazon.de/s?k=puzzle&crid=2K&sprefix=puz&ref=nb_sb'), 'https://www.amazon.de/s?k=puzzle');
});

test('youtube becomes youtu.be and keeps time and playlist', () => {
  assert.equal(clean('https://www.youtube.com/watch?v=M7lc1UVf-VE&si=abc&feature=shared&t=42'), 'https://youtu.be/M7lc1UVf-VE?t=42');
  assert.equal(clean('https://m.youtube.com/watch?v=M7lc1UVf-VE&list=PL123&index=4'), 'https://youtu.be/M7lc1UVf-VE?list=PL123&index=4');
  assert.equal(clean('https://www.youtube.com/shorts/M7lc1UVf-VE?feature=share'), 'https://youtu.be/M7lc1UVf-VE');
  assert.equal(clean('https://youtu.be/M7lc1UVf-VE?si=xyz'), 'https://youtu.be/M7lc1UVf-VE');
});

test('youtube pages without a video only lose tracking', () => {
  assert.equal(clean('https://www.youtube.com/@channel/videos?si=abc'), 'https://www.youtube.com/@channel/videos');
});

test('site-specific keys stay on other sites', () => {
  assert.equal(clean('https://example.org/?si=1&t=2&ref=3'), 'https://example.org/?si=1&t=2&ref=3');
});

test('non-web addresses pass through', () => {
  assert.equal(clean('about:blank'), 'about:blank');
  assert.equal(clean('not a url'), 'not a url');
});
