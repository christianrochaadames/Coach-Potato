/**
 * Authenticated fetch wrapper for raw API calls.
 *
 * Mirrors the pattern used by @workspace/api-client-react:
 *   setAuthTokenGetter() stores the Clerk token getter once (in AuthTokenSync),
 *   and authFetch() calls it before every request to attach the bearer token.
 *
 * Use this for any `fetch(...)` call that hits a requireAuth-protected endpoint.
 */

let _getToken: (() => Promise<string | null>) | null = null;

/** Call once in AuthTokenSync (app/_layout.tsx) alongside setAuthTokenGetter. */
export function setRawFetchTokenGetter(getter: (() => Promise<string | null>) | null) {
  _getToken = getter;
}

/**
 * Drop-in replacement for `fetch` that attaches a Clerk bearer token.
 * Falls back to an unauthenticated request if no token getter has been set.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = _getToken ? await _getToken() : null;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
