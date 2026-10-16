import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { authFetch } from '@/utils/authFetch';
import { BuddyRequestError, isBuddyAccessError, purgeBuddyProtectedCache } from './buddyPrivacy';
export { BuddyRequestError, isBuddyAccessError, purgeBuddyProtectedCache, verifyBuddyFocus } from './buddyPrivacy';

export type BuddyStatus = 'none' | 'incoming' | 'outgoing' | 'accepted';
export type ShelfStatus = 'watching' | 'plan_to_watch' | 'completed';
export type BuddyPerson = {
  userId: string;
  firstName: string;
  lastName: string | null;
  username: string;
  avatarId: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  status: BuddyStatus;
};
export type BuddyEntry = {
  title: string;
  type: string;
  status: string;
  posterUrl: string | null;
  tmdbId: number | null;
};
export type BuddyShelf = { count: number; items: BuddyEntry[] };
export type BuddyDetail = {
  person: BuddyPerson;
  status: BuddyStatus;
  favorites?: {
    tv: { title: string; posterUrl: string | null }[];
    movies: { title: string; posterUrl: string | null }[];
  };
  shelves?: Record<ShelfStatus, BuddyShelf>;
};
export type BuddyLists = {
  accepted: BuddyPerson[];
  incoming: BuddyPerson[];
  outgoing: BuddyPerson[];
};

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app'}/api/buddies`;
export const buddyQueryKeys = {
  root: (account: string | null | undefined) => ['buddies', account],
  lists: (account: string | null | undefined) => ['buddies', account, 'lists'],
  detail: (account: string | null | undefined, id: string) => ['buddies', account, 'detail', id],
  entries: (account: string | null | undefined, id: string, status?: ShelfStatus) =>
    ['buddies', account, 'entries', id, ...(status ? [status] : [])],
};

async function request<T>(path: string, method = 'GET', signal?: AbortSignal): Promise<T> {
  const response = await authFetch(`${API}${path}`, { method, signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new BuddyRequestError(
      response.status === 401 ? 'Your session expired. Please sign in again.'
        : typeof body?.error === 'string' ? body.error : 'Something went wrong. Please try again.',
      response.status,
    );
  }
  if (method !== 'GET') return undefined as T;
  return response.json() as Promise<T>;
}

export function useBuddyLists() {
  const { userId } = useAuth();
  return useQuery({ queryKey: buddyQueryKeys.lists(userId), queryFn: ({ signal }) => request<BuddyLists>('', 'GET', signal), enabled: !!userId, staleTime: 30_000 });
}
export function useBuddySearch(query: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: [...buddyQueryKeys.root(userId), 'search', query],
    queryFn: ({ signal }) => request<{ results: BuddyPerson[] }>(`/search?q=${encodeURIComponent(query)}`, 'GET', signal),
    enabled: !!userId && query.length >= 2,
    staleTime: 20_000,
  });
}
export function useBuddyDetail(id: string) {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useQuery({
    queryKey: buddyQueryKeys.detail(userId, id),
    queryFn: async ({ signal, queryKey }) => {
      try {
        return await request<BuddyDetail>(`/${encodeURIComponent(id)}`, 'GET', signal);
      } catch (error) {
        if (isBuddyAccessError(error)) void purgeBuddyProtectedCache(client, userId, id, queryKey);
        throw error;
      }
    },
    enabled: !!userId && !!id,
    staleTime: 20_000,
  });
}
export function useBuddyEntries(id: string, status: ShelfStatus) {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: buddyQueryKeys.entries(userId, id, status),
    enabled: !!userId && !!id,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal, queryKey }) => {
      try {
        return await request<{ total: number; items: BuddyEntry[] }>(
          `/${encodeURIComponent(id)}/entries?status=${status}&limit=30&offset=${pageParam}`, 'GET', signal,
        );
      } catch (error) {
        if (isBuddyAccessError(error)) void purgeBuddyProtectedCache(client, userId, id, queryKey);
        throw error;
      }
    },
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total && lastPage.items.length ? loaded : undefined;
    },
  });
}
export function useBuddyAction(id: string) {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: 'request' | 'accept' | 'reject' | 'cancel' | 'remove') =>
      request<void>(`/${encodeURIComponent(id)}${action === 'request' || action === 'accept' ? `/${action}` : ''}`,
        action === 'request' || action === 'accept' ? 'POST' : 'DELETE'),
    onSuccess: async (_, action) => {
      // Immediately hide protected fields when disconnecting; a refetch then
      // reconciles the canonical status from the server.
      if (action === 'remove' || action === 'reject' || action === 'cancel') {
        await purgeBuddyProtectedCache(client, userId, id);
        client.setQueryData<BuddyDetail>(buddyQueryKeys.detail(userId, id), previous => previous ? {
          person: { ...previous.person, bio: undefined, status: 'none' },
          status: 'none',
        } : previous);
      }
      void client.invalidateQueries({ queryKey: buddyQueryKeys.root(userId) });
    },
  });
}