import assert from 'node:assert/strict';
import test from 'node:test';
import { getShowTrackingMode, projectSeasonShelves } from './seasonShelves.ts';
import { upsertSeasonProgress } from './seasonProgress.ts';

const show = { id: 12, tmdbId: 73586, title: 'Yellowstone', type: 'show',
  status: 'watching', year: null, posterUrl: 'series.jpg', notes: 'Private notes' };

test('watched and watching seasons coexist, with their own artwork and history year', () => {
  const seasons = [
    { number: 1, status: 'watched', dateWatched: '2024-01-01', rating: 4 },
    { number: 2, status: 'watching' },
    { number: 3, status: 'plan_to_watch' },
  ];
  const parent = { ...show, seasons };
  const cards = projectSeasonShelves([parent], { '12:1': 's1.jpg', '12:2': 's2.jpg', '12:3': 's3.jpg' });
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map(card => card.status), ['completed', 'watching', 'plan_to_watch']);
  assert.equal(cards[0].year, 2024);
  assert.equal(cards[0].posterUrl, 's1.jpg');
  assert.equal(cards[1].posterUrl, 's2.jpg');
  assert.equal(cards[0].rating, 4);
  assert.equal(cards[0].shelfTitle, 'Yellowstone · Season 1');
  assert.equal(new Set(cards.map(card => card.shelfKey)).size, 3);
  cards.forEach(card => assert.equal(card.parentEntry, parent));
  assert.equal(parent.status, 'watching');
});

test('saving season two never removes season one or its year, notes and episode progress', () => {
  const initial = upsertSeasonProgress([], { number: 1, status: 'watched', year: 2024, rating: 4 });
  initial[0].notes = 'Keep';
  initial[0].episodes = [{ number: 1, watched: true }];
  const seasons = upsertSeasonProgress(initial, { number: 2, status: 'watching', year: 2026, rating: 0 });
  const cards = projectSeasonShelves([{ ...show, seasons }]);
  assert.equal(cards[0].year, 2024);
  assert.equal(seasons[0].notes, 'Keep');
  assert.deepEqual(seasons[0].episodes, [{ number: 1, watched: true }]);
  assert.equal(cards[1].status, 'watching');
  assert.equal(cards[1].posterUrl, null);
});

test('untracked shows and movies retain existing whole-title display', () => {
  const movie = { ...show, id: 13, type: 'movie' };
  const cards = projectSeasonShelves([show, movie]);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].posterUrl, 'series.jpg');
  assert.equal(cards[0].seasonNumber, null);
});

test('editing watched year moves only that season; duplicate seasons are displayed once', () => {
  const seasons = upsertSeasonProgress([
    { number: 1, status: 'watched', dateWatched: '2024-01-01' },
    { number: 2, status: 'watched', dateWatched: '2025-01-01' },
  ], { number: 1, status: 'watched', year: 2023, rating: 5 });
  const cards = projectSeasonShelves([{ ...show, seasons: [...seasons, seasons[1]] }]);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map(card => card.year), [2023, 2025]);
});

test('whole-show choice restores series poster without deleting seasonal history', () => {
  const seasons = [
    { number: 1, status: 'watched', dateWatched: '2024-01-01', rating: 4 },
    { number: 2, status: 'watching' },
  ];
  const parent = { ...show, status: 'completed', dateWatched: '2025-01-01',
    year: 2025, rating: 5, seasons, trackingMode: 'whole_show' };
  const snapshot = JSON.stringify(parent);
  const cards = projectSeasonShelves([parent]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].seasonNumber, null);
  assert.equal(cards[0].posterUrl, 'series.jpg');
  assert.equal(cards[0].year, 2025);
  assert.equal(cards[0].rating, 5);
  assert.equal(cards[0].shelfTitle, 'Yellowstone');
  assert.equal(JSON.stringify(parent), snapshot);

  const seasonal = projectSeasonShelves([{ ...parent, trackingMode: 'seasons' }]);
  assert.equal(seasonal.length, 2);
  assert.equal(seasonal[0].year, 2024);
  assert.equal(seasonal[1].status, 'watching');
  assert.equal(JSON.stringify(parent), snapshot);
});

test('choosing seasons before logging one does not fabricate a whole-show card', () => {
  assert.deepEqual(projectSeasonShelves([{ ...show, trackingMode: 'seasons', seasons: [] }]), []);
});

test('scope resolution is explicit and backward-compatible with legacy history', () => {
  const seasons = [{ number: 1, status: 'watched' }];
  assert.equal(getShowTrackingMode(null), 'whole_show');
  assert.equal(getShowTrackingMode({ seasons: [] }), 'whole_show');
  assert.equal(getShowTrackingMode({ seasons }), 'seasons');
  assert.equal(getShowTrackingMode({ seasons, trackingMode: 'whole_show' }), 'whole_show');
  assert.equal(getShowTrackingMode({ trackingMode: 'seasons', seasons: [] }), 'seasons');
  assert.equal(getShowTrackingMode({ trackingMode: null, seasons }), 'seasons');
  assert.equal(getShowTrackingMode({ seasons: [{ number: 0, status: 'watched' }] }), 'whole_show');
});

test('movie cards are never hidden by TV tracking scope', () => {
  const cards = projectSeasonShelves([{ ...show, type: 'movie', trackingMode: 'seasons' }]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].posterUrl, 'series.jpg');
});
