import { useEffect, useRef } from 'react';
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
import * as Linking from 'expo-linking';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
import * as QuickActions from 'expo-quick-actions';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { setRawFetchTokenGetter } from '@/utils/authFetch';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ── Configure API base URL ──────────────────────────────────────────────────
// EXPO_PUBLIC_DOMAIN must be set — on native there is no browser cookie jar so
// relative URLs like /api/... are not valid. Fail fast in dev if missing.
const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (!domain) {
  console.error(
    '[Spud] EXPO_PUBLIC_DOMAIN is not set. ' +
    'API calls will fail on native. ' +
    'Set EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN in your dev script.'
  );
} else {
  setBaseUrl(`https://${domain}`);
}

// ── Clerk publishable key (injected via EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) ──
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

// ── React Query client ──────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// ── Keep splash screen visible while fonts load ─────────────────────────────
SplashScreen.preventAutoHideAsync();

// ── Routing guard ────────────────────────────────────────────────────────────
// Handles ALL initial navigation once Clerk + fonts are ready.
// Lives INSIDE ClerkLoaded so the Stack is guaranteed to be mounted before we
// call router.replace(), and we keep the splash screen visible until we know
// which screen to show — preventing the "pages flashing then blank" race.
function RoutingGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  const didNavigate = useRef(false);

  useEffect(() => {
    if (!isLoaded || didNavigate.current) return;
    didNavigate.current = true;

    // Navigate to the right screen. The destination screen is responsible
    // for calling SplashScreen.hideAsync() once it has rendered, so the
    // splash stays visible right up until the screen is actually painted.
    if (!isSignedIn) {
      router.replace('/(auth)/sign-in');
    }
    // Signed-in users: tabs/_layout.tsx calls hideAsync on mount.
  }, [isLoaded]);

  return null;
}

// ── Auth token sync ──────────────────────────────────────────────────────────
// Wires the Clerk session token into the API client so every request carries
// an Authorization: Bearer header. Lives here — not only in (tabs)/_layout —
// so deep-link cold-starts (e.g. couchpotato://log-entry) are also covered.
function AuthTokenSync() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setRawFetchTokenGetter(() => getToken());
    return () => {
      setAuthTokenGetter(null);
      setRawFetchTokenGetter(null);
    };
  }, [getToken]);

  // After sign-up, save the name + username that were collected during
  // registration but couldn't be persisted without a valid session.
  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const pending = await SecureStore.getItemAsync('pendingProfile');
        if (!pending) return;
        const profile = JSON.parse(pending);
        const token = await getToken();
        if (!token) return;
        const apiDomain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
        await fetch(`https://${apiDomain}/api/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(profile),
        });
        await SecureStore.deleteItemAsync('pendingProfile');
      } catch {
        // Non-fatal — profile can be updated from the Profile tab
      }
    })();
  }, [isSignedIn, getToken]);

  return null;
}

// ── Deep-link handler ────────────────────────────────────────────────────────
// expo-router auto-resolves scheme-based deep links via file routes.
// This hook also handles links received while the app is already running.
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
// Handles iOS long-press app-icon shortcuts and Android app shortcuts.
// Works for cold-start (initial action) and foreground activation.
function useQuickActionHandler() {
  useQuickActionCallback((action) => {
    if (action.id === 'log-entry') {
      router.push('/log-entry');
    } else if (action.id === 'watchlist') {
      router.push('/(tabs)/watchlist');
    }
  });
}

// ── Register quick action items on first launch ──────────────────────────────
async function registerQuickActions() {
  try {
    const supported = await QuickActions.isSupported();
    if (!supported) return;
    await QuickActions.setItems([
      { id: 'log-entry', title: 'Log Entry', subtitle: 'Log a movie or show', icon: 'add' },
      { id: 'watchlist', title: 'My Watchlist', subtitle: 'View your watchlist', icon: 'bookmark' },
    ]);
  } catch {
    // Quick actions are optional — fail silently
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
    // Quick actions don't depend on Clerk — register as soon as fonts are ready.
    // Routing and SplashScreen.hideAsync() are handled by RoutingGuard inside
    // ClerkLoaded so we're guaranteed the Stack is mounted before navigating.
    registerQuickActions();
  }, [fontsLoaded, fontError]);

  useDeepLinkHandler();
  useQuickActionHandler();

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
      <ClerkLoaded>
        <RoutingGuard />
        <AuthTokenSync />
        <ErrorBoundary>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
              <QueryClientProvider client={queryClient}>
                <KeyboardProvider>
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
                  </Stack>
                </KeyboardProvider>
              </QueryClientProvider>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </ErrorBoundary>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
