/**
 * useFacebook
 *
 * Handles the Facebook OAuth flow for social-friends discovery.
 * This is separate from Clerk authentication — it lets the user link
 * their Facebook account so CouchPotato can find friends who are also
 * on the app.
 *
 * Requires EXPO_PUBLIC_FACEBOOK_APP_ID to be set.
 * The corresponding Facebook App must have the "Friends List" permission
 * approved and the bundle ID com.couchpotato.ios registered.
 */

import { useCallback, useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const FB_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

const FB_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
};

export interface FbFriend {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarId: string | null;
  fbName: string | null;
  fbPicture: string | null;
}

interface UseFacebookResult {
  /** Whether EXPO_PUBLIC_FACEBOOK_APP_ID is configured */
  isConfigured: boolean;
  /** Whether the current user has connected their Facebook account */
  isConnected: boolean;
  /** True while connecting or loading friends */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Friends on CouchPotato (populated after connecting) */
  friends: FbFriend[];
  /** Trigger the Facebook OAuth popup to connect */
  connect: () => Promise<void>;
  /** Remove the stored Facebook link */
  disconnect: () => Promise<void>;
  /** Re-fetch the friends list using a cached token */
  refreshFriends: () => Promise<void>;
  /** Access token after OAuth completes (kept in memory only) */
  accessToken: string | null;
}

export function useFacebook(apiBaseUrl: string): UseFacebookResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<FbFriend[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'couchpotato' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: FB_APP_ID ?? '__not_configured__',
      scopes: ['public_profile', 'user_friends'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      extraParams: { display: 'popup' },
    },
    FB_DISCOVERY
  );

  // Check connection status on mount
  useEffect(() => {
    if (!FB_APP_ID) return;
    fetch(`${apiBaseUrl}/api/facebook/status`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setIsConnected(!!d.connected))
      .catch(() => {});
  }, [apiBaseUrl]);

  // Handle OAuth response
  useEffect(() => {
    if (!response) return;
    if (response.type === 'success' && response.params.access_token) {
      const token = response.params.access_token;
      handleOAuthSuccess(token);
    } else if (response.type === 'error') {
      setError(response.error?.message ?? 'Facebook sign-in failed');
    }
  }, [response]);

  async function handleOAuthSuccess(token: string) {
    setIsLoading(true);
    setError(null);
    try {
      // Get the Facebook user ID
      const meRes = await fetch(
        `https://graph.facebook.com/me?access_token=${encodeURIComponent(token)}&fields=id`
      );
      const me: { id: string } = await meRes.json();

      // Save to our backend
      const connectRes = await fetch(`${apiBaseUrl}/api/facebook/connect`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebookId: me.id, accessToken: token }),
      });
      if (!connectRes.ok) throw new Error('Failed to save Facebook connection');

      setAccessToken(token);
      setIsConnected(true);

      // Immediately load friends
      await loadFriends(token);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadFriends(token: string) {
    const res = await fetch(
      `${apiBaseUrl}/api/facebook/friends?accessToken=${encodeURIComponent(token)}`,
      { credentials: 'include' }
    );
    if (!res.ok) return;
    const data: { friends: FbFriend[] } = await res.json();
    setFriends(data.friends);
  }

  const connect = useCallback(async () => {
    if (!FB_APP_ID) return;
    setError(null);
    await promptAsync();
  }, [promptAsync]);

  const disconnect = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/facebook/disconnect`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setIsConnected(false);
      setAccessToken(null);
      setFriends([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const refreshFriends = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await loadFriends(accessToken);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  return {
    isConfigured: !!FB_APP_ID,
    isConnected,
    isLoading,
    error,
    friends,
    connect,
    disconnect,
    refreshFriends,
    accessToken,
  };
}
