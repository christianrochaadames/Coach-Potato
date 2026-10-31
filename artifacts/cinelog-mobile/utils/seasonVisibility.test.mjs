import test from 'node:test';
import assert from 'node:assert/strict';
import { isVisibleSeason } from './seasonVisibility.ts';

test('The Gentlemen hides its empty Season 3 but retains Seasons 1 and 2', () => {
  const seasons = [
    { number: 1, episodeCount: 8, posterUrl: 'season1.jpg', airYear: 2024 },
    { number: 2, episodeCount: 8, posterUrl: 'season2.jpg', airYear: 2026 },
    { number: 3, episodeCount: 0, posterUrl: null, airYear: null },
  ];
  assert.deepEqual(seasons.filter(isVisibleSeason).map(s => s.number), [1, 2]);
});

test('empty announcements stay hidden regardless of season number or generic name', () => {
  for (const number of [1, 3, 12]) {
    assert.equal(isVisibleSeason({ number }), false);
    assert.equal(isVisibleSeason({ number, episodeCount: 0, posterUrl: '  ', airYear: null }), false);
  }
});

test('real information keeps a season visible, including upcoming or posterless seasons', () => {
  assert.equal(isVisibleSeason({ number: 2, episodeCount: 8 }), true);
  assert.equal(isVisibleSeason({ number: 2, posterUrl: 'poster.jpg' }), true);
  assert.equal(isVisibleSeason({ number: 2, airYear: 2030 }), true);
  assert.equal(isVisibleSeason({ number: 2, episodeCount: 0, airYear: NaN }), false);
  assert.equal(isVisibleSeason({ number: 0, episodeCount: 10, posterUrl: 'specials.jpg' }), false);
});

test('filtering does not renumber seasons or change saved watch history', () => {
  const summaries = [{ number: 1, episodeCount: 8 }, { number: 2 }, { number: 3, episodeCount: 6 }];
  const history = [{ number: 2, status: 'plan_to_watch', notes: 'Keep this' }];
  const before = structuredClone(history);
  assert.deepEqual(summaries.filter(isVisibleSeason).map(s => s.number), [1, 3]);
  assert.deepEqual(history, before);
});
