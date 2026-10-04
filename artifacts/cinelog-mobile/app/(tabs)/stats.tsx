import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, FontAwesome } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useGetStats, useListYears, useListEntries } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { QuickLogSheet, TmdbItem } from './search';

const GENRE_COLORS = [
  '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D', '#9BD6FF',
  '#6B46C1', '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D',
];
const MONTH_LABELS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

type TopRatedItem = {
  id: number;
  title: string;
  posterUrl: string | null;
  rating: number;
  entry: any;
};

function GenreDonut({ data }: { data: Array<{ genre: string; count: number }> }) {
  const size = 140;
  const center = size / 2;
  const radius = 50;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartProgress = useRef(new Animated.Value(0)).current;
  let offset = 0;

  useEffect(() => {
    chartProgress.setValue(0);
    Animated.timing(chartProgress, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [chartProgress, data]);

  return (
    <Animated.View
      style={{
        opacity: chartProgress,
        transform: [{
          scale: chartProgress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
        }],
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke="#EFE4D2"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {data.map((item, index) => {
        const segmentLength = total > 0
          ? (item.count / total) * circumference
          : 0;
        const segment = (
          <Circle
            key={item.genre}
            cx={center}
            cy={center}
            r={radius}
            stroke={GENRE_COLORS[index % GENRE_COLORS.length]}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segmentLength} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            fill="none"
            rotation="-90"
            origin={`${center}, ${center}`}
          />
        );
        offset += segmentLength;
        return segment;
      })}
      </Svg>
    </Animated.View>
  );
}

function MediaDonut({ movies, shows }: { movies: number; shows: number }) {
  const size = 112;
  const center = size / 2;
  const radius = 40;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  const total = movies + shows;
  const segments = [
    { count: movies, color: '#4A78FF' },
    { count: shows, color: '#FF4BAE' },
  ];
  let offset = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((segment, index) => {
        const segmentLength = total > 0 ? (segment.count / total) * circumference : 0;
        const result = (
          <Circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segmentLength} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            fill="none"
            rotation="-90"
            origin={`${center}, ${center}`}
          />
        );
        offset += segmentLength;
        return result;
      })}
    </Svg>
  );
}

function AnimatedMonthBar({ height }: { height: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [height, progress]);

  return (
    <Animated.View
      style={[
        styles.monthBar,
        {
          height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
          backgroundColor: '#6B46C1',
        },
      ]}
    />
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <View style={styles.ratingStars}>
      {[1, 2, 3, 4, 5].map(star => (
        <FontAwesome key={star} name="star" size={12} color={star <= rating ? '#FFD34D' : '#D6CECC'} />
      ))}
    </View>
  );
}

// ── Stats Share Card ──────────────────────────────────────────────────────────
// Fixed-size card captured by react-native-view-shot and shared as an image.

const CARD_W = 320;
const CARD_H = 480;

interface StatsShareCardProps {
  year: number | null;
  totalWatched: number;
  totalMovies: number;
  totalShows: number;
  avgRating: number | null;
  topGenre: string | null;
}

function StatsShareCard({
  year,
  totalWatched,
  totalMovies,
  totalShows,
  avgRating,
  topGenre,
}: StatsShareCardProps) {
  const heading = year ? `${year} in Review` : 'All-Time Stats';

  return (
    <View style={cardStyles.root}>
      {/* Decorative background orbs */}
      <View style={cardStyles.orb1} />
      <View style={cardStyles.orb2} />
      <View style={cardStyles.orb3} />

      {/* Branding */}
      <View style={cardStyles.topRow}>
        <Text style={cardStyles.logo}>🥔</Text>
        <Text style={cardStyles.appName}>Spud</Text>
      </View>

      {/* Heading */}
      <Text style={cardStyles.heading}>{heading}</Text>

      {/* Main stat — total watched */}
      <View style={cardStyles.mainStatBox}>
        <Text style={cardStyles.mainStatNum}>{totalWatched}</Text>
        <Text style={cardStyles.mainStatLabel}>
          {year ? `titles watched in ${year}` : 'titles tracked'}
        </Text>
      </View>

      {/* Movies vs Shows row */}
      <View style={cardStyles.mvRow}>
        <View style={cardStyles.mvBox}>
          <Text style={cardStyles.mvEmoji}>🎬</Text>
          <Text style={cardStyles.mvNum}>{totalMovies}</Text>
          <Text style={cardStyles.mvLabel}>Movies</Text>
        </View>
        <View style={cardStyles.mvDivider} />
        <View style={cardStyles.mvBox}>
          <Text style={cardStyles.mvEmoji}>📺</Text>
          <Text style={cardStyles.mvNum}>{totalShows}</Text>
          <Text style={cardStyles.mvLabel}>TV shows</Text>
        </View>
        <View style={cardStyles.mvDivider} />
        <View style={cardStyles.mvBox}>
          <FontAwesome name="star" size={18} color="#FFD34D" />
          <Text style={cardStyles.mvNum}>{avgRating != null ? avgRating.toFixed(1) : '—'}</Text>
          <Text style={cardStyles.mvLabel}>Avg Rating</Text>
        </View>
      </View>

      {/* Badges row */}
      <View style={cardStyles.badgesRow}>
        {topGenre ? (
          <View style={cardStyles.badge}>
            <Text style={cardStyles.badgeTitle}>TOP GENRE</Text>
            <Text style={cardStyles.badgeValue}>{topGenre}</Text>
          </View>
        ) : null}
      </View>

      {/* Mascot / decorative potato */}
      <Text style={cardStyles.bigPotato}>🥔</Text>

      {/* Footer */}
      <Text style={cardStyles.footer}>spud · track what you watch</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  root: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#116149',
    borderRadius: 24,
    padding: 28,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    gap: 0,
  },
  // Background orbs
  orb1: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,243,232,0.07)',
    top: -80,
    right: -60,
  },
  orb2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(155,214,255,0.1)',
    bottom: 60,
    left: -40,
  },
  orb3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,211,77,0.1)',
    top: 160,
    right: 20,
  },
  // Branding
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  logo: { fontSize: 20 },
  appName: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: 'rgba(255,243,232,0.8)',
    letterSpacing: 0.5,
  },
  // Heading
  heading: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    color: '#FFF3E8',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 20,
  },
  // Main stat
  mainStatBox: {
    marginBottom: 20,
  },
  mainStatNum: {
    fontSize: 64,
    fontFamily: 'Manrope_700Bold',
    color: '#FFD34D',
    letterSpacing: -3,
    lineHeight: 68,
  },
  mainStatLabel: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: 'rgba(255,243,232,0.7)',
    marginTop: 2,
  },
  // Movies / shows / rating row
  mvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,243,232,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  mvBox: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  mvDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,243,232,0.15)',
  },
  mvEmoji: { fontSize: 18 },
  mvNum: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
    color: '#FFF3E8',
    letterSpacing: -0.5,
  },
  mvLabel: {
    fontSize: 10,
    fontFamily: 'Manrope_500Medium',
    color: 'rgba(255,243,232,0.6)',
  },
  // Badges
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 'auto' as any,
  },
  badge: {
    flex: 1,
    backgroundColor: 'rgba(255,211,77,0.15)',
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  badgeTitle: {
    fontSize: 9,
    fontFamily: 'Manrope_700Bold',
    color: '#FFD34D',
    letterSpacing: 1,
  },
  badgeValue: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFF3E8',
  },
  // Big potato mascot
  bigPotato: {
    fontSize: 52,
    textAlign: 'right',
    marginTop: 'auto' as any,
    marginBottom: 4,
  },
  // Footer
  footer: {
    fontSize: 10,
    fontFamily: 'Manrope_400Regular',
    color: 'rgba(255,243,232,0.45)',
    letterSpacing: 0.3,
  },
});

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const cardBottomGap = Platform.OS === 'web' ? 76 : 20;

  const currentYear = new Date().getFullYear();
  // Start with all-time data so users with older viewing history see their
  // stats immediately instead of an empty current-year view.
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const topRatedScrollRef = useRef<any>(null);
  const [topRatedViewportWidth, setTopRatedViewportWidth] = useState(0);
  const [topRatedContentWidth, setTopRatedContentWidth] = useState(0);
  const canScrollTopRated = topRatedContentWidth > topRatedViewportWidth + 4;
  const [selectedTopRated, setSelectedTopRated] = useState<{ item: TmdbItem; entry: any } | null>(null);

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

  // ── Top rated titles ──────────────────────────────────────────────────────
  // Top Rated is intentionally based on the title's overall rating only.
  // Season-level ratings do not promote a TV show into this list.
  const topRated = useMemo((): TopRatedItem[] => {
    return completedArr
      .filter(entry => entry.rating === 5)
      .map(entry => ({
        id: entry.id,
        title: entry.title,
        posterUrl: entry.posterUrl ?? null,
        rating: entry.rating!,
        entry,
      }))
      .slice(0, 20);
  }, [completedArr]);

  // ── Activity timeline ─────────────────────────────────────────────────────
  // Year-specific views use the API's exact monthly totals. All time uses a
  // chronological year timeline so entries from different years are not
  // incorrectly combined into the same month.
  const allTimeYearData = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of allEntriesArr) {
      if (entry.status !== 'completed') continue;
      const yearValue = entry.dateWatched
        ? String(entry.dateWatched).split('-')[0]
        : entry.year;
      const year = Number(yearValue);
      if (Number.isFinite(year) && year > 0) {
        counts.set(year, (counts.get(year) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, count]) => ({ year, count }));
  }, [allEntriesArr]);

  const timelineData = selectedYear !== null ? (yearStats?.byMonth ?? []) : allTimeYearData;
  const maxTimelineCount = Math.max(...timelineData.map(item => item.count), 1);

  const isEmpty = totalWatched === 0 && genreData.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: '#4A1020' }]}>

      {/* ── Inner dark-maroon card ── */}
      <View style={[styles.innerCard, { marginTop: topPad + 12, marginBottom: cardBottomGap }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Your Stats</Text>
          <TouchableOpacity
            style={styles.yearDropdownPill}
            onPress={() => setShowYearPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.yearDropdownText}>{selectedYear ?? 'All time'}</Text>
            <Feather name="chevron-down" size={13} color="#FFF3E8" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          A completely unnecessary but oddly satisfying breakdown of your viewing habits.
        </Text>
      </View>

      {/* ── Year picker modal ── */}
      <Modal
        visible={showYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <TouchableOpacity
          style={styles.yearModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowYearPicker(false)}
        />
        <View
          style={[
            styles.yearModalContainer,
            { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.yearModalCard}>
            <Text style={styles.yearModalTitle}>Select year</Text>
            <ScrollView
              style={styles.yearModalOptions}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[styles.yearModalOption, selectedYear === null && styles.yearModalOptionActive]}
                onPress={() => { setSelectedYear(null); setShowYearPicker(false); }}
              >
                <Text style={[styles.yearModalOptionText, selectedYear === null && styles.yearModalOptionTextActive]}>
                  All time
                </Text>
              </TouchableOpacity>
              {years.map(y => (
            <TouchableOpacity
              key={y}
              style={[styles.yearModalOption, selectedYear === y && styles.yearModalOptionActive]}
              onPress={() => { setSelectedYear(y); setShowYearPicker(false); }}
            >
              <Text style={[styles.yearModalOptionText, selectedYear === y && styles.yearModalOptionTextActive]}>
                {y}
              </Text>
            </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
            <Image
              source={require('@/assets/images/spud-stats-couch-snacks.png')}
              style={styles.emptyMascot}
              resizeMode="contain"
            />
            <Text style={[styles.emptyTitle, { color: '#4A1020' }]}>Nothing to see here yet</Text>
            <Text style={[styles.emptyBody, { color: '#7E7A73' }]}>
              Add a few TV shows and movies you’ve watched, and I’ll start crunching the numbers.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <View style={styles.row2}>
              <View style={[styles.summaryCard, { backgroundColor: '#FFD34D' }]}>
                <Text style={[styles.bigNumber, { color: '#4A1020' }]}>{totalWatched}</Text>
                <Text style={[styles.cardLabel, { color: '#4A1020' }]}>Total Watched</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#FFE4F3' }]}>
                <Text style={[styles.bigNumber, { color: '#4A1020' }]}>
                  {avgRating != null ? avgRating.toFixed(1) : '—'}
                </Text>
                <Text style={[styles.cardLabel, { color: '#4A1020' }]}>Avg Rating ★</Text>
              </View>
            </View>

            {/* ── Movies vs Shows ── */}
            {(totalMovies + totalShows) > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Movies vs TV shows</Text>

                <View style={styles.mediaChartRow}>
                  <MediaDonut movies={totalMovies} shows={totalShows} />
                  <View style={styles.mediaLegend}>
                    {[
                    { label: '🎬 Movies', count: totalMovies, color: '#4A78FF' },
                    { label: '📺 TV shows',  count: totalShows,  color: '#FF4BAE' },
                  ].map(({ label, count, color }) => {
                    const pct = Math.round(count / (totalMovies + totalShows) * 100);
                    return (
                      <View key={label} style={styles.mediaLegendItem}>
                        <View style={[styles.mediaLegendDot, { backgroundColor: color }]} />
                        <Text style={[styles.mediaLegendLabel, { color: colors.foreground }]}>{label}</Text>
                        <Text style={[styles.mediaLegendCount, { color: colors.mutedForeground }]}>{count}</Text>
                        <View style={styles.mediaLegendPill}>
                          <Text style={styles.mediaLegendPillText}>{pct}%</Text>
                        </View>
                      </View>
                    );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* ── Activity timeline ── */}
            {timelineData.length > 0 && timelineData.some(item => item.count > 0) && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {selectedYear !== null ? 'Monthly Activity' : 'Yearly Activity'}
                </Text>
                <View style={styles.monthChart}>
                  {timelineData.map((item, i) => (
                    <View
                      key={selectedYear !== null ? i : (item as { year: number }).year}
                      style={styles.monthCol}
                    >
                      <View style={styles.monthBarWrap}>
                        <AnimatedMonthBar
                          height={item.count > 0 ? Math.max(4, (item.count / maxTimelineCount) * 72) : 0}
                        />
                      </View>
                      <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>
                        {selectedYear !== null
                          ? MONTH_LABELS[(item as { month: number }).month - 1]
                          : (item as { year: number }).year}
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
                <View style={styles.genreChartRow}>
                  <GenreDonut data={genreData} />
                  <View style={styles.genreLegend}>
                    {genreData.slice(0, 7).map(({ genre, count }, idx) => (
                      <View key={genre} style={styles.genreLegendItem}>
                        <View style={[styles.legendDot, { backgroundColor: GENRE_COLORS[idx % GENRE_COLORS.length] }]} />
                        <Text style={[styles.genreLegendLabel, { color: colors.foreground }]} numberOfLines={1}>
                          {genre}
                        </Text>
                        <Text style={[styles.genreLegendCount, { color: colors.mutedForeground }]}>{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* ── Top rated ── */}
            {topRated.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Rated</Text>
                <View
                  style={styles.topRatedScroller}
                  onLayout={event => setTopRatedViewportWidth(event.nativeEvent.layout.width)}
                >
                  <ScrollView
                    ref={topRatedScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.topRatedRow}
                    onContentSizeChange={width => setTopRatedContentWidth(width)}
                  >
                  {topRated.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.topRatedItem}
                      activeOpacity={0.75}
                      onPress={() => {
                        const entry = item.entry;
                        setSelectedTopRated({
                          entry,
                          item: {
                            tmdbId: entry.tmdbId,
                            title: entry.title,
                            type: entry.type,
                            year: entry.year ?? null,
                            posterUrl: entry.posterUrl ?? null,
                            overview: entry.synopsis ?? null,
                          },
                        });
                      }}
                    >
                      <View style={styles.topRatedPoster}>
                        {item.posterUrl ? (
                          <Image source={{ uri: item.posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        ) : (
                          <Text style={styles.topRatedFallback}>{item.title[0]?.toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={[styles.topRatedTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <StarDisplay rating={item.rating} />
                    </TouchableOpacity>
                  ))}
                  </ScrollView>
                  {canScrollTopRated && (
                    <TouchableOpacity
                      style={styles.topRatedNextButton}
                      activeOpacity={0.8}
                      accessibilityLabel="Show more top rated titles"
                      onPress={() => topRatedScrollRef.current?.scrollTo({
                        x: Math.max(0, topRatedContentWidth - topRatedViewportWidth),
                        animated: true,
                      })}
                    >
                      <Feather name="chevron-right" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      </View>{/* end innerCard */}
      <QuickLogSheet
        item={selectedTopRated?.item ?? null}
        visible={Boolean(selectedTopRated)}
        onClose={() => setSelectedTopRated(null)}
        onSaved={() => setSelectedTopRated(null)}
        insets={insets}
        initialStatus="completed"
        entryId={selectedTopRated?.entry.id ?? null}
        canDelete={Boolean(selectedTopRated?.entry.id)}
        initialDateWatched={selectedTopRated?.entry.dateWatched ?? null}
        initialRating={selectedTopRated?.entry.rating ?? null}
        initialSeasons={selectedTopRated?.entry.seasons ?? []}
        onDeleted={() => setSelectedTopRated(null)}
        source="stats"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  innerCard: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    borderRadius: 24,
    marginHorizontal: 16,
    overflow: 'hidden',
  },

  // Off-screen card container (captured by react-native-view-shot)
  offScreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', letterSpacing: -0.5, color: '#4A1020' },
  subtitle: {
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#7E7A73', lineHeight: 21, marginTop: 6,
  },
  shareBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Year dropdown pill in header
  yearDropdownPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    borderWidth: 1.5, borderColor: '#4A1020',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    minWidth: 84, alignSelf: 'flex-start', marginTop: 4,
  },
  yearDropdownText: {
    position: 'absolute', left: 0, right: 0, textAlign: 'center',
    fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: '#4A1020',
  },

  // Year picker modal
  yearModalBackdrop: {
    ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  yearModalCard: {
    width: 220, maxHeight: '100%', alignSelf: 'center', backgroundColor: '#ffffff',
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  yearModalContainer: {
    ...StyleSheet.absoluteFill, justifyContent: 'center',
  },
  yearModalOptions: {
    flexShrink: 1,
  },
  yearModalTitle: {
    fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#7E7A73',
    letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  yearModalOption: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#F5F0EA',
  },
  yearModalOptionActive: { backgroundColor: '#FFE4F3' },
  yearModalOptionText: {
    fontSize: 15, fontFamily: 'Manrope_500Medium', color: '#111111',
  },
  yearModalOptionTextActive: {
    color: '#4A1020',
    fontFamily: 'Manrope_700Bold',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4C9BC',
    alignSelf: 'center',
    marginBottom: 20,
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

  // Movies vs Shows donut
  mediaChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mediaLegend: {
    flex: 1,
    gap: 10,
  },
  mediaLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  mediaLegendDot: { width: 10, height: 10, borderRadius: 5 },
  mediaLegendLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },
  mediaLegendCount: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
  },
  mediaLegendPill: {
    backgroundColor: '#EFE4D2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mediaLegendPillText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: '#116149',
  },

  // Kept for shared spacing compatibility with older cards
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

  // Genre donut and legend
  genreChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  genreLegend: {
    flex: 1,
    gap: 8,
  },
  genreLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  genreLegendLabel: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
  },
  genreLegendCount: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
  },
  topRatedScroller: {
    position: 'relative',
  },
  topRatedRow: {
    gap: 12,
    paddingRight: 40,
  },
  topRatedNextButton: {
    position: 'absolute',
    right: -4,
    top: 42,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4BAE',
  },
  topRatedItem: {
    width: 78,
  },
  topRatedPoster: {
    width: 78,
    height: 117,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EFE4D2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  topRatedPlaceholder: {
    backgroundColor: '#EFE4D2',
  },
  topRatedFallback: {
    color: '#116149',
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
  },
  topRatedTitle: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    lineHeight: 13,
  },
  topRatedMeta: {
    fontSize: 9,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 12,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: 2,
  },
  seasonCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4BAE',
  },
  seasonCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
  },
  seasonModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  seasonModalSheet: {
    backgroundColor: '#FFF3E8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  seasonModalHeader: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  seasonModalPoster: {
    width: 56,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#EFE4D2',
  },
  seasonModalHeading: {
    flex: 1,
  },
  seasonModalTitle: {
    color: '#111111',
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
  },
  seasonModalSubtitle: {
    color: '#7E7A73',
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    marginTop: 4,
  },
  seasonRows: {
    gap: 8,
    marginBottom: 16,
  },
  seasonRow: {
    backgroundColor: '#EFE4D2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seasonRowTitle: {
    color: '#111111',
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },
  viewSeriesButton: {
    backgroundColor: '#116149',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  viewSeriesButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyMascot: { width: 300, height: 300, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_600SemiBold', textAlign: 'center' },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
