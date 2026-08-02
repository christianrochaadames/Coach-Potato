import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useListEntries } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function WatchlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data, isLoading, refetch, isRefetching } = useListEntries({});
  const all: any[] = (data as any[]) ?? [];
  const watchlist = all.filter((e) => e.status === 'plan_to_watch');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Watchlist</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/log-entry');
          }}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : watchlist.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bookmark" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nothing saved yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Add titles you want to watch and they'll appear here.
          </Text>
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/log-entry')}
            activeOpacity={0.8}
          >
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
              Add to Watchlist
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={watchlist}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: bottomPad + 90,
            paddingTop: 8,
          }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  style={styles.poster}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.posterPlaceholder, { backgroundColor: colors.muted }]}>
                  <Feather name="film" size={20} color={colors.mutedForeground} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text
                  style={[styles.cardTitle, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                  {item.type === 'movie' ? 'Movie' : 'Show'}
                  {item.year ? ` · ${item.year}` : ''}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.border} style={{ marginRight: 12 }} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', letterSpacing: -0.5 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_600SemiBold', textAlign: 'center' },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  ctaText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  poster: { width: 54, height: 80 },
  posterPlaceholder: {
    width: 54,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  cardTitle: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', lineHeight: 20 },
  cardMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
});
