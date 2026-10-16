import assert from 'node:assert/strict';
import test from 'node:test';
import { canRevealStartup } from './startup.ts';

test('a slow first launch never uncovers the empty index route', () => {
  assert.equal(canRevealStartup(false, true, []), false);
  assert.equal(canRevealStartup(false, true, ['index']), false);
  assert.equal(canRevealStartup(true, true, []), false);
  assert.equal(canRevealStartup(true, true, ['index']), false);
  assert.equal(canRevealStartup(true, true, ['(auth)', 'landing']), true);
});

test('normal launches retain the splash duration and allow real destinations', () => {
  assert.equal(canRevealStartup(true, false, ['(auth)', 'landing']), false);
  assert.equal(canRevealStartup(false, true, ['(tabs)']), false);
  assert.equal(canRevealStartup(true, true, ['(tabs)']), true);
  assert.equal(canRevealStartup(true, true, ['(tabs)', 'index']), true);
  assert.equal(canRevealStartup(true, true, ['onboarding']), true);
  assert.equal(canRevealStartup(true, true, ['title', 'show', '900']), true);
});
