import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Entry } from '@workspace/api-client-react';

interface PosterCardProps {
  entry: Entry;
  onPress: () => void;
  compact?: boolean;
}

function StarRow({ rating }: { rating: number | null | undefined }) {
  const colors = useColors();
  if (!rating) return null;
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Feather
          key={i}
          name="star"
          size={10}
          color={i <= rating ? '#FFD34D' : colors.border}
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
}

export function PosterCard({ entry, onPress, compact = false }: PosterCardProps) {
  const colors = useColors();

  const isMovie = entry.type === 'movie';
  const typeColor = isMovie ? colors.secondary : colors.accent;
  const typeLabel = isMovie ? 'Movie' : 'Show';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        compact && styles.cardCompact,
      ]}
    >
      {/* Poster */}
      <View
        style={[
          styles.posterContainer,
          { backgroundColor: colors.muted, borderRadius: colors.radius - 2 },
          compact && styles.posterCompact,
        ]}
      >
        {entry.posterUrl ? (
          <Image
            source={{ uri: entry.posterUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Feather name={isMovie ? 'film' : 'tv'} size={compact ? 22 : 30} color={colors.mutedForeground} />
          </View>
        )}
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: typeColor + 'DD' }]}>
          <Text style={[styles.typeBadgeText, { color: isMovie ? colors.secondaryForeground : colors.accentForeground }]}>
            {typeLabel}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {entry.title}
        </Text>
        {entry.year && (
          <Text style={[styles.year, { color: colors.mutedForeground }]}>
            {entry.year}
          </Text>
        )}
        <StarRow rating={entry.rating} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 5,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  cardCompact: {
    flexDirection: 'row',
    margin: 0,
    marginBottom: 8,
  },
  posterContainer: {
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    position: 'relative',
  },
  posterCompact: {
    width: 60,
    aspectRatio: 2 / 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  posterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontFamily: 'Manrope_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  info: {
    padding: 8,
    gap: 2,
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    lineHeight: 16,
  },
  year: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
  },
  starRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
});
