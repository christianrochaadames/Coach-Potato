import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COUCH_BLUE = '#9BD6FF';

const TAB_ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  index: 'home',
  search: 'search',
  watchlist: 'bookmark',
  stats: 'bar-chart-2',
  profile: 'user',
};

const PILL_HEIGHT = 62;
const INDICATOR_SIZE = 46;

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  const [barWidth, setBarWidth] = useState(0);
  const tabCount = state.routes.length;
  const itemWidth = barWidth > 0 ? barWidth / tabCount : 0;

  // Animated value tracks the active tab index
  const animX = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(animX, {
      toValue: state.index,
      useNativeDriver: true,
      tension: 70,
      friction: 11,
    }).start();
  }, [state.index]);

  const translateX =
    itemWidth > 0
      ? animX.interpolate({
          inputRange: state.routes.map((_, i) => i),
          outputRange: state.routes.map(
            (_, i) => i * itemWidth + (itemWidth - INDICATOR_SIZE) / 2,
          ),
        })
      : animX;

  const bottomPad = isWeb ? 16 : insets.bottom > 0 ? insets.bottom : 10;

  return (
    <View style={[styles.outerWrap, { paddingBottom: bottomPad }]} pointerEvents="box-none">
      <View
        style={styles.pill}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Background */}
        {isIOS ? (
          <BlurView
            intensity={85}
            tint="extraLight"
            style={[StyleSheet.absoluteFill, { borderRadius: 40 }]}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.pillBg]} />
        )}

        {/* Sliding indicator */}
        {barWidth > 0 && (
          <Animated.View
            style={[styles.indicator, { transform: [{ translateX }] }]}
          />
        )}

        {/* Tabs */}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const icon = TAB_ICONS[route.name] ?? 'circle';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <Feather
                name={icon}
                size={22}
                color={isFocused ? '#111111' : '#9E9890'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    borderRadius: 40,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
  },
  pillBg: {
    backgroundColor: 'rgba(255, 243, 232, 0.94)',
    borderRadius: 40,
  },
  indicator: {
    position: 'absolute',
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: COUCH_BLUE,
    top: (PILL_HEIGHT - INDICATOR_SIZE) / 2,
    left: 0,
    zIndex: 0,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: PILL_HEIGHT,
    zIndex: 1,
  },
});
