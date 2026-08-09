import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import * as SplashScreen from 'expo-splash-screen';

const COUCH_BLUE = '#9BD6FF';

// ── Circular icon bubble, matching the web nav pill ──────────────────────────
// When focused: fills a 46 px circle with COUCH_BLUE and darkens the icon.
// When unfocused: transparent background, muted icon colour.
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: focused ? COUCH_BLUE : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather
        name={name as any}
        size={22}
        color={focused ? '#111111' : '#9E9890'}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  const { isSignedIn, isLoaded } = useAuth();

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
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return <Redirect href="/(auth)/landing" />;
  }

  const bottomOffset = isWeb ? 14 : insets.bottom > 0 ? insets.bottom + 4 : 12;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Labels hidden — icons only
        tabBarShowLabel: false,
        // No system-managed active colouring — TabIcon handles it entirely
        tabBarActiveTintColor: 'transparent',
        tabBarInactiveTintColor: 'transparent',
        // !! Remove tabBarActiveBackgroundColor — that's what was making the
        //    active slot render as a wide blue rectangle instead of a circle.
        tabBarStyle: {
          position: 'absolute',
          bottom: bottomOffset,
          // Centered pill: fixed width so it doesn't stretch edge-to-edge
          alignSelf: 'center',
          left: 40,
          right: 40,
          height: 62,
          borderRadius: 40,
          borderTopWidth: 0,
          // iOS uses BlurView for the pill fill; Android uses an opaque bg
          backgroundColor: isIOS ? 'transparent' : 'rgba(255, 243, 232, 0.96)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.6)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 14,
          elevation: 8,
        },
        // Each item is just a centred slot — no extra margin/radius that fights
        // the circular bubble rendered inside TabIcon
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={85}
              tint="extraLight"
              style={[StyleSheet.absoluteFill, { borderRadius: 40 }]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.pillBg]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="bookmark" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="bar-chart-2" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          // Profile is accessed via the avatar button on Home, not the tab bar
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pillBg: {
    backgroundColor: 'rgba(255, 243, 232, 0.96)',
    borderRadius: 40,
  },
});
