import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';

const authImageSources = [
  require('@/assets/images/spud-logo.png'),
  require('@/assets/images/spud-signin-new.png'),
  require('@/assets/images/spud-signup-new.png'),
];

export default function AuthLayout() {
  const colors = useColors();

  useEffect(() => {
    authImageSources.forEach((source) => {
      const uri = Image.resolveAssetSource(source)?.uri;
      if (uri) Image.prefetch(uri).catch(() => {});
    });
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      <View pointerEvents="none" style={styles.preloadLayer}>
        {authImageSources.map((source, index) => (
          <Image key={index} source={source} style={styles.preloadImage} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  preloadLayer: {
    position: 'absolute',
    left: -1000,
    top: -1000,
    width: 1,
    height: 1,
    opacity: 0,
  },
  preloadImage: {
    width: 1,
    height: 1,
  },
});
