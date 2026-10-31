/**
 * Landing screen — shown to signed-out users before sign-in / sign-up.
 * Matches the web landing page: lavender card, SPUD logo, marketing copy,
 * couch Spud mascot, and two CTA pill buttons.
 */
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  // Hide the splash screen when landing mounts (signed-out path)
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset, paddingBottom: bottomInset },
      ]}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Logo ── */}
      <View style={styles.logoWrap}>
        <Image
          source={require('@/assets/images/spud-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* ── Hero area: copy left, mascot bottom-right ── */}
      <View style={styles.hero}>
        {/* Marketing copy */}
        <View style={styles.copyStack}>
          <Text style={styles.copy}>
            The TV shows and movies you're{' '}
            <Text style={styles.bold}>watching</Text>
          </Text>
          <Text style={styles.copy}>
            The ones you've already{' '}
            <Text style={styles.bold}>watched</Text>
          </Text>
          <Text style={styles.copy}>
            And what you'll{' '}
            <Text style={styles.bold}>watch next</Text>
          </Text>
          <Text style={[styles.copy, styles.bold]}>All in one place.</Text>
        </View>

        {/* Mascot — bottom right */}
        <Image
          source={require('@/assets/images/spud-new-mascot-transparent.png')}
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
          <Text style={styles.btnPrimaryText}>
            New around here? <Text style={styles.btnActionText}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push('/(auth)/sign-in')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>
            Back to the couch? <Text style={styles.btnActionText}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const BG = '#D4CCFF';     // lavender card — matches web landing
const TEXT = '#6B46C1';   // purple text — matches web landing

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // Logo
  logoWrap: { marginTop: 24, marginLeft: -12, alignItems: 'flex-start' },
  logo: { height: 117, width: 234 },

  // Hero
  hero: {
    flex: 1,
    position: 'relative',
    marginTop: 8,
  },
  copyStack: { gap: 18, maxWidth: '65%', marginTop: 24 },
  copy: {
    fontSize: 22.1,
    fontFamily: 'Manrope_400Regular',
    color: TEXT,
    lineHeight: 30.6,
  },
  bold: { fontFamily: 'Manrope_700Bold', color: TEXT },
  mascot: {
    position: 'absolute',
    // Position the couch body, rather than the detached remote, against the
    // CTA pill edge. The illustration has transparent padding on the right.
    right: -20,
    bottom: 20,
    width: 220,
    height: 220,
  },

  // Buttons
  ctaWrap: { gap: 12, paddingBottom: 24 },
  btnPrimary: {
    backgroundColor: '#5B50D0',
    borderRadius: 32,
    minHeight: 52,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: '#ffffff',
  },
  btnSecondary: {
    borderWidth: 2,
    borderColor: '#5B50D0',
    borderRadius: 32,
    minHeight: 52,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  btnSecondaryText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: '#5B50D0',
  },
  btnActionText: { fontFamily: 'Manrope_700Bold' },
});
