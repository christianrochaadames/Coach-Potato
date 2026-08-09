/**
 * Search Tab — matches web app:
 * • No query → Popular TV Shows + Popular Movies sections, Refresh cycles pages
 * • Query → Debounced TMDB search results
 * • "In your collection" detection with pink highlight
 * • Quick-log bottom sheet (status / year / optional rating)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SectionList,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateEntry, useListEntries,
  getListEntriesQueryKey,
} from '@workspace/api-client-react';
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

const PROD_DOMAIN = 'couch-potato.replit.app';
function getBase() {
  const d = process.env.EXPO_PUBLIC_DOMAIN;
  return d ? `https://${d}` : `https://${PROD_DOMAIN}`;
}

// ── TMDB Search hook ──────────────────────────────────────────────────────────

function useTmdbSearch(query: string) {
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const base = getBase(); if (!base) { setLoading(false); return; }
        const res = await authFetch(`${base}/api/tmdb/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        setResults(data.results ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}

// ── Popular hook (movies + shows, paginated) ──────────────────────────────────

function usePopular() {
  const [movies, setMovies] = useState<TmdbItem[]>([]);
  const [shows, setShows] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetch_ = useCallback(async (p: number) => {
    const base = getBase(); if (!base) return;
    setLoading(true);
    try {
      const res = await authFetch(`${base}/api/tmdb/popular?page=${p}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setMovies(d.movies ?? []);
      setShows(d.shows ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(page); }, [page, fetch_]);

  const refresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPage(p => (p % 5) + 1);
  }, []);

  return { movies, shows, loading, refresh };
}

// ── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({
  item, onPress, inCollection,
}: { item: TmdbItem; onPress: (item: TmdbItem) => void; inCollection: boolean }) {
  return (
    <TouchableOpacity
      style={[
        styles.resultCard,
        inCollection && styles.resultCardInCollection,
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {item.posterUrl ? (
        <Image source={{ uri: item.posterUrl }} style={styles.resultPoster} resizeMode="cover" />
      ) : (
        <View style={[styles.resultPoster, styles.posterPlaceholder]}>
          <Feather name="film" size={18} color="#A09898" />
        </View>
      )}
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.resultMeta}>
          {[item.year, item.type === 'movie' ? 'Movie' : 'TV Show'].filter(Boolean).join(' · ')}
        </Text>
        {inCollection && (
          <Text style={styles.inCollectionText}>✓ In your collection</Text>
        )}
      </View>
      <View style={[
        styles.typeBadge,
        { backgroundColor: item.type === 'movie' ? '#E0E7FF' : '#EDE9FE' },
      ]}>
        <Text style={[
          styles.typeBadgeText,
          { color: item.type === 'movie' ? '#3730A3' : '#5B21B6' },
        ]}>
          {item.type === 'movie' ? 'Movie' : 'TV Show'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Quick-Log Sheet ───────────────────────────────────────────────────────────

const STATUSES: { key: Status; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'completed', label: 'Watched', icon: 'check-circle' },
  { key: 'watching', label: 'Watching', icon: 'play' },
  { key: 'plan_to_watch', label: 'Watchlist', icon: 'bookmark' },
];

function QuickLogSheet({
  item, visible, onClose, onSaved, insets,
}: {
  item: TmdbItem | null; visible: boolean;
  onClose: () => void; onSaved: () => void;
  insets: { bottom: number };
}) {
  const queryClient = useQueryClient();
  const createEntry = useCreateEntry();

  const [status, setStatus] = useState<Status>('completed');
  const [year, setYear] = useState(new Date().getFullYear());
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);

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
          title: item.title, type: item.type, status,
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
    } finally { setSaving(false); }
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            {item.posterUrl ? (
              <Image source={{ uri: item.posterUrl }} style={styles.sheetPoster} resizeMode="cover" />
            ) : (
              <View style={[styles.sheetPoster, { backgroundColor: '#EFE4D2', alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="film" size={16} color="#A09898" />
              </View>
            )}
            <View style={styles.sheetTitleBody}>
              <Text style={styles.sheetTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.sheetMeta}>
                {item.type === 'movie' ? 'Movie' : 'Show'}{item.year ? ` · ${item.year}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color="#A09898" />
            </TouchableOpacity>
          </View>

          {/* Status */}
          <View style={styles.sheetSection}>
            <Text style={styles.sheetLabel}>STATUS</Text>
            <View style={styles.chipsRow}>
              {STATUSES.map(s => {
                const active = status === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { Haptics.selectionAsync(); setStatus(s.key); }}
                  >
                    <Feather name={s.icon} size={13} color={active ? '#ffffff' : '#7E7A73'} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Year */}
          {status !== 'plan_to_watch' && (
            <View style={styles.sheetSection}>
              <Text style={styles.sheetLabel}>{status === 'watching' ? 'STARTED' : 'YEAR WATCHED'}</Text>
              <View style={styles.yearRow}>
                <TouchableOpacity
                  style={styles.yearBtn}
                  onPress={() => { Haptics.selectionAsync(); setYear(y => y - 1); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="minus" size={16} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.yearText}>{year}</Text>
                <TouchableOpacity
                  style={styles.yearBtn}
                  onPress={() => { if (year < new Date().getFullYear()) { Haptics.selectionAsync(); setYear(y => y + 1); } }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="plus" size={16} color="#111111" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Rating */}
          {status === 'completed' && (
            <View style={styles.sheetSection}>
              <Text style={styles.sheetLabel}>RATING</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => { Haptics.selectionAsync(); setRating(rating === star ? 0 : star); }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="star" size={28} color={star <= rating ? '#116149' : '#D4C9BC'} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>Save to Collection</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<TmdbItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  // User's collection for "In your collection" detection
  const { data: collectionData } = useListEntries({} as any);
  const collectionTmdbIds = new Set<number>(
    ((collectionData as any[]) ?? [])
      .map((e: any) => e.tmdbId)
      .filter(Boolean)
  );

  const { results, loading: searchLoading } = useTmdbSearch(query);
  const { movies, shows, loading: popularLoading, refresh } = usePopular();

  const isSearching = query.trim().length > 0;
  const isLoading = isSearching ? searchLoading : popularLoading;

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
    setTimeout(() => { setSelectedItem(null); setSavedId(null); }, 2500);
  }, [selectedItem]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 60;
  const cardBottomGap = Platform.OS === 'web' ? 76 : insets.bottom + 74;

  const renderItem = ({ item }: { item: TmdbItem }) => {
    const wasSaved = savedId === item.tmdbId;
    const inColl = collectionTmdbIds.has(item.tmdbId);
    return (
      <View>
        <ResultCard item={item} onPress={handleSelect} inCollection={inColl} />
        {wasSaved && (
          <View style={styles.savedBanner}>
            <Feather name="check" size={12} color="#ffffff" />
            <Text style={styles.savedText}>Added to collection</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* ── Inner card (amber border shows through on all sides) ── */}
      <View style={[styles.innerCard, { marginTop: insets.top + 12, marginBottom: cardBottomGap }]}>

        {/* ── Header ── */}
        <View style={styles.headerArea}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Search</Text>
          </View>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="#7E7A73" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search Movies & TV Shows…"
              placeholderTextColor="#A09898"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              testID="search-input"
            />
            {isLoading ? (
              <ActivityIndicator size="small" color="#7E7A73" />
            ) : query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x-circle" size={16} color="#7E7A73" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── Content ── */}
        {isSearching ? (
          /* Search results */
          <FlatList
            data={results}
            keyExtractor={item => `${item.tmdbId}`}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={styles.sectionLabel}>RESULTS</Text>
            }
            ListEmptyComponent={
              !searchLoading ? (
                <View style={styles.emptyState}>
                  <Feather name="search" size={40} color="#D4C9BC" />
                  <Text style={styles.emptyTitle}>No results</Text>
                  <Text style={styles.emptySubtitle}>Try a different title</Text>
                </View>
              ) : null
            }
          />
        ) : (
          /* Popular sections */
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: bottomPad }}
          >
            {popularLoading && movies.length === 0 ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#116149" />
              </View>
            ) : (
              <>
                {/* Popular TV Shows */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { paddingHorizontal: 0, paddingTop: 0 }]}>POPULAR TV SHOWS</Text>
                  <TouchableOpacity style={styles.refreshBtn} onPress={refresh} activeOpacity={0.8}>
                    <Feather name="refresh-cw" size={13} color="#116149" />
                    <Text style={styles.refreshText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
                {shows.map(item => (
                  <View key={item.tmdbId}>
                    <ResultCard item={item} onPress={handleSelect} inCollection={collectionTmdbIds.has(item.tmdbId)} />
                    {savedId === item.tmdbId && (
                      <View style={styles.savedBanner}>
                        <Feather name="check" size={12} color="#ffffff" />
                        <Text style={styles.savedText}>Added to collection</Text>
                      </View>
                    )}
                  </View>
                ))}

                {/* Popular Movies */}
                <Text style={[styles.sectionLabel, { marginTop: 8 }]}>POPULAR MOVIES</Text>
                {movies.map(item => (
                  <View key={item.tmdbId}>
                    <ResultCard item={item} onPress={handleSelect} inCollection={collectionTmdbIds.has(item.tmdbId)} />
                    {savedId === item.tmdbId && (
                      <View style={styles.savedBanner}>
                        <Feather name="check" size={12} color="#ffffff" />
                        <Text style={styles.savedText}>Added to collection</Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}

      </View>{/* end innerCard */}

      {/* Quick-log sheet — outside card so it can overlay fully */}
      <QuickLogSheet
        item={selectedItem}
        visible={sheetVisible}
        onClose={handleClose}
        onSaved={handleSaved}
        insets={insets}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFBC4D' },

  innerCard: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    borderRadius: 24,
    marginHorizontal: 16,
    overflow: 'hidden',
  },

  headerArea: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Manrope_700Bold', color: '#111111' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#116149',
  },
  refreshText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: '#116149' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#F5A623',
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: '#ffffff',
  },
  searchInput: {
    flex: 1, fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#111111',
    padding: 0,
  },

  sectionLabel: {
    fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#7E7A73',
    letterSpacing: 0.8, paddingTop: 14, paddingBottom: 8, paddingHorizontal: 16,
  },

  listContent: { paddingHorizontal: 16, gap: 10, paddingTop: 4 },

  resultCard: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: '#E2D9CE',
    overflow: 'hidden', padding: 12, gap: 12, alignItems: 'flex-start',
    backgroundColor: '#ffffff', marginHorizontal: 16, marginBottom: 10,
  },
  resultCardInCollection: {
    borderColor: '#4A1020', backgroundColor: '#FFF0F3',
  },
  resultPoster: { width: 52, height: 78, borderRadius: 8 },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE4D2' },
  resultBody: { flex: 1, gap: 3, justifyContent: 'center' },
  resultTitle: {
    fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: '#111111', lineHeight: 20,
  },
  resultMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  typeBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: 'center',
  },
  typeBadgeText: { fontSize: 10, fontFamily: 'Manrope_700Bold' },
  inCollectionText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#116149' },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },

  savedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: -4, marginHorizontal: 16, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#116149', borderRadius: 8,
  },
  savedText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: '#ffffff' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Manrope_600SemiBold', color: '#111111' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },

  // Sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#D4C9BC', alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    paddingHorizontal: 20, marginBottom: 4,
  },
  sheetPoster: { width: 44, height: 64, borderRadius: 8 },
  sheetTitleBody: { flex: 1, gap: 3 },
  sheetTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#111111', lineHeight: 22 },
  sheetMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },

  sheetSection: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  sheetLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#7E7A73', letterSpacing: 0.8 },

  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: '#D4C9BC', backgroundColor: '#FFF3E8',
  },
  chipActive: { backgroundColor: '#116149', borderColor: '#116149' },
  chipText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: '#7E7A73' },
  chipTextActive: { color: '#ffffff' },

  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  yearBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFE4D2', alignItems: 'center', justifyContent: 'center',
  },
  yearText: {
    fontSize: 24, fontFamily: 'Manrope_700Bold', color: '#111111',
    minWidth: 70, textAlign: 'center',
  },

  starsRow: { flexDirection: 'row', gap: 6 },

  saveBtn: {
    backgroundColor: '#116149', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
});
