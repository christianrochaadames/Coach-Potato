import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Svg, Rect, Text as SvgText, G } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useGetStats, useListYears } from '@workspace/api-client-react';
import type { YearSummary, MonthCount } from '@workspace/api-client-react';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const CHART_H = 100;
const CHART_W_PADDING = 32;

function MonthChart({ byMonth, primaryColor, mutedColor, textColor }: {
  byMonth: MonthCount[];
  primaryColor: string;
  mutedColor: string;
  textColor: string;
}) {
  const maxCount = Math.max(...byMonth.map((m) => m.count), 1);
  const BAR_MAX_H = CHART_H - 20;

  return (
    <Svg width="100%" height={CHART_H + 20} viewBox={`0 0 360 ${CHART_H + 20}`}>
      {Array.from({ length: 12 }, (_, i) => {
        const monthData = byMonth.find((m) => m.month === i + 1);
        const count = monthData?.count ?? 0;
        const barH = count > 0 ? Math.max((count / maxCount) * BAR_MAX_H, 4) : 2;
        const x = CHART_W_PADDING + (i * (360 - CHART_W_PADDING * 2)) / 12;
        const barW = (360 - CHART_W_PADDING * 2) / 12 - 4;
        const y = CHART_H - barH;

        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill={count > 0 ? primaryColor : mutedColor}
              rx={3}
            />
            <SvgText
              x={x + barW / 2}
              y={CHART_H + 14}
              textAnchor="middle"
              fill={textColor}
              fontSize={9}
              fontFamily="Manrope_400Regular"
            >
              {MONTH_LABELS[i]}
            </SvgText>
            {count > 0 && (
              <SvgText
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fill={primaryColor}
                fontSize={9}
                fontFamily="Manrope_600SemiBold"
              >
                {count}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

function StatCard({ label, value, icon, color }: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Feather name={icon as any} size={18} color={color} style={{ marginBottom: 4 }} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: years } = useListYears();
  const { data: stats, isLoading, isError, refetch } = useGetStats({ year: selectedYear });

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 56;

  const yearList: number[] = [];
  if (years && years.length > 0) {
    years.forEach((ys: YearSummary) => {
      if (ys.year && !yearList.includes(ys.year)) yearList.push(ys.year);
    });
  }
  if (!yearList.includes(currentYear)) yearList.unshift(currentYear);
  yearList.sort((a, b) => b - a);

  const avgRatingDisplay = stats?.averageRating
    ? stats.averageRating.toFixed(1)
    : '—';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Stats</Text>
        {/* Year dropdown row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.yearScroll}
          contentContainerStyle={styles.yearScrollContent}
        >
          {yearList.map((yr) => {
            const active = yr === selectedYear;
            return (
              <Pressable
                key={yr}
                onPress={() => setSelectedYear(yr)}
                style={[
                  styles.yearPill,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                    borderRadius: 16,
                  },
                ]}
              >
                <Text style={[styles.yearPillText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                  {yr}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.errorCenter}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>Couldn't load stats</Text>
          <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.primary }]}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stat cards */}
          <View style={styles.statGrid}>
            <StatCard label="Total" value={stats?.total ?? 0} icon="play-circle" color={colors.primary} />
            <StatCard label="Movies" value={stats?.movies ?? 0} icon="film" color={colors.secondary} />
            <StatCard label="Shows" value={stats?.shows ?? 0} icon="tv" color={colors.accent} />
            <StatCard label="Avg Rating" value={avgRatingDisplay} icon="star" color="#FFD34D" />
          </View>

          {/* Monthly chart */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>By Month</Text>
            {stats && stats.byMonth.length > 0 ? (
              <MonthChart
                byMonth={stats.byMonth}
                primaryColor={colors.primary}
                mutedColor={colors.muted}
                textColor={colors.mutedForeground}
              />
            ) : (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No data for {selectedYear}
              </Text>
            )}
          </View>

          {/* Tags */}
          {stats && stats.byTag.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Tags</Text>
              {stats.byTag.slice(0, 8).map((tagCount) => {
                const maxTagCount = stats.byTag[0]?.count ?? 1;
                const pct = tagCount.count / maxTagCount;
                return (
                  <View key={tagCount.tag} style={styles.tagRow}>
                    <Text style={[styles.tagName, { color: colors.foreground }]} numberOfLines={1}>
                      {tagCount.tag}
                    </Text>
                    <View style={[styles.tagBarBg, { backgroundColor: colors.muted, flex: 1, borderRadius: 4 }]}>
                      <View
                        style={[
                          styles.tagBarFill,
                          { backgroundColor: colors.primary, width: `${Math.max(pct * 100, 4)}%`, borderRadius: 4 },
                        ]}
                      />
                    </View>
                    <Text style={[styles.tagCount, { color: colors.mutedForeground }]}>
                      {tagCount.count}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Empty state */}
          {stats && stats.total === 0 && (
            <View style={styles.emptyCenter}>
              <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data for {selectedYear}</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Log some titles to see your stats.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold', letterSpacing: -0.5, marginBottom: 10 },
  yearScroll: { flexGrow: 0 },
  yearScrollContent: { gap: 8, flexDirection: 'row', paddingBottom: 4 },
  yearPill: { paddingHorizontal: 14, paddingVertical: 6 },
  yearPillText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, fontFamily: 'Manrope_600SemiBold' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderRadius: 20 },
  retryText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '40%', padding: 16, borderWidth: 1, alignItems: 'center' },
  statValue: { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', letterSpacing: -1 },
  statLabel: { fontSize: 12, fontFamily: 'Manrope_500Medium', marginTop: 2 },
  section: { padding: 16, marginBottom: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold', marginBottom: 14 },
  emptyText: { fontFamily: 'Manrope_400Regular', fontSize: 14 },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  tagName: { width: 80, fontSize: 13, fontFamily: 'Manrope_500Medium' },
  tagBarBg: { height: 8 },
  tagBarFill: { height: 8 },
  tagCount: { width: 28, textAlign: 'right', fontSize: 12, fontFamily: 'Manrope_400Regular' },
  emptyCenter: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 },
  emptyTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold' },
  emptyHint: { fontSize: 14, fontFamily: 'Manrope_400Regular', textAlign: 'center' },
});
