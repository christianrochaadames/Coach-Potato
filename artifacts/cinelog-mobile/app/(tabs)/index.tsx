import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { PosterCard } from '@/components/PosterCard';
import {
  useListYears,
  useListEntries,
  getListEntriesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import type { YearSummary } from '@workspace/api-client-react';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: years, isLoading: yearsLoading } = useListYears();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const {
    data: entries,
    isLoading: entriesLoading,
    isError,
    refetch,
    isRefetching,
  } = useListEntries({ year: selectedYear, status: 'completed' });

  const handleYearPress = (year: number) => {
    Haptics.selectionAsync();
    setSelectedYear(year);
  };

  const handleEntryPress = (id: number) => {
    router.push(`/entry/${id}`);
  };

  const handleLogPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/log-entry');
  };

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListEntriesQueryKey({ year: selectedYear }) });
    refetch();
  }, [selectedYear, refetch, qc]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : (insets.bottom + 56);

  // Build year list — always include current year even if no entries
  const yearList: number[] = [];
  if (years && years.length > 0) {
    years.forEach((ys: YearSummary) => {
      if (ys.year && !yearList.includes(ys.year)) yearList.push(ys.year);
    });
  }
  if (!yearList.includes(currentYear)) yearList.unshift(currentYear);
  yearList.sort((a, b) => b - a);

  const totalForYear =
    years?.find((ys: YearSummary) => ys.year === selectedYear)?.count ?? 0;

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Feather name="film" size={40} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing logged yet</Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Tap the + button to log your first title for {selectedYear}.
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.appName, { color: colors.primary }]}>CineLog</Text>
          {!entriesLoading && (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {totalForYear} {totalForYear === 1 ? 'title' : 'titles'} in {selectedYear}
            </Text>
          )}
        </View>
        <Pressable
          onPress={handleLogPress}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {/* Year selector */}
      {yearsLoading ? (
        <View style={styles.yearLoadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
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
                onPress={() => handleYearPress(yr)}
                style={[
                  styles.yearPill,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                    borderRadius: 20,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.yearPillText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {yr}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Entry grid */}
      {entriesLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.empty}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn't load entries</Text>
          <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.primary }]}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={entries ?? []}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          renderItem={({ item }) => (
            <PosterCard entry={item} onPress={() => handleEntryPress(item.id)} />
          )}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: bottomPad },
            (!entries || entries.length === 0) && styles.gridEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={!!(entries && entries.length > 0)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  appName: {
    fontSize: 26,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    marginTop: 1,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearLoadingRow: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearScroll: { flexGrow: 0 },
  yearScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
  },
  yearPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  yearPillText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
  },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: 10, paddingTop: 4 },
  gridEmpty: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold', marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Manrope_400Regular', textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderRadius: 20 },
  retryText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14 },
});
