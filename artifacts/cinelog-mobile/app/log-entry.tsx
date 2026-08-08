/**
 * Log Entry Screen
 *
 * Reachable via:
 *  • FAB on the home screen
 *  • Deep link:  couchpotato://log-entry
 *  • iOS quick action: "Log Entry" (long-press app icon in native build)
 *
 * Lets the user search TMDB, pick a title, choose a status,
 * set a year, and save the entry to the API.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import {
  useCreateEntry,
  getListEntriesQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { authFetch } from '@/utils/authFetch';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TmdbItem {
  tmdbId: number;
  title: string;
  type: 'movie' | 'show';
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
}

type Status = 'completed' | 'watching' | 'plan_to_watch';

// ── TMDB Search hook ──────────────────────────────────────────────────────────

function useTmdbSearch(query: string) {
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
        const res = await authFetch(
          `https://${domain}/api/tmdb/search?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUSES: { key: Status; label: string; icon: string }[] = [
  { key: 'completed', label: 'Watched', icon: 'check-circle' },
  { key: 'watching', label: 'Watching', icon: 'play' },
  { key: 'plan_to_watch', label: 'Watchlist', icon: 'bookmark' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LogEntryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const createEntry = useCreateEntry();
  const { isSignedIn, isLoaded } = useAuth();

  // Guard: deep-link cold-starts bypass the tabs layout auth guard
  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<TmdbItem | null>(null);
  const [status, setStatus] = useState<Status>('completed');
  const [year, setYear] = useState(new Date().getFullYear());
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { results, loading } = useTmdbSearch(searchQuery);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSelect = (item: TmdbItem) => {
    Haptics.selectionAsync();
    setSelected(item);
    setSearchQuery('');
    if (item.year) setYear(item.year);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createEntry.mutateAsync({
        data: {
          title: selected.title,
          type: selected.type,
          status,
          posterUrl: selected.posterUrl ?? undefined,
          dateWatched: status === 'completed' ? `${year}-01-01` : undefined,
          year: status !== 'plan_to_watch' ? year : undefined,
          notes: notes.trim() || undefined,
          rating: rating > 0 ? rating : undefined,
          synopsis: selected.overview ?? undefined,
          tmdbId: selected.tmdbId,
        } as any,
      });
      await queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey({}) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      console.error(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const canSave = selected != null && !saving;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: colors.muted }]}
          activeOpacity={0.7}
          testID="close-btn"
        >
          <Feather name="x" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Log Entry
        </Text>
        <TouchableOpacity
          style={[
            styles.saveBtn,
            {
              backgroundColor: canSave ? colors.primary : colors.muted,
            },
          ]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.8}
          testID="save-btn"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.saveBtnText,
                { color: canSave ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={styles.section}>
          <View
            style={[
              styles.searchRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search movies & shows…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoFocus={!selected}
              returnKeyType="search"
              testID="search-input"
            />
            {(loading || searchQuery.length > 0) && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                {loading ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Search results */}
          {results.length > 0 && !selected && (
            <View
              style={[
                styles.dropdown,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {results.slice(0, 8).map((item) => (
                <TouchableOpacity
                  key={item.tmdbId}
                  style={[styles.resultRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  {item.posterUrl ? (
                    <Image
                      source={{ uri: item.posterUrl }}
                      style={styles.resultPoster}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.resultPosterPlaceholder, { backgroundColor: colors.muted }]}>
                      <Feather name="film" size={14} color={colors.mutedForeground} />
                    </View>
                  )}
                  <View style={styles.resultBody}>
                    <Text
                      style={[styles.resultTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>
                      {item.type === 'movie' ? 'Movie' : 'Show'}
                      {item.year ? ` · ${item.year}` : ''}
                    </Text>
                  </View>
                  <Feather name="plus" size={16} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Selected title preview */}
        {selected && (
          <View style={styles.section}>
            <View
              style={[
                styles.selectedCard,
                { backgroundColor: colors.card, borderColor: colors.primary },
              ]}
            >
              {selected.posterUrl ? (
                <Image
                  source={{ uri: selected.posterUrl }}
                  style={styles.selectedPoster}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[styles.selectedPosterPlaceholder, { backgroundColor: colors.muted }]}
                >
                  <Feather name="film" size={28} color={colors.mutedForeground} />
                </View>
              )}
              <View style={styles.selectedBody}>
                <Text style={[styles.selectedTitle, { color: colors.foreground }]}>
                  {selected.title}
                </Text>
                <Text style={[styles.selectedMeta, { color: colors.mutedForeground }]}>
                  {selected.type === 'movie' ? 'Movie' : 'Show'}
                  {selected.year ? ` · ${selected.year}` : ''}
                </Text>
                {selected.overview ? (
                  <Text
                    style={[styles.selectedOverview, { color: colors.mutedForeground }]}
                    numberOfLines={2}
                  >
                    {selected.overview}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setSelected(null)}
                style={[styles.clearSelected, { backgroundColor: colors.muted }]}
                activeOpacity={0.7}
              >
                <Feather name="x" size={14} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Status */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>STATUS</Text>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => {
              const active = status === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setStatus(s.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Feather
                    name={s.icon as any}
                    size={14}
                    color={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: active ? colors.primaryForeground : colors.foreground,
                      },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Year */}
        {status !== 'plan_to_watch' && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {status === 'completed' ? 'YEAR WATCHED' : 'YEAR STARTED'}
            </Text>
            <View style={styles.yearRow}>
              <TouchableOpacity
                style={[styles.yearBtn, { backgroundColor: colors.muted }]}
                onPress={() => setYear((y) => Math.max(1900, y - 1))}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.yearValue, { color: colors.foreground }]}>{year}</Text>
              <TouchableOpacity
                style={[styles.yearBtn, { backgroundColor: colors.muted }]}
                onPress={() => setYear((y) => Math.min(new Date().getFullYear(), y + 1))}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rating */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>RATING</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => {
                  Haptics.selectionAsync();
                  setRating(rating === star ? 0 : star);
                }}
                activeOpacity={0.7}
              >
                <Feather
                  name="star"
                  size={32}
                  color={star <= rating ? colors.primary : colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any thoughts…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={[
              styles.notesInput,
              {
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    padding: 0,
  },
  dropdown: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  resultPoster: { width: 38, height: 56, borderRadius: 6 },
  resultPosterPlaceholder: {
    width: 38,
    height: 56,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBody: { flex: 1 },
  resultTitle: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  resultMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  selectedCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  selectedPoster: { width: 80, height: 120 },
  selectedPosterPlaceholder: {
    width: 80,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBody: { flex: 1, padding: 12, gap: 4 },
  selectedTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', lineHeight: 22 },
  selectedMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
  selectedOverview: { fontSize: 12, fontFamily: 'Manrope_400Regular', lineHeight: 17, marginTop: 4 },
  clearSelected: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statusChipText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  yearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearValue: { fontSize: 28, fontFamily: 'Manrope_700Bold', minWidth: 80, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 8 },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
});
