import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  FlatList,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    key: 'welcome',
    image: require('../assets/spud-hero.png'),
    title: 'Your movie memory,\nall in one place',
    body: 'CouchPotato keeps track of every film and show you watch — so you never forget what you loved.',
  },
  {
    key: 'log',
    image: require('../assets/spud-phone.png'),
    title: 'Log movies, rate\nshows, track seasons',
    body: 'Quick-add a title in seconds, give it a star rating, and keep notes on every season.',
  },
  {
    key: 'recs',
    image: require('../assets/spud-couch.png'),
    title: 'Discover what to\nwatch next',
    body: 'Personalised picks based on your taste. Like, skip, or save titles straight to your watchlist.',
  },
];

const ONBOARDING_KEY = 'hasSeenOnboarding';

async function markSeen() {
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
  } catch {
    /* non-fatal */
  }
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatRef = useRef<FlatList>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await markSeen();
    router.replace('/(auth)/sign-in');
  };

  const goNext = () => {
    if (activeIdx < SLIDES.length - 1) {
      const next = activeIdx + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIdx(next);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      finish();
    }
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setActiveIdx(idx);
  };

  const isLast = activeIdx === SLIDES.length - 1;
  const slide = SLIDES[activeIdx];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Skip — top-right, hidden on last slide */}
      {!isLast && (
        <TouchableOpacity
          onPress={finish}
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Image slides — swipeable, fills top ~58% of screen */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={s => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.flatList}
        renderItem={({ item }) => (
          <View style={styles.slideImg}>
            <Image
              source={item.image}
              style={styles.img}
              resizeMode="contain"
            />
          </View>
        )}
      />

      {/* Bottom panel — text, dots, CTA */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        {/* Brand pill */}
        <View style={styles.brandRow}>
          <View style={styles.brandPill}>
            <Text style={styles.brandEmoji}>🥔</Text>
            <Text style={styles.brandText}>CouchPotato</Text>
          </View>
        </View>

        {/* Text block */}
        <View style={styles.textBlock}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>

        {/* Dot indicator */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIdx ? styles.dotOn : styles.dotOff,
              ]}
            />
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity
          onPress={goNext}
          style={styles.cta}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {isLast ? "Let's get comfy 🛋️" : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  skipBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(17,97,73,0.1)',
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: '#116149',
  },
  // FlatList takes up ~58% of screen height
  flatList: {
    height: W * 0.85,
    flexGrow: 0,
  },
  slideImg: {
    width: W,
    height: W * 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  // Bottom panel fills remaining space
  bottom: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  brandRow: {
    alignItems: 'flex-start',
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5EF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  brandEmoji: { fontSize: 14 },
  brandText: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: '#116149',
  },
  textBlock: {
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    color: '#111111',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: '#7E7A73',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotOn: {
    width: 24,
    backgroundColor: '#116149',
  },
  dotOff: {
    width: 8,
    backgroundColor: '#C4B9AD',
  },
  cta: {
    backgroundColor: '#116149',
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#ffffff',
  },
});
