import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { PosterCard } from '@/components/PosterCard';
import { useListEntries } from '@workspace/api-client-react';

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeType, setActiveType] = useState<'all' | 'movie' | 'show'>('all');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: entries, isLoading } = useListEntries(
    debouncedQuery || activeType !== 'all'
      ? {
          search: debouncedQuery || undefined,
          type: activeType !== 'all' ? activeType : undefined,
        }
      : undefined,
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 56;

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  };

  const types: { label: string; value: 'all' | 'movie' | 'show' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Movies', value: 'movie' },
    { label: 'Shows', value: 'show' },
  ];

  const showList = debouncedQuery.length > 0 || activeType !== 'all';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Search</Text>
      </View>

      {/* Search input */}
      <View style={[styles.searchRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search your collection…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground, fontFamily: 'Manrope_400Regular' }]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Type filter pills */}
      <View style={styles.filterRow}>
        {types.map((t) => {
          const active = activeType === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => setActiveType(t.value)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? colors.primary : colors.muted,
                  borderRadius: 16,
                },
              ]}
            >
              <Text style={[styles.filterText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Results */}
      {!showList ? (
        <View style={styles.emptyState}>
          <Feather name="search" size={44} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Find a title</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Search by name or filter by type to browse your collection.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : entries && entries.length > 0 ? (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <PosterCard
                entry={item}
                onPress={() => router.push(`/entry/${item.id}`)}
                compact
              />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <View style={styles.emptyState}>
          <Feather name="film" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Nothing in your collection matches "{debouncedQuery}".
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold', letterSpacing: -0.5 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, padding: 0 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6 },
  filterText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold', marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Manrope_400Regular', textAlign: 'center', lineHeight: 20 },
  listItem: { marginBottom: 0 },
});
