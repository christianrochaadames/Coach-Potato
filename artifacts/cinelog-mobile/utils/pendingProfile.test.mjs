import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_PENDING_PROFILE_KEY,
  PENDING_PROFILE_KEY,
  savePendingProfile,
  syncPendingProfile,
} from './pendingProfile.ts';

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    values,
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => values.set(key, value),
    deleteItemAsync: async (key) => values.delete(key),
  };
}

test('existing-account login clears abandoned unbound signup data without applying it', async () => {
  const storage = createStorage({
    [LEGACY_PENDING_PROFILE_KEY]: JSON.stringify({
      firstName: 'Abandoned',
      lastName: 'Signup',
      username: 'abandoned',
    }),
  });
  let patchCalls = 0;

  await syncPendingProfile({
    storage,
    userId: 'user_existing',
    isCurrentIdentity: () => true,
    getToken: async () => 'existing-token',
    patchProfile: async () => {
      patchCalls += 1;
      return { ok: true };
    },
  });

  assert.equal(storage.values.has(LEGACY_PENDING_PROFILE_KEY), false);
  assert.equal(patchCalls, 0);
});

test('matching Clerk identity receives the pending profile and successful PATCH consumes it', async () => {
  const storage = createStorage();
  const profile = { firstName: 'Verified', lastName: 'Viewer', username: 'verified' };
  await savePendingProfile(storage, 'user_signup', profile);
  let patchedProfile;

  await syncPendingProfile({
    storage,
    userId: 'user_signup',
    isCurrentIdentity: () => true,
    getToken: async () => 'matching-token',
    patchProfile: async (body, token) => {
      assert.equal(token, 'matching-token');
      patchedProfile = body;
      return { ok: true };
    },
  });

  assert.deepEqual(patchedProfile, profile);
  assert.equal(storage.values.has(PENDING_PROFILE_KEY), false);
});

test('failed PATCH retries once and retains the pending profile', async () => {
  const storage = createStorage();
  await savePendingProfile(storage, 'user_signup', { firstName: 'Retry' });
  let patchCalls = 0;

  await syncPendingProfile({
    storage,
    userId: 'user_signup',
    isCurrentIdentity: () => true,
    getToken: async () => 'signup-token',
    patchProfile: async () => {
      patchCalls += 1;
      return { ok: false };
    },
    waitBeforeRetry: async () => {},
  });

  assert.equal(patchCalls, 2);
  assert.ok(storage.values.has(PENDING_PROFILE_KEY));
});

test('identity switch while token retrieval is pending prevents PATCH and preserves data', async () => {
  const storage = createStorage();
  await savePendingProfile(storage, 'user_signup', { firstName: 'Signup' });
  let isCurrent = true;
  let releaseToken;
  let tokenRequested;
  const requested = new Promise((resolve) => {
    tokenRequested = resolve;
  });
  const tokenResult = new Promise((resolve) => {
    releaseToken = resolve;
  });
  let patchCalls = 0;

  const operation = syncPendingProfile({
    storage,
    userId: 'user_signup',
    isCurrentIdentity: () => isCurrent,
    getToken: async () => {
      tokenRequested();
      return tokenResult;
    },
    patchProfile: async () => {
      patchCalls += 1;
      return { ok: true };
    },
  });

  await requested;
  isCurrent = false;
  releaseToken('stale-signup-token');
  await operation;

  assert.equal(patchCalls, 0);
  assert.ok(storage.values.has(PENDING_PROFILE_KEY));
});