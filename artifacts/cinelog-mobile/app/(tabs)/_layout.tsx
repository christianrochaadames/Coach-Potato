import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Redirect, Tabs, useFocusEffect, usePathname, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import * as SplashScreen from 'expo-splash-screen';
import { authFetch } from '@/utils/authFetch';
import { usePendingTitleRedirect } from '@/utils/pendingTitle';

const SPUD_PURPLE = '#5950C7';
const GLASS_BLUE = '#A7BFD4';
const NAVY_ICON = '#0A2840';
const TAB_BAR_SIZE = 62;
const TAB_ICON_SIZE = 58;

// ── Circular icon bubble ──────────────────────────────────────────────────────
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View
      style={{
        width: TAB_ICON_SIZE,
        height: TAB_ICON_SIZE,
        borderRadius: TAB_ICON_SIZE / 2,
        backgroundColor: focused ? GLASS_BLUE : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather
        name={name as any}
        size={25}
        color={NAVY_ICON}
      />
    </View>
  );
}

function FloatingTabBar() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const pillWidth = Math.min(Math.max(screenWidth - 32, 0), 232);
  const bottomOffset = Platform.OS === 'web' ? 12 : insets.bottom + 8;
  const leftOffset = Math.max((screenWidth - pillWidth) / 2, 16);
  const tabs = [
    { name: 'home', icon: 'home', href: '/(tabs)' },
    { name: 'search', icon: 'search', href: '/(tabs)/search' },
    { name: 'watchlist', icon: 'bookmark', href: '/(tabs)/watchlist' },
    { name: 'stats', icon: 'bar-chart-2', href: '/(tabs)/stats' },
    { name: 'profile', icon: 'user', href: '/(tabs)/profile' },
  ] as const;
  const activeName = pathname.includes('/search')
    ? 'search'
    : pathname.includes('/watchlist')
      ? 'watchlist'
      : pathname.includes('/stats')
        ? 'stats'
        : pathname.includes('/profile')
          ? 'profile'
          : 'home';

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
    >
      <View
        style={[styles.pill, { width: pillWidth, left: leftOffset, bottom: bottomOffset }]}
        pointerEvents="auto"
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 78 : 45}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.pillItems}>
          {tabs.map(tab => {
            const focused = activeName === tab.name;
            return (
              <Pressable
                key={tab.name}
                style={styles.pillItem}
                accessibilityRole="tab"
                accessibilityLabel={tab.name}
                accessibilityState={focused ? { selected: true } : {}}
                testID={`floating-tab-${tab.name}`}
                onPress={() => {
                  if (!focused) router.navigate(tab.href as any);
                }}
                onLongPress={() => {
                  router.navigate(tab.href as any);
                }}
              >
                <TabIcon name={tab.icon} focused={focused} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();
  const [routeReady, setRouteReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  // The tab layout can remain mounted while onboarding completes. Force the
  // profile gate to refresh when the authenticated shell becomes focused so a
  // successful completion cannot bounce the user back into onboarding.
  useFocusEffect(useCallback(() => {
    setFocusTick(value => value + 1);
  }, []));

  // Safety valve: always hide the splash after 8 seconds no matter what.
  useEffect(() => {
    const timer = setTimeout(() => void SplashScreen.hideAsync(), 8000);
    return () => clearTimeout(timer);
  }, []);

  // Hide splash for signed-in users once Clerk confirms the session.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void SplashScreen.hideAsync();
    }
  }, [isLoaded, isSignedIn, focusTick]);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded || !isSignedIn) {
      setRouteReady(isLoaded);
      setNeedsOnboarding(false);
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const res = await authFetch(
          `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app'}/api/profile`,
        );
        if (!cancelled && res.ok) {
          const profile = await res.json().catch(() => ({}));
          setNeedsOnboarding(profile?.onboardingCompleted !== true);
        }
      } catch {
        // Keep the authenticated shell available if the profile request is
        // temporarily offline; the profile gate retries on the next mount.
      } finally {
        if (!cancelled) setRouteReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  usePendingTitleRedirect(isLoaded && routeReady && !!isSignedIn && !needsOnboarding);

  if (!isLoaded || !routeReady) return null;

  if (!isSignedIn) {
    return <Redirect href="/(auth)/landing" />;
  }
  if (needsOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.tabShell}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
          // The system host is intentionally removed. The only visible
          // navigation surface is the sibling FloatingTabBar overlay.
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="watchlist" />
        <Tabs.Screen name="stats" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <FloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    flex: 1,
  },
  pill: {
    position: 'absolute',
    height: TAB_BAR_SIZE,
    borderRadius: TAB_BAR_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.58)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  pillItems: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  pillItem: {
    flex: 1,
    height: TAB_BAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  customBar: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
});
