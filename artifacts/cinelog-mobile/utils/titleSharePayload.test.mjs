import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTitleSharePayload } from './titleSharePayload.ts';

test('title share has the requested branded subtitle and retains its real link', () => {
  const result = buildTitleSharePayload({
    title: 'MobLand', year: 2025,
    shareUrl: 'https://example.com/api/share/show/900',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  });
  assert.equal(result.heading, 'Check out MobLand (2025) on Spud');
  assert.equal(result.subtitle, 'Spud [TV show and movie tracker]');
  assert.equal(result.url, 'https://example.com/api/share/show/900');
  assert.equal(result.posterUrl, 'https://image.tmdb.org/t/p/w500/poster.jpg');
  assert.equal(result.message, `${result.heading}\n${result.url}`);
});

test('movies and unmatched manual titles share cleanly without a fabricated year', () => {
  const input = {
    title: 'My movie', year: null, shareUrl: 'https://example.com/api/share/unmatched',
    notes: 'Private note', rating: 3, dateWatched: '2024-01-01',
  };
  const result = buildTitleSharePayload(input);
  assert.equal(result.heading, 'Check out My movie on Spud');
  assert.equal(result.posterUrl, null);
  assert.equal(Object.keys(result).length, 5);
  assert.ok(!JSON.stringify(result).includes('Private note'));
  assert.ok(!JSON.stringify(result).includes('2024'));
});
