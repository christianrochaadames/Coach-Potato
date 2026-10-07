import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import * as SplashScreen from 'expo-splash-screen';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Linking from 'expo-linking';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
import * as QuickActions from 'expo-quick-actions';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { setRawFetchTokenGetter } from '@/utils/authFetch';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { syncPendingProfile } from '@/utils/pendingProfile';

// ── Configure API base URL ──────────────────────────────────────────────────
const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
setBaseUrl(`https://${domain}`);
// Replit-managed Clerk uses the app's frontend API proxy in production. Native
// clients do not have the browser cookie transport, so omitting this prop can
// leave the UI signed in while every authenticated API request is 401.
const clerkProxyUrl =
  process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

// ── Stable module-level token slot ──────────────────────────────────────────
// Set up the getter ONCE at module load time so it is available before any
// component renders or TanStack Query fires its first fetch.  AuthTokenSync
// updates _clerkGetToken at each render so the getter always delegates to the
// latest Clerk session.
let _clerkGetToken: (() => Promise<string | null>) | null = null;
setAuthTokenGetter(() => (_clerkGetToken ? _clerkGetToken() : null));
setRawFetchTokenGetter(async () => (_clerkGetToken ? _clerkGetToken() : null));

// ── Clerk publishable key ────────────────────────────────────────────────────
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

// ── React Query client ──────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnMount: false,
    },
  },
});

// ── Keep splash screen visible while fonts + Clerk load ──────────────────────
SplashScreen.preventAutoHideAsync();

const splashVideo = require('../assets/videos/spud-motion-logo.mp4');
// Measured from the actual iOS-rendered MP4 frame. Keep every exposed layer on
// this exact value so the contained landscape video has no visible letterbox seam.
const splashSurface = '#D3C5F8';

function LaunchSplash({ onFinished }: { onFinished: () => void }) {
  const player = useVideoPlayer(splashVideo, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.audioMixingMode = 'mixWithOthers';
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  useEffect(() => {
    const timer = setTimeout(onFinished, 2_200);
    return () => clearTimeout(timer);
  }, [onFinished]);

  return (
    <View style={styles.launchSplash}>
      <VideoView
        player={player}
        style={styles.launchVideo}
        contentFit="contain"
        nativeControls={false}
      />
    </View>
  );
}

// ── Auth token sync ──────────────────────────────────────────────────────────
// Wires Clerk session token into API client. Works anywhere inside ClerkProvider
// (does NOT need ClerkLoaded — useAuth returns isLoaded:false until ready).
function AuthTokenSync() {
  const { getToken, isSignedIn, isLoaded, userId } = useAuth();
  const previousUserId = useRef<string | null | undefined>(undefined);
  const getTokenRef = useRef(getToken);
  const identityRef = useRef({ isLoaded, isSignedIn, userId });
  getTokenRef.current = getToken;
  identityRef.current = { isLoaded, isSignedIn, userId };

  useEffect(() => {
    // Register one stable getter. Clerk may recreate getToken on renders;
    // replacing the module-level getter on every render creates a cleanup
    // window where requests can leave without an Authorization header.
    const stableGetter = () => getTokenRef.current();
    _clerkGetToken = stableGetter;
    return () => {
      // On unmount clear the slot so stale calls don't succeed after logout.
      if (_clerkGetToken === stableGetter) _clerkGetToken = null;
    };
  }, []);

  // Apply profile data only to the Clerk user created by its verified signup.
  // Cleanup is invalidated on identity changes, so an in-flight operation can
  // never finish against a different account.
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    const effectUserId = isSignedIn ? userId : null;
    const isCurrentIdentity = () =>
      active &&
      identityRef.current.isLoaded &&
      identityRef.current.isSignedIn === isSignedIn &&
      identityRef.current.userId === userId;

    void syncPendingProfile({
      storage: SecureStore,
      userId: effectUserId,
      isCurrentIdentity,
      getToken: () => getTokenRef.current(),
      patchProfile: async (profile, token) => {
        const apiDomain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
        return fetch(`https://${apiDomain}/api/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(profile),
        });
      },
    }).catch(() => {
      // Leave saved profile data in place; the next authenticated sync can retry.
    });
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, userId]);

  // Never let TanStack Query data from one Clerk account survive a logout or
  // account switch. The same native navigation tree can remain mounted while
  // Clerk changes sessions, so clearing only in the Profile screen is not enough.
  useEffect(() => {
    if (!isLoaded) return;
    if (previousUserId.current !== userId) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [isLoaded, userId]);

  return null;
}

function AppContent() {
  const { isLoaded, isSignedIn } = useAuth();
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const previousSignedIn = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const hasLoggedOut =
      previousSignedIn.current === true && isSignedIn === false;

    if (hasLoggedOut) {
      setShowLaunchSplash(true);
    }

    previousSignedIn.current = isSignedIn;
  }, [isLoaded, isSignedIn]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="log-entry"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="entry/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="title/[type]/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="buddies/index" options={{ headerShown: false }} />
        <Stack.Screen name="buddies/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="buddies/[userId]/shelf" options={{ headerShown: false }} />
      </Stack>
      {showLaunchSplash ? (
        <LaunchSplash onFinished={() => setShowLaunchSplash(false)} />
      ) : null}
    </>
  );
}

// ── Deep-link handler ────────────────────────────────────────────────────────
function useDeepLinkHandler() {
  const url = Linking.useURL();
  useEffect(() => {
    if (!url) return;
    try {
      const parsed = Linking.parse(url);
      const path = parsed.hostname ?? parsed.path ?? '';
      if (path === 'log-entry' || path === '/log-entry') {
        router.push('/log-entry');
      } else if (path === 'watchlist') {
        router.push('/(tabs)/watchlist');
      }
    } catch {
      // ignore malformed URLs
    }
  }, [url]);
}

// ── Quick-action handler ─────────────────────────────────────────────────────
function useQuickActionHandler() {
  useQuickActionCallback((action) => {
    if (action.id === 'log-entry') {
      router.push('/log-entry');
    } else if (action.id === 'watchlist') {
      router.push('/(tabs)/watchlist');
    }
  });
}

async function registerQuickActions() {
  try {
    const supported = await QuickActions.isSupported();
    if (!supported) return;
    await QuickActions.setItems([
      { id: 'log-entry', title: 'Log Entry', subtitle: 'Log a movie or show', icon: 'add' },
      { id: 'watchlist', title: 'My Watchlist', subtitle: 'View your watchlist', icon: 'bookmark' },
    ]);
  } catch {
    // Quick actions are optional
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    registerQuickActions();
  }, [fontsLoaded, fontError]);

  useDeepLinkHandler();
  useQuickActionHandler();

  // Don't render anything until fonts are ready — splash covers the blank.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={clerkProxyUrl}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <KeyboardProvider>
                {/* AuthTokenSync needs ClerkProvider above it but nothing else */}
                <AuthTokenSync />
                <AppContent />
              </KeyboardProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  launchSplash: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: splashSurface,
    zIndex: 100,
  },
  launchVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: splashSurface,
  },
});
