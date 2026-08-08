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
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
import * as QuickActions from 'expo-quick-actions';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { setRawFetchTokenGetter } from '@/utils/authFetch';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ── Configure API base URL ──────────────────────────────────────────────────
const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
setBaseUrl(`https://${domain}`);

// ── Clerk publishable key ────────────────────────────────────────────────────
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

// ── React Query client ──────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// ── Keep splash screen visible while fonts + Clerk load ──────────────────────
SplashScreen.preventAutoHideAsync();

// ── Auth token sync ──────────────────────────────────────────────────────────
// Wires Clerk session token into API client. Works anywhere inside ClerkProvider
// (does NOT need ClerkLoaded — useAuth returns isLoaded:false until ready).
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

  // After sign-up, flush any pending profile data that was saved to SecureStore
  // before the session existed.
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
        // Non-fatal — user can update from Profile tab
      }
    })();
  }, [isSignedIn, getToken]);

  return null;
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
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <KeyboardProvider>
                {/* AuthTokenSync needs ClerkProvider above it but nothing else */}
                <AuthTokenSync />
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
          </ErrorBoundary>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}
