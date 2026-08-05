import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { CustomTabBar } from '@/components/CustomTabBar';

export default function TabLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  // Wire the Clerk token into the API client so every request carries auth.
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  // Guard: redirect unauthenticated users to sign-in
  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
