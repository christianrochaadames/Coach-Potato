import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useGetStats, useListYears, useListEntries } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const GENRE_COLORS = [
  '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D', '#9BD6FF',
  '#6B46C1', '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D',
];
const PLATFORM_COLORS = [
  '#116149', '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D',
  '#9BD6FF', '#6B46C1',
];
const MONTH_LABELS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);

  // ── Year list ─────────────────────────────────────────────────────────────
  const { data: yearSummaries } = useListYears();
  const years = useMemo(() => {
    const list = ((yearSummaries ?? []) as any[])
      .filter((y: any) => y.year != null)
      .map((y: any) => y.year as number)
      .sort((a: number, b: number) => b - a);
    return list.length > 0 ? list : [currentYear];
  }, [yearSummaries, currentYear]);

  // ── Year-specific stats (disabled for "All time") ─────────────────────────
  const { data: yearStats } = useGetStats(
    { year: selectedYear ?? currentYear },
    { query: { enabled: selectedYear !== null } } as any,
  );

  // ── Entries for genre / platform charts and "All time" totals ─────────────
  const { data: completedEntries } = useListEntries(
    selectedYear !== null
      ? { status: 'completed', year: selectedYear } as any
      : { status: 'completed' },
  );

  // All statuses needed only for "All time" watching/watchlist counts
  const { data: allEntries } = useListEntries({} as any);

  // ── Derived totals ────────────────────────────────────────────────────────
  const completedArr: any[] = (completedEntries as any[]) ?? [];
  const allEntriesArr: any[] = (allEntries as any[]) ?? [];

  const totalWatched = selectedYear !== null
    ? (yearStats?.total ?? 0)
    : allEntriesArr.filter((e: any) => e.status === 'completed').length;

  const totalMovies = selectedYear !== null
    ? (yearStats?.movies ?? 0)
    : allEntriesArr.filter((e: any) => e.type === 'movie' && e.status === 'completed').length;

  const totalShows = selectedYear !== null
    ? (yearStats?.shows ?? 0)
    : allEntriesArr.filter((e: any) => e.type === 'show' && e.status === 'completed').length;

  const avgRating = selectedYear !== null
    ? yearStats?.averageRating ?? null
    : (() => {
        const rated = allEntriesArr.filter((e: any) => e.rating != null);
        return rated.length > 0
          ? Math.round(rated.reduce((s: number, e: any) => s + e.rating, 0) / rated.length * 10) / 10
          : null;
      })();

  // ── Genre breakdown ───────────────────────────────────────────────────────
  const genreData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of completedArr) {
      for (const tag of (entry.tags as string[] | null) ?? []) {
        if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const total = completedArr.length || 1;
    return [...counts.entries()]
      .map(([genre, count]) => ({ genre, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [completedArr]);

  const maxGenreCount = genreData[0]?.count ?? 1;

  // ── Platform breakdown ────────────────────────────────────────────────────
  const platformData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of completedArr) {
      const p = (entry.platform as string | null) || 'Other';
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const total = completedArr.length || 1;
    return [...counts.entries()]
      .map(([platform, count]) => ({ platform, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [completedArr]);

  const maxPlatformCount = platformData[0]?.count ?? 1;

  // ── Monthly chart ─────────────────────────────────────────────────────────
  const monthData = yearStats?.byMonth ?? [];
  const maxMonthCount = Math.max(...monthData.map(m => m.count), 1);

  const isEmpty = totalWatched === 0 && genreData.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Stats</Text>
      </View>

      {/* Year filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.yearPillsContent}
        style={styles.yearPillsRow}
      >
        <TouchableOpacity
          onPress={() => setSelectedYear(null)}
          style={[
            styles.yearPill,
            { backgroundColor: selectedYear === null ? '#116149' : '#EFE4D2' },
          ]}
        >
          <Text style={[styles.yearPillText, { color: selectedYear === null ? '#ffffff' : '#7E7A73' }]}>
            All time
          </Text>
        </TouchableOpacity>

        {years.map(y => (
          <TouchableOpacity
            key={y}
            onPress={() => setSelectedYear(y)}
            style={[
              styles.yearPill,
              { backgroundColor: selectedYear === y ? '#116149' : '#EFE4D2' },
            ]}
          >
            <Text style={[styles.yearPillText, { color: selectedYear === y ? '#ffffff' : '#7E7A73' }]}>
              {y}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <View style={styles.empty}>
            <Feather name="bar-chart-2" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Log titles to see your stats here.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <View style={styles.row2}>
              <View style={[styles.summaryCard, { backgroundColor: '#FFD34D' }]}>
                <Text style={[styles.bigNumber, { color: '#111111' }]}>{totalWatched}</Text>
                <Text style={[styles.cardLabel, { color: '#111111', opacity: 0.7 }]}>
                  {selectedYear !== null ? `Watched in ${selectedYear}` : 'Total Watched'}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#FFE4F3' }]}>
                <Text style={[styles.bigNumber, { color: '#FF4BAE' }]}>
                  {avgRating != null ? avgRating.toFixed(1) : '—'}
                </Text>
                <Text style={[styles.cardLabel, { color: '#c73b8e' }]}>Avg Rating ★</Text>
              </View>
            </View>

            {/* ── Movies vs Shows ── */}
            {(totalMovies + totalShows) > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Movies vs Shows</Text>

                {/* Segmented bar */}
                <View style={styles.splitBar}>
                  <View
                    style={[
                      styles.splitSegment,
                      {
                        flex: totalMovies || 0.001,
                        backgroundColor: '#4A78FF',
                        borderTopLeftRadius: 6,
                        borderBottomLeftRadius: 6,
                        borderTopRightRadius: totalShows === 0 ? 6 : 0,
                        borderBottomRightRadius: totalShows === 0 ? 6 : 0,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.splitSegment,
                      {
                        flex: totalShows || 0.001,
                        backgroundColor: '#FF4BAE',
                        borderTopRightRadius: 6,
                        borderBottomRightRadius: 6,
                        borderTopLeftRadius: totalMovies === 0 ? 6 : 0,
                        borderBottomLeftRadius: totalMovies === 0 ? 6 : 0,
                      },
                    ]}
                  />
                </View>

                <View style={styles.legendRow}>
                  {[
                    { label: '🎬 Movies', count: totalMovies, color: '#4A78FF' },
                    { label: '📺 Shows',  count: totalShows,  color: '#FF4BAE' },
                  ].map(({ label, count, color }) => {
                    const pct = Math.round(count / (totalMovies + totalShows) * 100);
                    return (
                      <View key={label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: color }]} />
                        <Text style={[styles.legendLabel, { color: colors.foreground }]}>{label}</Text>
                        <Text style={[styles.legendCount, { color: colors.mutedForeground }]}>{count}</Text>
                        <View style={styles.legendPill}>
                          <Text style={styles.legendPillText}>{pct}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Monthly activity (year-specific only) ── */}
            {selectedYear !== null && monthData.length > 0 && monthData.some(m => m.count > 0) && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Monthly Activity · {selectedYear}
                </Text>
                <View style={styles.monthChart}>
                  {monthData.map((m, i) => (
                    <View key={i} style={styles.monthCol}>
                      <View style={styles.monthBarWrap}>
                        <View
                          style={[
                            styles.monthBar,
                            {
                              height: m.count > 0 ? Math.max(4, (m.count / maxMonthCount) * 72) : 0,
                              backgroundColor: '#6B46C1',
                            },
                          ]}
                        />
                      </View>
                      {m.count > 0 && (
                        <Text style={[styles.monthCount, { color: colors.mutedForeground }]}>
                          {m.count}
                        </Text>
                      )}
                      <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>
                        {MONTH_LABELS[i]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Genre breakdown ── */}
            {genreData.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Genre Breakdown</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  Based on {selectedYear !== null ? `${selectedYear}` : 'all'} titles
                </Text>
                <View style={styles.barList}>
                  {genreData.map(({ genre, count, pct }, idx) => (
                    <View key={genre}>
                      <View style={styles.barLabelRow}>
                        <Text style={[styles.barLabel, { color: colors.foreground }]}>{genre}</Text>
                        <Text style={[styles.barCount, { color: colors.mutedForeground }]}>
                          {count} · {pct}%
                        </Text>
                      </View>
                      <View style={[styles.barTrack, { backgroundColor: '#EFE4D2' }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.round((count / maxGenreCount) * 100)}%` as any,
                              backgroundColor: GENRE_COLORS[idx % GENRE_COLORS.length],
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Platform breakdown ── */}
            {platformData.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Platform Breakdown</Text>
                <View style={styles.barList}>
                  {platformData.map(({ platform, count, pct }, idx) => (
                    <View key={platform}>
                      <View style={styles.barLabelRow}>
                        <Text style={[styles.barLabel, { color: colors.foreground }]}>{platform}</Text>
                        <Text style={[styles.barCount, { color: colors.mutedForeground }]}>
                          {count} · {pct}%
                        </Text>
                      </View>
                      <View style={[styles.barTrack, { backgroundColor: '#EFE4D2' }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.round((count / maxPlatformCount) * 100)}%` as any,
                              backgroundColor: PLATFORM_COLORS[idx % PLATFORM_COLORS.length],
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', letterSpacing: -0.5 },

  // Year pills
  yearPillsRow: { flexGrow: 0 },
  yearPillsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  yearPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  yearPillText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
  },

  // Main scroll content
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },

  // Summary row
  row2: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    gap: 4,
  },
  bigNumber: {
    fontSize: 32,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: -1,
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },

  // Section cards
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
  },
  sectionSub: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    marginTop: -8,
  },

  // Movies vs Shows split bar
  splitBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  splitSegment: { height: '100%' },
  legendRow: { gap: 8 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', flex: 1 },
  legendCount: { fontSize: 13, fontFamily: 'Manrope_400Regular' },
  legendPill: {
    backgroundColor: '#EFE4D2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  legendPillText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: '#116149',
  },

  // Monthly chart
  monthChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  monthCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  monthBarWrap: {
    height: 80,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  monthBar: {
    width: '70%',
    borderRadius: 4,
    minHeight: 0,
  },
  monthCount: {
    fontSize: 8,
    fontFamily: 'Manrope_600SemiBold',
  },
  monthLabel: {
    fontSize: 9,
    fontFamily: 'Manrope_500Medium',
  },

  // Horizontal bar charts (genre / platform)
  barList: { gap: 10 },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', flex: 1 },
  barCount: { fontSize: 11, fontFamily: 'Manrope_400Regular' },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Empty state
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
