import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useListEntries } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data } = useListEntries({});
  const entries: any[] = (data as any[]) ?? [];

  const movies = entries.filter((e) => e.type === 'movie');
  const shows = entries.filter((e) => e.type === 'show');
  const watched = entries.filter((e) => e.status === 'completed');
  const watching = entries.filter((e) => e.status === 'watching');
  const watchlist = entries.filter((e) => e.status === 'plan_to_watch');
  const rated = entries.filter((e) => e.rating != null);
  const avgRating =
    rated.length > 0
      ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length).toFixed(1)
      : '—';

  const stats = [
    { icon: 'film', label: 'Total Logged', value: entries.length },
    { icon: 'check-circle', label: 'Watched', value: watched.length },
    { icon: 'play', label: 'Watching', value: watching.length },
    { icon: 'bookmark', label: 'Watchlist', value: watchlist.length },
    { icon: 'film', label: 'Movies', value: movies.length },
    { icon: 'tv', label: 'Shows', value: shows.length },
    { icon: 'star', label: 'Avg Rating', value: avgRating },
    { icon: 'edit-3', label: 'Rated', value: rated.length },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Stats</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: bottomPad + 90,
          paddingTop: 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name={stat.icon as any} size={22} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {entries.length === 0 && (
          <View style={styles.empty}>
            <Feather name="bar-chart-2" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No data yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Log titles to see your stats here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', letterSpacing: -0.5 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: 'flex-start',
    gap: 6,
  },
  statValue: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
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
});
