import assert from 'node:assert/strict';
import test from 'node:test';
import { InfiniteQueryObserver, QueryClient, QueryObserver } from '@tanstack/react-query';
import { BuddyRequestError, isBuddyAccessError, purgeBuddyProtectedCache, verifyBuddyFocus } from './buddyPrivacy.ts';

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

test('a canceled focus refetch returning cached success is not verification', async () => {
  const client = makeClient();
  const queryKey = ['buddies', 'viewer', 'entries', 'buddy', 'watching'];
  let calls = 0;
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  let finishRefetch;
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: () => {
      calls += 1;
      if (calls === 1) return Promise.resolve('cached page');
      return new Promise(resolve => {
        finishRefetch = resolve;
        notifyStarted();
      });
    },
    retry: false,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await observer.refetch();
  const updateCount = client.getQueryState(queryKey).dataUpdateCount;
  let verified = false;
  let refetchResult;
  const checking = verifyBuddyFocus(
    async () => {
      refetchResult = await observer.refetch();
      return refetchResult;
    },
    () => true,
    () => { verified = true; },
    () => client.getQueryState(queryKey).dataUpdateCount > updateCount,
  );
  await started;
  await client.cancelQueries({ queryKey });
  await checking;
  assert.equal(refetchResult.isSuccess, true);
  assert.equal(verified, false);
  finishRefetch('late stale result');
  unsubscribe();
  client.clear();
});

test('a 403 on pagination clears the cached pages and protected buddy detail', async () => {
  const client = makeClient();
  const detailKey = ['buddies', 'viewer', 'detail', 'buddy'];
  const entriesKey = ['buddies', 'viewer', 'entries', 'buddy', 'watching'];
  let nextPageAttempts = 0;
  const observer = new InfiniteQueryObserver(client, {
    queryKey: entriesKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      if (pageParam === 0) return Promise.resolve({ items: ['visible'], next: 1 });
      nextPageAttempts += 1;
      return Promise.reject(new BuddyRequestError('Access revoked.', 403));
    },
    getNextPageParam: page => page.next,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  client.setQueryData(detailKey, { status: 'accepted', person: { bio: 'private' } });
  await observer.refetch();
  const failedPage = await observer.fetchNextPage();

  assert.equal(nextPageAttempts, 1);
  assert.equal(failedPage.isFetchNextPageError, true);
  assert.equal(isBuddyAccessError(failedPage.error), true);
  await purgeBuddyProtectedCache(client, 'viewer', 'buddy');
  assert.equal(client.getQueryData(entriesKey), undefined);
  assert.equal(client.getQueryData(detailKey), undefined);
  unsubscribe();
  client.clear();
});

test('transient pagination errors preserve loaded pages and can be retried', async () => {
  const client = makeClient();
  const entriesKey = ['buddies', 'viewer', 'entries', 'buddy', 'watching'];
  let nextPageAttempts = 0;
  const observer = new InfiniteQueryObserver(client, {
    queryKey: entriesKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      if (pageParam === 0) return Promise.resolve({ items: ['first'], next: 1 });
      nextPageAttempts += 1;
      if (nextPageAttempts === 1) return Promise.reject(new Error('Network unavailable.'));
      return Promise.resolve({ items: ['second'], next: undefined });
    },
    getNextPageParam: page => page.next,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await observer.refetch();
  const failedPage = await observer.fetchNextPage();

  assert.equal(failedPage.isFetchNextPageError, true);
  assert.equal(isBuddyAccessError(failedPage.error), false);
  assert.deepEqual(failedPage.data?.pages.map(page => page.items), [['first']]);
  const retriedPage = await observer.fetchNextPage();
  assert.deepEqual(retriedPage.data?.pages.map(page => page.items), [['first'], ['second']]);
  unsubscribe();
  client.clear();
});

test('removal aborts in-flight protected reads before purging, ignoring late responses', async () => {
  const client = makeClient();
  const detailKey = ['buddies', 'viewer', 'detail', 'buddy'];
  const entriesKey = ['buddies', 'viewer', 'entries', 'buddy'];
  let signal;
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  let finishRead;
  const lateResponse = new Promise(resolve => { finishRead = resolve; });
  const pendingRead = client.fetchQuery({
    queryKey: detailKey,
    queryFn: ({ signal: requestSignal }) => {
      signal = requestSignal;
      notifyStarted();
      return lateResponse;
    },
  });
  client.setQueryData(entriesKey, { pages: [{ items: ['private'] }], pageParams: [0] });
  await started;
  await purgeBuddyProtectedCache(client, 'viewer', 'buddy');

  assert.equal(signal?.aborted, true);
  assert.equal(client.getQueryData(detailKey), undefined);
  assert.equal(client.getQueryData(entriesKey), undefined);
  finishRead({ bio: 'late private response' });
  await pendingRead.catch(() => undefined);
  assert.equal(client.getQueryData(detailKey), undefined);
  client.clear();
});