import type { QueryClient } from '@tanstack/react-query';

type FocusRefetchResult = { isSuccess: boolean };

export class BuddyRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'BuddyRequestError';
  }
}

export async function verifyBuddyFocus(
  refetch: () => Promise<FocusRefetchResult>,
  isCurrentFocus: () => boolean,
  markVerified: () => void,
  hasFreshSuccessfulResponse: () => boolean,
) {
  try {
    const result = await refetch();
    if (isCurrentFocus() && result.isSuccess && hasFreshSuccessfulResponse()) markVerified();
  } catch {
    // Query state renders the error; a rejected focus refetch is never verification.
  }
}

export function isBuddyAccessError(error: unknown): error is Error & { status: number } {
  return error instanceof Error && 'status' in error &&
    (error.status === 401 || error.status === 403);
}

export async function purgeBuddyProtectedCache(
  client: QueryClient,
  accountId: string | null | undefined,
  buddyId: string,
  currentQueryKey?: readonly unknown[],
) {
  const detailKey = ['buddies', accountId, 'detail', buddyId] as const;
  const entriesKey = ['buddies', accountId, 'entries', buddyId] as const;
  const currentHash = currentQueryKey
    ? client.getQueryCache().find({ queryKey: currentQueryKey, exact: true })?.queryHash
    : undefined;

  // Cancellation aborts signal-aware reads and keeps late completions from
  // repopulating the cache after access has been revoked.
  await client.cancelQueries({ queryKey: detailKey, predicate: query => query.queryHash !== currentHash });
  await client.cancelQueries({ queryKey: entriesKey, predicate: query => query.queryHash !== currentHash });
  client.removeQueries({ queryKey: detailKey });
  client.removeQueries({ queryKey: entriesKey });
}