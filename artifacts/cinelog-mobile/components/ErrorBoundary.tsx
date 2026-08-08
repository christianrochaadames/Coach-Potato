import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { reloadAppAsync } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorFallbackProps {
  error: Error | null;
}

// ErrorBoundary is now mounted INSIDE SafeAreaProvider so useSafeAreaInsets()
// works correctly. Also hides the splash screen so it doesn't freeze on error.
function ErrorFallback({ error }: ErrorFallbackProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // If the app crashes before the destination screen calls hideAsync,
  // we must still hide the splash so the error screen is visible.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Something went wrong
      </Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        {error?.message ?? 'An unexpected error occurred.'}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={() => reloadAppAsync()}
        activeOpacity={0.8}
      >
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
          Restart App
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
