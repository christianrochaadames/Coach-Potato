import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';

export default function IndexRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;

  return <Redirect href={isSignedIn ? '/(tabs)' : '/(auth)/landing'} />;
}