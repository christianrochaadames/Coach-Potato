/**
 * Landing screen — shown to signed-out users before sign-in / sign-up.
 * Matches the web landing page: lavender card, SPUD logo, marketing copy,
 * couch Spud mascot, and two CTA pill buttons.
 */
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Hide the splash screen when landing mounts (signed-out path)
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Logo ── */}
      <View style={styles.logoWrap}>
        <Image
          source={require('@/assets/images/spud-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        {/* Badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Your couch sidekick.</Text>
        </View>
      </View>

      {/* ── Hero area: copy left, mascot bottom-right ── */}
      <View style={styles.hero}>
        {/* Marketing copy */}
        <View style={styles.copyStack}>
          <Text style={styles.copy}>
            The TV shows and movies you're{'\n'}
            <Text style={styles.bold}>watching</Text>
          </Text>
          <Text style={styles.copy}>
            The ones you've already{'\n'}
            <Text style={styles.bold}>watched</Text>
          </Text>
          <Text style={styles.copy}>
            And what you'll <Text style={styles.bold}>watch</Text> next
          </Text>
          <Text style={[styles.copy, styles.bold]}>All in one place.</Text>
        </View>

        {/* Mascot — bottom right */}
        <Image
          source={require('@/assets/images/spud.png')}
          style={styles.mascot}
          resizeMode="contain"
        />
      </View>

      {/* ── CTA buttons ── */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push('/(auth)/sign-up')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Get started free</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push('/(auth)/sign-in')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BG = '#D4CCFF';     // lavender card — matches web landing
const TEXT = '#6B46C1';   // purple text — matches web landing

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },

  // Logo + badge
  logoWrap: { marginTop: 16, alignItems: 'flex-start' },
  logo: { height: 100, width: 200 },
  badge: {
    marginTop: 8,
    backgroundColor: '#FF4BAE',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: '#ffffff',
  },

  // Hero
  hero: {
    flex: 1,
    position: 'relative',
    marginTop: 8,
  },
  copyStack: { gap: 18, maxWidth: '65%', marginTop: 12 },
  copy: {
    fontSize: 20,
    fontFamily: 'Manrope_400Regular',
    color: TEXT,
    lineHeight: 28,
  },
  bold: { fontFamily: 'Manrope_700Bold', color: TEXT },
  mascot: {
    position: 'absolute',
    right: -8,
    bottom: 0,
    width: 160,
    height: 200,
  },

  // Buttons
  ctaWrap: { gap: 12, paddingBottom: 24 },
  btnPrimary: {
    backgroundColor: '#5B50D0',
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#ffffff',
  },
  btnSecondary: {
    borderWidth: 2,
    borderColor: '#5B50D0',
    borderRadius: 32,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#5B50D0',
  },
});
