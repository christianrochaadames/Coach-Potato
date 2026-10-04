import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import type { FacebookAuthorization, FacebookConnection } from '@workspace/api-client-react';
import { authFetch } from '@/utils/authFetch';
import { BuddyRequestError, buddyQueryKeys } from '@/utils/buddies';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app'}/api/buddies/facebook`;
export const FACEBOOK_LIMIT = 30;

async function call<T>(path: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await authFetch(`${API}${path}`, {
    method, signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new BuddyRequestError(
      response.status === 401 ? 'Your session expired. Please sign in again.'
        : typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.',
      response.status);
  }
  return response.json() as Promise<T>;
}

const fbRoot = (account: string | null | undefined) => [...buddyQueryKeys.root(account), 'facebook'];

export function useFacebookConnection(offset: number) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: [...fbRoot(userId), offset],
    queryFn: ({ signal }) => call<FacebookConnection>(`?limit=${FACEBOOK_LIMIT}&offset=${offset}`, 'GET', undefined, signal),
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: query => (query.state.data?.pending ? 3000 : false),
  });
}

export function useFacebookActions() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: fbRoot(userId) });
  const begin = useMutation({
    mutationFn: () => call<FacebookAuthorization>('/connect', 'POST', { returnTo: 'native' }),
  });
  const cancel = useMutation({
    mutationFn: () => call<{ success: boolean }>('/connect', 'DELETE'),
    onSettled: () => { void refresh(); },
  });
  const disconnect = useMutation({
    mutationFn: async () => {
      await client.cancelQueries({ queryKey: fbRoot(userId) });
      return call<{ success: boolean }>('', 'DELETE');
    },
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: fbRoot(userId) });
      client.setQueriesData<FacebookConnection>({ queryKey: fbRoot(userId) }, old => old ? {
        ...old, connected: false, pending: false, error: null, lastSyncedAt: null, results: [], total: 0, offset: 0,
      } : old);
      void refresh();
    },
  });
  return { begin, cancel, disconnect, refresh };
}
