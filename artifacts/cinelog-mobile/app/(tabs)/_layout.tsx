import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import * as SplashScreen from 'expo-splash-screen';

const COUCH_BLUE = '#9BD6FF';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  const { isSignedIn, isLoaded, getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  // Safety valve: always hide the splash after 8 seconds no matter what,
  // preventing an iOS watchdog kill if Clerk is slow or unreachable.
  useEffect(() => {
    const timer = setTimeout(() => void SplashScreen.hideAsync(), 8000);
    return () => clearTimeout(timer);
  }, []);

  // Hide splash for signed-in users once Clerk confirms the session.
  // Signed-out users: sign-in screen calls hideAsync after it paints,
  // so the splash stays up until sign-in is actually visible.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void SplashScreen.hideAsync();
    }
  }, [isLoaded, isSignedIn]);

  // Hold blank (behind the splash) until Clerk has resolved auth state.
  if (!isLoaded) return null;

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const bottomOffset = isWeb ? 14 : insets.bottom > 0 ? insets.bottom + 4 : 12;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#111111',
        tabBarInactiveTintColor: '#9E9890',
        tabBarActiveBackgroundColor: COUCH_BLUE,
        tabBarStyle: {
          position: 'absolute',
          bottom: bottomOffset,
          left: 20,
          right: 20,
          height: 62,
          borderRadius: 40,
          borderTopWidth: 0,
          backgroundColor: isIOS ? 'transparent' : 'rgba(255, 243, 232, 0.96)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.6)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.10,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarItemStyle: {
          borderRadius: 30,
          marginVertical: 8,
          marginHorizontal: 4,
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
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color }) => <Feather name="search" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          tabBarIcon: ({ color }) => <Feather name="bookmark" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          // Profile is accessed via the avatar button on the Home tab, not the tab bar
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
