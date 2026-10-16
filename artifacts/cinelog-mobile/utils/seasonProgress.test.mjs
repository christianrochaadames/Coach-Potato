import assert from 'node:assert/strict';
import test from 'node:test';
import { upsertSeasonProgress } from './seasonProgress.ts';

test('watched season stores the chosen year and rating without changing another season', () => {
  const other = { number: 2, status: 'watching', rating: null };
  const saved = upsertSeasonProgress([other], { number: 1, status: 'watched', year: 2020, rating: 4 });
  assert.deepEqual(saved[0], { number: 1, status: 'watched', dateWatched: '2020-01-01', rating: 4 });
  assert.equal(saved[1], other);
});
test('editing watch details preserves notes and episode progress without mutating inputs', () => {
  const original = { number: 1, status: 'watched', notes: 'Keep', episodes: [{ number: 1, watched: true }], dateWatched: '2020-01-01', rating: 3 };
  const [edited] = upsertSeasonProgress([original], { number: 1, status: 'watched', year: 2021, rating: 5 });
  assert.equal(edited.notes, 'Keep');
  assert.equal(edited.episodes, original.episodes);
  assert.equal(original.rating, 3);
  assert.equal(edited.rating, 5);
});
for (const status of ['watching', 'plan_to_watch']) {
  test(`${status} persists independently and clears watched-only fields`, () => {
    const [saved] = upsertSeasonProgress([{ number: 1, status: 'watched', rating: 5 }], { number: 1, status, year: 2020, rating: 4 });
    assert.equal(saved.status, status);
    assert.equal(saved.dateWatched, null);
    assert.equal(saved.rating, null);
  });
}
test('rating can be cleared and duplicates of the edited season are removed', () => {
  const saved = upsertSeasonProgress([{ number: 1 }, { number: 1 }], { number: 1, status: 'watched', year: 2020, rating: 0 });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].rating, null);
});
test('invalid metadata is rejected rather than saved', () => {
  assert.throws(() => upsertSeasonProgress([], { number: 0, status: 'watched', year: 2020, rating: 5 }));
  assert.throws(() => upsertSeasonProgress([], { number: 1, status: 'watched', year: 2020, rating: 6 }));
});
