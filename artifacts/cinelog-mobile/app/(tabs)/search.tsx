/**
 * Search Tab
 *
 * Lets the user search TMDB for movies and shows,
 * then quickly log them via a bottom sheet with
 * Watching / Watchlist / Mark Watched options.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
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
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        if (!domain) {
          setResults([]);
          setLoading(false);
          return;
        }
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

// ── TMDB Trending hook ────────────────────────────────────────────────────────

function useTmdbTrending() {
  const [items, setItems] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;
    setLoading(true);
    authFetch(`https://${domain}/api/tmdb/trending`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => setItems(d.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { items, loading };
}

// ── Status options ────────────────────────────────────────────────────────────

const STATUSES: { key: Status; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'completed', label: 'Watched', icon: 'check-circle' },
  { key: 'watching', label: 'Watching', icon: 'play' },
  { key: 'plan_to_watch', label: 'Watchlist', icon: 'bookmark' },
];

// ── Result Card ───────────────────────────────────────────────────────────────

interface ResultCardProps {
  item: TmdbItem;
  onPress: (item: TmdbItem) => void;
  colors: ReturnType<typeof useColors>;
}

function ResultCard({ item, onPress, colors }: ResultCardProps) {
  return (
    <TouchableOpacity
      style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {item.posterUrl ? (
        <Image
          source={{ uri: item.posterUrl }}
          style={styles.resultPoster}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.resultPoster, styles.posterPlaceholder, { backgroundColor: colors.muted }]}>
          <Feather name="film" size={18} color={colors.mutedForeground} />
        </View>
      )}
      <View style={styles.resultBody}>
        <Text style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>
          {item.type === 'movie' ? 'Movie' : 'Show'}
          {item.year ? ` · ${item.year}` : ''}
        </Text>
        {item.overview ? (
          <Text style={[styles.resultOverview, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.overview}
          </Text>
        ) : null}
      </View>
      <View style={[styles.addBtn, { backgroundColor: colors.primary }]}>
        <Feather name="plus" size={14} color={colors.primaryForeground} />
      </View>
    </TouchableOpacity>
  );
}

// ── Quick-Log Sheet ───────────────────────────────────────────────────────────

interface QuickLogSheetProps {
  item: TmdbItem | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { bottom: number };
}

function QuickLogSheet({ item, visible, onClose, onSaved, colors, insets }: QuickLogSheetProps) {
  const queryClient = useQueryClient();
  const createEntry = useCreateEntry();

  const [status, setStatus] = useState<Status>('completed');
  const [year, setYear] = useState(new Date().getFullYear());
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setStatus('completed');
      setYear(item.year ?? new Date().getFullYear());
      setRating(0);
      setSaving(false);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createEntry.mutateAsync({
        data: {
          title: item.title,
          type: item.type,
          status,
          posterUrl: item.posterUrl ?? undefined,
          dateWatched: status === 'completed' ? `${year}-01-01` : undefined,
          year: status !== 'plan_to_watch' ? year : undefined,
          rating: rating > 0 ? rating : undefined,
          synopsis: item.overview ?? undefined,
          tmdbId: item.tmdbId,
        } as any,
      });
      await queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey({}) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: bottomPad + 12,
            },
          ]}
        >
          {/* Grabber */}
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          {/* Title row */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              {item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  style={styles.sheetPoster}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.sheetPoster, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="film" size={16} color={colors.mutedForeground} />
                </View>
              )}
              <View style={styles.sheetTitleBody}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.sheetMeta, { color: colors.mutedForeground }]}>
                  {item.type === 'movie' ? 'Movie' : 'Show'}
                  {item.year ? ` · ${item.year}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Status chips */}
          <View style={styles.sheetSection}>
            <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>STATUS</Text>
            <View style={styles.chipsRow}>
              {STATUSES.map((s) => {
                const active = status === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setStatus(s.key);
                    }}
                  >
                    <Feather
                      name={s.icon}
                      size={13}
                      color={active ? colors.primaryForeground : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Year (hidden for watchlist) */}
          {status !== 'plan_to_watch' && (
            <View style={styles.sheetSection}>
              <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>
                {status === 'watching' ? 'STARTED' : 'YEAR WATCHED'}
              </Text>
              <View style={styles.yearRow}>
                <TouchableOpacity
                  style={[styles.yearBtn, { backgroundColor: colors.muted }]}
                  onPress={() => { Haptics.selectionAsync(); setYear((y) => y - 1); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="minus" size={16} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[styles.yearText, { color: colors.foreground }]}>{year}</Text>
                <TouchableOpacity
                  style={[styles.yearBtn, { backgroundColor: colors.muted }]}
                  onPress={() => {
                    const maxYear = new Date().getFullYear();
                    if (year < maxYear) { Haptics.selectionAsync(); setYear((y) => y + 1); }
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="plus" size={16} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Rating */}
          {status === 'completed' && (
            <View style={styles.sheetSection}>
              <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>RATING</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRating(rating === star ? 0 : star);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather
                      name="star"
                      size={28}
                      color={star <= rating ? colors.primary : colors.border}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Save */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary, marginHorizontal: 20, marginTop: 8 },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                Save to Collection
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<TmdbItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  const { results, loading: searchLoading } = useTmdbSearch(query);
  const { items: trending, loading: trendingLoading } = useTmdbTrending();

  const isSearching = query.trim().length > 0;
  const displayItems: TmdbItem[] = isSearching ? results : trending;
  const isLoading = isSearching ? searchLoading : trendingLoading;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleSelect = useCallback((item: TmdbItem) => {
    Haptics.selectionAsync();
    setSelectedItem(item);
    setSheetVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

  const handleSaved = useCallback(() => {
    if (selectedItem) setSavedId(selectedItem.tmdbId);
    setSheetVisible(false);
    setTimeout(() => {
      setSelectedItem(null);
      setSavedId(null);
    }, 2000);
  }, [selectedItem]);

  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 60;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerArea, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Search</Text>
        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Movies, shows…"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            testID="search-input"
          />
          {(isLoading || query.length > 0) ? (
            isLoading ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )
          ) : null}
        </View>
      </View>

      {/* Section label */}
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {isSearching ? 'RESULTS' : 'TRENDING'}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={displayItems}
        keyExtractor={(item) => `${item.tmdbId}`}
        renderItem={({ item }) => {
          const wasSaved = savedId === item.tmdbId;
          return (
            <View>
              <ResultCard item={item} onPress={handleSelect} colors={colors} />
              {wasSaved && (
                <View style={[styles.savedBanner, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={12} color={colors.primaryForeground} />
                  <Text style={[styles.savedText, { color: colors.primaryForeground }]}>
                    Added to collection
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Feather
                name={isSearching ? 'search' : 'trending-up'}
                size={40}
                color={colors.border}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {isSearching ? 'No results' : 'Loading trending…'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {isSearching
                  ? 'Try a different title'
                  : 'Check your connection'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Quick-log bottom sheet */}
      <QuickLogSheet
        item={selectedItem}
        visible={sheetVisible}
        onClose={handleClose}
        onSaved={handleSaved}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Header
  headerArea: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
  },

  // Section label
  sectionRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.8,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },

  // Result card
  resultCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  resultPoster: {
    width: 52,
    height: 78,
    borderRadius: 8,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBody: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    lineHeight: 20,
  },
  resultMeta: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
  },
  resultOverview: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 17,
    marginTop: 2,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  // Saved banner
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  savedText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
  },

  // Sheet overlay
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  sheetPoster: {
    width: 44,
    height: 64,
    borderRadius: 8,
  },
  sheetTitleBody: {
    flex: 1,
    gap: 3,
  },
  sheetTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    lineHeight: 22,
  },
  sheetMeta: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
  },

  // Sheet sections
  sheetSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  sheetLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.8,
  },

  // Status chips
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },

  // Year
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  yearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    fontSize: 24,
    fontFamily: 'Manrope_700Bold',
    minWidth: 70,
    textAlign: 'center',
  },

  // Stars
  starsRow: {
    flexDirection: 'row',
    gap: 6,
  },

  // Save button
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
  },
});
