import { getGetCommunityRatingsQueryKey, getGetShowSeasonCommunityRatingsQueryKey } from '@workspace/api-client-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router, Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetEntry,
  useUpdateEntry,
  useDeleteEntry,
  getListEntriesQueryKey,
  getGetEntryQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { authFetch } from '@/utils/authFetch';
import { trackEvent } from '@/utils/analytics';
import { QuickLogSheet, type TmdbItem } from '@/app/(tabs)/search';
import { CommunityRatings, SeasonCommunityChart, SeasonCommunitySummary } from '@/components/CommunityRatings';
import { ShareTitleButton } from '@/components/ShareTitleButton';
import { useTitleIdentity } from '@/utils/titleShare';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CastMember { name: string; character: string; profileUrl: string | null; personId?: number | null; order: number }
interface TmdbDirector { name: string; job: string; profileUrl: string | null; personId?: number | null }
interface TmdbDetail {
  title: string; overview: string | null; cast: CastMember[];
  directors: TmdbDirector[]; runtime: number | null;
  releaseYear: number | null; voteAverage: number | null; genres: string[];
}
interface WatchProvider { providerId: number; providerName: string; logoUrl: string }
interface WatchProviders {
  region: string; link: string | null;
  streaming: WatchProvider[]; rent: WatchProvider[]; buy: WatchProvider[];
}
interface OmdbRatings { rtScore: string | null; imdbRating: string | null }
interface TmdbRec { tmdbId: number; title: string; type: 'movie' | 'show'; year: number | null; posterUrl: string | null }

interface TmdbSeasonSummary {
  number: number; name: string; episodeCount: number; posterUrl: string | null; airYear: number | null;
}
interface EpisodeData {
  number: number; title?: string; watched: boolean; airDate?: string | null;
  stillUrl?: string | null; runtime?: number | null; overview?: string | null;
}
interface Season {
  number: number; status: string; dateWatched?: string | null;
  rating?: number | null; notes?: string | null; episodes?: EpisodeData[];
}
interface EpSheetState {
  activeSeason: number;
  seasonNums: number[];
  bySeasonEdits: Record<number, EpisodeData[]>;
  bySeasonLoaded: Record<number, EpisodeData[]>;
  loading: Record<number, boolean>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const CUR_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 60 }, (_, i) => CUR_YEAR - i);

type Status = 'completed' | 'watching' | 'plan_to_watch';
const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'completed', label: 'Watched' },
  { value: 'watching', label: 'Watching' },
  { value: 'plan_to_watch', label: 'Watchlist' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROD_DOMAIN = 'couch-potato.replit.app';
function getApiBase() { return `https://${process.env.EXPO_PUBLIC_DOMAIN ?? PROD_DOMAIN}`; }

function formatMonthYear(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function providerGroup(name: string): string {
  const value = name.toLowerCase();
  const groups: Array<[string, RegExp]> = [
    ['paramount', /paramount/],
    ['netflix', /netflix/],
    ['disney', /disney/],
    ['hulu', /hulu/],
    ['prime', /amazon|prime video/],
    ['apple', /apple tv/],
    ['max', /\bmax\b|hbo max/],
    ['peacock', /peacock/],
    ['youtube', /youtube/],
    ['starz', /starz/],
    ['showtime', /showtime/],
    ['crunchyroll', /crunchyroll/],
  ];
  const knownGroup = groups.find(([, pattern]) => pattern.test(value))?.[0];
  if (knownGroup) return knownGroup;
  const genericBase = value
    .replace(/\b(with ads|standard|essential|premium|on tv|amazon channel|roku channel|apple tv channel|channel)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return genericBase.split(' ').slice(0, 2).join(' ') || value;
}

function providerPriority(provider: WatchProvider, group: string): number {
  const name = provider.providerName.toLowerCase();
  if (group === 'paramount') {
    if (name.includes('premium') || name === 'paramount plus' || name === 'paramount+') return 0;
    if (name.includes('essential') || name.includes('on tv')) return 10;
    if (name.includes('channel') || name.includes('with ads')) return 20;
  }
  if (name.includes('with ads') || name.includes('standard')) return 10;
  return name.length;
}

function dedupeProviders(providers: WatchProvider[]): WatchProvider[] {
  const grouped = new Map<string, WatchProvider[]>();
  for (const provider of providers) {
    const group = providerGroup(provider.providerName);
    grouped.set(group, [...(grouped.get(group) ?? []), provider]);
  }
  return Array.from(grouped.entries()).map(([group, candidates]) =>
    [...candidates].sort((a, b) => providerPriority(a, group) - providerPriority(b, group))[0]
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useTmdbDetail(tmdbId: number | null | undefined, type: string | undefined) {
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!tmdbId || !type) return;
    const base = getApiBase(); if (!base) return;
    const url = `${base}/api/tmdb/${type === 'movie' ? 'movie' : 'tv'}/${tmdbId}`;
    setLoading(true);
    authFetch(url).then(r => r.ok ? r.json() : null).then(d => d && setDetail(d)).catch(() => {}).finally(() => setLoading(false));
  }, [tmdbId, type]);
  return { detail, loading };
}

function useTmdbSeasons(tmdbId: number | null | undefined, type: string | undefined) {
  const [seasons, setSeasons] = useState<TmdbSeasonSummary[]>([]);
  useEffect(() => {
    if (!tmdbId || type !== 'show') { setSeasons([]); return; }
    const base = getApiBase(); if (!base) return;
    authFetch(`${base}/api/tmdb/show/${tmdbId}`)
      .then(r => r.ok ? r.json() : {})
      .then((d: { seasons?: TmdbSeasonSummary[] }) => setSeasons(d.seasons ?? []))
      .catch(() => {});
  }, [tmdbId, type]);
  return seasons;
}

function useWatchProviders(tmdbId: number | null | undefined, type: string | undefined) {
  const [providers, setProviders] = useState<WatchProviders | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!tmdbId || !type) return;
    const base = getApiBase(); if (!base) return;
    const media = type === 'movie' ? 'movie' : 'tv';
    setLoading(true);
    authFetch(`${base}/api/tmdb/${media}/${tmdbId}/providers?region=US`)
      .then(r => r.ok ? r.json() : null).then(d => d && setProviders(d)).catch(() => {}).finally(() => setLoading(false));
  }, [tmdbId, type]);
  return { providers, loading };
}

function useOmdbRatings(title: string | undefined, year: number | null | undefined) {
  const [ratings, setRatings] = useState<OmdbRatings | null>(null);
  useEffect(() => {
    if (!title) return;
    const base = getApiBase(); if (!base) return;
    const y = year ? `&year=${year}` : '';
    authFetch(`${base}/api/omdb/ratings?title=${encodeURIComponent(title)}${y}`)
      .then(r => r.ok ? r.json() : null).then(d => d && setRatings({ rtScore: d.rtScore, imdbRating: d.imdbRating })).catch(() => {});
  }, [title, year]);
  return ratings;
}

function useRecommendations(tmdbId: number | null | undefined, type: string | undefined) {
  const [recs, setRecs] = useState<TmdbRec[]>([]);
  useEffect(() => {
    if (!tmdbId || !type) return;
    const base = getApiBase(); if (!base) return;
    const media = type === 'movie' ? 'movie' : 'tv';
    authFetch(`${base}/api/tmdb/${media}/${tmdbId}/recommendations`)
      .then(r => r.ok ? r.json() : null).then(d => setRecs(d?.results ?? [])).catch(() => {});
  }, [tmdbId, type]);
  return recs;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded } = useAuth();

  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  const { data: entry, isLoading } = useGetEntry(Number(id));
  const { detail: tmdbDetail, loading: tmdbLoading } = useTmdbDetail(entry?.tmdbId, entry?.type);
  const tmdbSeasons = useTmdbSeasons(entry?.tmdbId, entry?.type);
  const { providers: watchProviders, loading: providersLoading } = useWatchProviders(entry?.tmdbId, entry?.type);
  const omdbRatings = useOmdbRatings(entry?.title, entry?.year);
  const recommendations = useRecommendations(entry?.tmdbId, entry?.type);

  const identity = useTitleIdentity(entry ? { title: entry.title, type: entry.type, year: entry.year, tmdbId: entry.tmdbId } : null);
  const updateEntry = useUpdateEntry();
  const [ratingSavedTick, setRatingSavedTick] = useState(0);
  const deleteEntry = useDeleteEntry();

  function showSuccess(_msg: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Local state ───────────────────────────────────────────────────────────────
  const [localRating, setLocalRating] = useState(0);
  const [localStatus, setLocalStatus] = useState<Status>('completed');
  const [localDate, setLocalDate] = useState(''); // stored YYYY-MM-01
  const persistedStatusRef = useRef<Status>('completed');

  // Date picker modal
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [pickedMonth, setPickedMonth] = useState(new Date().getMonth()); // 0-indexed
  const [pickedYear, setPickedYear] = useState(new Date().getFullYear());

  // Episode sheet
  const [epSheet, setEpSheet] = useState<EpSheetState | null>(null);
  const [recommendationItem, setRecommendationItem] = useState<TmdbItem | null>(null);
  // Season rating modal
  const [seasonRatingModal, setSeasonRatingModal] = useState<{ num: number; rating: number } | null>(null);

  useEffect(() => {
    if (entry) {
      setLocalRating(entry.rating ?? 0);
      const nextStatus = (entry.status ?? 'completed') as Status;
      setLocalStatus(nextStatus);
      persistedStatusRef.current = nextStatus;
      setLocalDate(entry.dateWatched ?? '');
    }
  }, [entry]);

  // ── Autosave ──────────────────────────────────────────────────────────────────
  function autosave(patch: object, successText: string, onSaved?: () => void) {
    updateEntry.mutate(
      { id: Number(id), data: patch as any },
      {
        onSuccess: () => {
          onSaved?.();
          if ('rating' in patch && entry) {
            const cid = identity.tmdbId;
            if (cid) void queryClient.invalidateQueries({ queryKey: getGetCommunityRatingsQueryKey(entry.type === 'movie' ? 'movie' : 'show', cid) });
            setRatingSavedTick(t => t + 1);
          }
          if ('seasons' in patch && identity.tmdbId) {
            void queryClient.invalidateQueries({ queryKey: getGetShowSeasonCommunityRatingsQueryKey(identity.tmdbId) });
          }
          showSuccess(successText);
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(Number(id)) });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey({}) });
        },
        onError: () => Alert.alert('Error', 'Failed to save. Please try again.'),
      }
    );
  }

  // ── Date helpers ──────────────────────────────────────────────────────────────
  function openDatePicker() {
    if (localDate) {
      const d = new Date(localDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setPickedMonth(d.getMonth());
        setPickedYear(d.getFullYear());
      }
    } else {
      setPickedMonth(new Date().getMonth());
      setPickedYear(new Date().getFullYear());
    }
    setDateModalOpen(true);
  }

  function confirmDate() {
    const mm = String(pickedMonth + 1).padStart(2, '0');
    const dateStr = `${pickedYear}-${mm}-01`;
    setLocalDate(dateStr);
    setDateModalOpen(false);
    autosave({ dateWatched: dateStr }, 'Date saved');
  }

  function clearDate() {
    setLocalDate('');
    autosave({ dateWatched: null }, 'Date cleared');
  }

  // ── Season / episode helpers ──────────────────────────────────────────────────
  function getSeasonsArray(): Season[] { return ((entry as any)?.seasons ?? []) as Season[]; }

  function openEpisodeSheet(startSeason: number) {
    const seasonNums = tmdbSeasons.filter(s => s.number > 0).map(s => s.number);
    if (!seasonNums.length) return;
    const saved = getSeasonsArray();
    const savedEdits: Record<number, EpisodeData[]> = {};
    for (const s of saved) {
      if (s.episodes?.length) savedEdits[s.number] = s.episodes;
    }
    const initial: EpSheetState = { activeSeason: startSeason, seasonNums, bySeasonEdits: savedEdits, bySeasonLoaded: {}, loading: {} };
    setEpSheet(initial);
    if (entry?.tmdbId) loadSeasonEps(startSeason, entry.tmdbId, initial);
  }

  function loadSeasonEps(seasonNum: number, tmdbId: number, current: EpSheetState) {
    if (current.bySeasonLoaded[seasonNum] !== undefined) return;
    setEpSheet(prev => prev ? { ...prev, loading: { ...prev.loading, [seasonNum]: true } } : prev);
    const base = getApiBase();
    if (!base) return;
    const saved = getSeasonsArray().find(s => s.number === seasonNum);
    const existingEps = saved?.episodes ?? [];
    authFetch(`${base}/api/tmdb/tv/${tmdbId}/season/${seasonNum}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { episodes?: any[] } | null) => {
        if (!d?.episodes) {
          setEpSheet(prev => prev ? { ...prev, bySeasonLoaded: { ...prev.bySeasonLoaded, [seasonNum]: [] }, loading: { ...prev.loading, [seasonNum]: false } } : prev);
          return;
        }
        const fetched: EpisodeData[] = d.episodes.map((ep: any) => {
          const s = existingEps.find(e => e.number === ep.episode_number);
          return { number: ep.episode_number, title: ep.name, watched: s?.watched ?? false, airDate: ep.air_date ?? null, stillUrl: ep.stillUrl ?? null, runtime: ep.runtime ?? null, overview: ep.overview ?? null };
        });
        setEpSheet(prev => {
          if (!prev) return prev;
          const edits = prev.bySeasonEdits[seasonNum];
          return { ...prev, bySeasonLoaded: { ...prev.bySeasonLoaded, [seasonNum]: fetched }, bySeasonEdits: { ...prev.bySeasonEdits, [seasonNum]: edits ?? fetched }, loading: { ...prev.loading, [seasonNum]: false } };
        });
      })
      .catch(() => setEpSheet(prev => prev ? { ...prev, loading: { ...prev.loading, [seasonNum]: false } } : prev));
  }

  function switchEpSeason(num: number) {
    setEpSheet(prev => {
      if (!prev) return prev;
      const next = { ...prev, activeSeason: num };
      if (entry?.tmdbId && prev.bySeasonLoaded[num] === undefined) loadSeasonEps(num, entry.tmdbId, next);
      return next;
    });
  }

  function toggleEpisode(epNum: number) {
    if (!epSheet) return;
    const { activeSeason, bySeasonEdits, bySeasonLoaded } = epSheet;
    const base = bySeasonEdits[activeSeason] ?? bySeasonLoaded[activeSeason] ?? [];
    const updated = base.map(ep => ep.number === epNum ? { ...ep, watched: !ep.watched } : ep);
    setEpSheet(prev => prev ? { ...prev, bySeasonEdits: { ...prev.bySeasonEdits, [activeSeason]: updated } } : prev);
  }

  function saveEpisodes() {
    if (!epSheet) return;
    const { activeSeason, bySeasonEdits, bySeasonLoaded } = epSheet;
    const episodes = bySeasonEdits[activeSeason] ?? bySeasonLoaded[activeSeason] ?? [];
    const saved = getSeasonsArray();
    const watchedCount = episodes.filter(e => e.watched).length;
    const autoStatus: 'watched' | 'watching' = watchedCount === episodes.length && episodes.length > 0 ? 'watched' : 'watching';
    const updated: Season[] = [
      ...saved.filter(s => s.number !== activeSeason),
      { ...(saved.find(s => s.number === activeSeason) ?? { number: activeSeason }), status: autoStatus, episodes },
    ];
    autosave({ seasons: updated }, `Season ${activeSeason} saved`, () => {
      trackEvent('season_progress_saved');
    });
    setEpSheet(null);
  }

  function saveSeasonRating() {
    if (!seasonRatingModal) return;
    const { num, rating } = seasonRatingModal;
    const saved = getSeasonsArray();
    const existing = saved.find(s => s.number === num);
    const today = new Date().toISOString().split('T')[0];
    const updated: Season[] = [
      ...saved.filter(s => s.number !== num),
      { ...existing, number: num, status: existing?.status ?? 'watched', dateWatched: existing ? existing.dateWatched : today, rating: rating || null },
    ];
    autosave({ seasons: updated }, `Season ${num} rated`, () => {
      trackEvent(existing ? 'season_progress_saved' : 'season_completed');
    });
    setSeasonRatingModal(null);
  }

  async function doDelete() {
    try {
      await deleteEntry.mutateAsync({ id: Number(id) });
      trackEvent('entry_deleted');
      if (persistedStatusRef.current === 'plan_to_watch') {
        trackEvent('watchlist_item_removed');
      }
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey({}) });
      if (identity.tmdbId && entry) {
        void queryClient.invalidateQueries({ queryKey: getGetCommunityRatingsQueryKey(entry.type === 'movie' ? 'movie' : 'show', identity.tmdbId) });
        if (entry.type === 'show') void queryClient.invalidateQueries({ queryKey: getGetShowSeasonCommunityRatingsQueryKey(identity.tmdbId) });
      }
      router.back();
    } catch { Alert.alert('Error', 'Failed to delete entry.'); }
  }

  function confirmDelete() {
    Alert.alert('Delete entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (isLoading || !entry) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.darkPurple} />
      </View>
    );
  }

  const topPad = insets.top + 12;
  // These sheets are standalone modals, so they need home-indicator clearance
  // rather than the floating tab bar's clearance.
  const sheetBottomPadding = (Platform.OS === 'web' ? 34 : insets.bottom) + 20;
  const savedSeasons = getSeasonsArray();
  const tmdbSeasonsList = tmdbSeasons.filter(s => s.number > 0);
  const watchedNums = new Set(savedSeasons.filter(s => s.status === 'watched').map(s => s.number));

  const activeEps = epSheet
    ? (epSheet.bySeasonEdits[epSheet.activeSeason] ?? epSheet.bySeasonLoaded[epSheet.activeSeason] ?? [])
    : [];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.headerSide} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Details</Text>
        <View style={styles.headerActions}>
          <ShareTitleButton background={colors.muted} color={colors.foreground} title={{ title: entry.title, type: entry.type, year: entry.year, tmdbId: identity.tmdbId }} />
          <TouchableOpacity
            style={[styles.trashButton, { backgroundColor: colors.muted }]}
            onPress={confirmDelete}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>

        {/* ── A) Hero ── */}
        <View style={styles.heroRow}>
          <View>
            {entry.posterUrl
              ? <Image source={{ uri: entry.posterUrl }} style={styles.poster} resizeMode="cover" />
              : <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: colors.muted }]}><Feather name="film" size={32} color={colors.mutedForeground} /></View>}
            {omdbRatings?.rtScore && (
              <View style={styles.rtBadge}><Text style={styles.rtText}>RT {omdbRatings.rtScore}</Text></View>
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text style={[styles.entryTitle, { color: colors.foreground }]} numberOfLines={3}>{entry.title}</Text>
            {entry.year != null && <Text style={[styles.yearText, { color: colors.mutedForeground }]}>{entry.year}</Text>}
            <View style={[styles.statusBadge, {
              backgroundColor: localStatus === 'completed'
                ? colors.darkPurple
                : localStatus === 'watching'
                  ? colors.brightBlue
                  : colors.muted,
            }]}>
              <Text style={[styles.statusBadgeText, {
                color: localStatus === 'completed' || localStatus === 'watching'
                  ? colors.primaryForeground
                  : colors.mutedForeground,
              }]}>
                {localStatus === 'completed' ? 'Watched' : localStatus === 'watching' ? 'Watching' : 'Watchlist'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── B) Status chips — no emojis ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>STATUS</Text>
          <View style={styles.chipsRow}>
            {STATUS_OPTIONS.map(opt => {
              const active = localStatus === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                   style={[styles.statusChip, {
                     backgroundColor: active
                       ? opt.value === 'watching' ? colors.brightBlue : colors.darkPurple
                       : colors.muted,
                     borderColor: active
                       ? opt.value === 'watching' ? colors.brightBlue : colors.darkPurple
                       : colors.border,
                   }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    const previousStatus = persistedStatusRef.current;
                    setLocalStatus(opt.value);
                    autosave({ status: opt.value }, 'Status updated', () => {
                      if (previousStatus === opt.value) return;
                      if (opt.value === 'completed') {
                        trackEvent('title_completed');
                      } else if (
                        previousStatus === 'plan_to_watch' &&
                        opt.value === 'watching'
                      ) {
                        trackEvent('watchlist_item_started');
                      }
                      persistedStatusRef.current = opt.value;
                    });
                  }}
                >
                   <Text style={[styles.statusChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── C) Rating ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{entry.type === 'movie' ? 'YOUR RATING' : 'YOUR OVERALL SHOW RATING'}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star}
                onPress={() => {
                  Haptics.selectionAsync();
                  const r = localRating === star ? 0 : star;
                  setLocalRating(r);
                  autosave({ rating: r || null }, 'Rating saved', () => {
                    trackEvent('rating_saved', { rating: r, cleared: r === 0 });
                  });
                }}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <FontAwesome
                  name="star"
                  size={23}
                  color={star <= localRating ? '#FFD34D' : colors.mutedForeground}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── D) Date watched — month + year ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATE WATCHED</Text>
          <View style={[styles.dateRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="calendar" size={16} color={colors.mutedForeground} />
            <TouchableOpacity style={{ flex: 1 }} onPress={openDatePicker}>
              <Text style={[styles.dateText, { color: localDate ? colors.foreground : colors.mutedForeground }]}>
                {localDate ? formatMonthYear(localDate) : 'Tap to set month & year'}
              </Text>
            </TouchableOpacity>
            {localDate ? (
              <TouchableOpacity onPress={clearDate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={14} color="#e53e3e" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={openDatePicker} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── E) Plot ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PUBLIC RATING</Text>
          {tmdbLoading ? (
            <ActivityIndicator size="small" color={colors.darkPurple} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Text style={[styles.publicRatingText, { color: colors.foreground }]}>
              {tmdbDetail?.voteAverage != null ? `${tmdbDetail.voteAverage.toFixed(1)} / 10` : 'Not rated yet'}
            </Text>
          )}
          <Text style={[styles.ratingSource, { color: colors.mutedForeground }]}>The Movie Database (TMDB)</Text>
        </View>

        {/* ── F) Plot ── */}
        {(() => {
          const plot = tmdbDetail?.overview || entry.synopsis;
          if (!plot && !tmdbLoading) return null;
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PLOT SUMMARY</Text>
              {tmdbLoading && !plot
                ? <ActivityIndicator size="small" color={colors.darkPurple} style={{ alignSelf: 'flex-start' }} />
                : <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>{plot}</Text>}
            </View>
          );
        })()}

        {/* ── G) Cast ── */}
        {(tmdbLoading || (tmdbDetail && tmdbDetail.cast.length > 0)) && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CAST</Text>
            {tmdbLoading && !tmdbDetail
              ? <ActivityIndicator size="small" color={colors.darkPurple} style={{ alignSelf: 'flex-start' }} />
              : (
                <FlatList
                  data={tmdbDetail?.cast ?? []}
                  keyExtractor={(item, i) => `${item.name}-${i}`}
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.castList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.castCard}
                      disabled={!item.personId}
                      onPress={() => item.personId
                        ? Linking.openURL(`https://www.themoviedb.org/person/${item.personId}`).catch(() => {})
                        : undefined}
                      accessibilityRole={item.personId ? 'link' : undefined}
                      accessibilityLabel={item.personId ? `Open ${item.name}'s profile` : item.name}
                    >
                      {item.profileUrl
                        ? <Image source={{ uri: item.profileUrl }} style={[styles.castPhoto, { backgroundColor: colors.muted }]} resizeMode="cover" />
                        : <View style={[styles.castPhoto, styles.castPhotoPlaceholder, { backgroundColor: colors.muted }]}><Feather name="user" size={22} color={colors.mutedForeground} /></View>}
                      <Text style={[styles.castName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
                      {item.character ? <Text style={[styles.castCharacter, { color: colors.mutedForeground }]} numberOfLines={2}>{item.character}</Text> : null}
                    </TouchableOpacity>
                  )}
                />
              )}
          </View>
        )}

        {/* ── H) Director ── */}
        {tmdbDetail && tmdbDetail.directors.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DIRECTOR</Text>
            <View style={styles.directorRow}>
              {tmdbDetail.directors.map((d, i) => (
                <Text key={i} style={[styles.directorName, { color: colors.foreground }]}>{d.name}</Text>
              ))}
            </View>
          </View>
        )}

        {/* ── I) Seasons — poster cards ── */}
        {entry.type === 'show' && tmdbSeasonsList.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SEASONS</Text>
            </View>
            <View style={[styles.seasonsContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
              {tmdbSeasonsList.map((season, idx) => {
                const sd = savedSeasons.find(s => s.number === season.number);
                const isWatched = watchedNums.has(season.number);
                const epList = sd?.episodes ?? [];
                const epWatched = epList.filter(e => e.watched).length;
                const epTotal = epList.length;
                return (
                  <View
                    key={season.number}
                    style={[styles.seasonCard, idx < tmdbSeasonsList.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  >
                    <TouchableOpacity
                      style={styles.seasonCardMain}
                      onPress={() => { Haptics.selectionAsync(); openEpisodeSheet(season.number); }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`View episodes for ${season.number === 0 ? 'Specials' : `Season ${season.number}`}`}
                    >
                    {/* Season poster */}
                    <View style={[styles.seasonPoster, { backgroundColor: colors.muted }]}>
                      {season.posterUrl
                        ? <Image source={{ uri: season.posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        : <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Manrope_600SemiBold' }}>S{season.number}</Text>}
                    </View>
                    {/* Season info */}
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.seasonName, { color: colors.foreground }]}>
                        {season.number === 0 ? 'Specials' : `Season ${season.number}`}
                      </Text>
                      <Text style={[styles.seasonMeta, { color: colors.mutedForeground }]}>
                        {season.episodeCount} episode{season.episodeCount !== 1 ? 's' : ''}
                        {season.airYear ? ` · ${season.airYear}` : ''}
                      </Text>
                      {identity.tmdbId ? <SeasonCommunitySummary tmdbId={identity.tmdbId} seasonNumber={season.number} /> : null}
                      {epTotal > 0 && (
                        <View style={styles.miniProgressRow}>
                           <View style={[styles.miniProgressTrack, { backgroundColor: colors.muted }]}>
                             <View style={[styles.miniProgressFill, { backgroundColor: colors.darkPurple, width: `${Math.round(epWatched / epTotal * 100)}%` as any }]} />
                          </View>
                           <Text style={[styles.miniProgressText, { color: colors.darkPurple }]}>{epWatched}/{epTotal}</Text>
                        </View>
                      )}
                       <Text style={[styles.viewEpisodes, { color: colors.darkPurple }]}>
                         {isWatched ? 'Watched' : 'View episodes'}
                      </Text>
                    </View>
                    </TouchableOpacity>
                    {/* Season star rating */}
                    <View style={styles.seasonCardActions}>
                      {isWatched && season.number >= 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSeasonRatingModal({ num: season.number, rating: sd?.rating ?? 0 });
                          }}
                          style={styles.miniStars}
                          accessibilityRole="button"
                          accessibilityLabel={`Rate Season ${season.number}`}
                          testID={`season-rating-open-${season.number}`}
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        >
                          {[1,2,3,4,5].map(star => (
                             <FontAwesome
                               key={star}
                               name="star"
                               size={11}
                               color={star <= (sd?.rating ?? 0) ? '#FFD34D' : colors.mutedForeground}
                             />
                          ))}
                        </TouchableOpacity>
                      )}
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── J) Where to Watch ── */}
        {entry.tmdbId && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WHERE TO WATCH</Text>
            {providersLoading
              ? <ActivityIndicator size="small" color={colors.darkPurple} style={{ alignSelf: 'flex-start' }} />
              : watchProviders && watchProviders.streaming.length > 0 ? (
                <View style={styles.providersRow}>
                  {dedupeProviders(watchProviders.streaming).map(p => (
                    <Image key={p.providerId} source={{ uri: p.logoUrl }} style={styles.providerLogo} />
                  ))}
                </View>
              ) : watchProviders && (watchProviders.rent.length > 0 || watchProviders.buy.length > 0) ? (
                <>
                  <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>Available to rent/buy</Text>
                  <View style={styles.providersRow}>
                    {dedupeProviders([...watchProviders.rent, ...watchProviders.buy]).map(p => (
                      <Image key={p.providerId} source={{ uri: p.logoUrl }} style={[styles.providerLogo, { opacity: 0.7 }]} />
                    ))}
                  </View>
                </>
              ) : (
                <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>Not available to stream right now</Text>
              )}
          </View>
        )}

        {/* ── K) Recommendations ── */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YOU MAY ALSO LIKE</Text>
            </View>
            <FlatList
              data={recommendations.slice(0, 12)}
              keyExtractor={item => String(item.tmdbId)}
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.recCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRecommendationItem(item as TmdbItem);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Open details for ${item.title}`}
                >
                  {item.posterUrl
                    ? <Image source={{ uri: item.posterUrl }} style={styles.recPoster} resizeMode="cover" />
                    : <View style={[styles.recPoster, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.mutedForeground, fontSize: 20 }}>{item.title[0]}</Text></View>}
                  <Text style={[styles.recTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
                  {item.year && <Text style={[styles.recYear, { color: colors.mutedForeground }]}>{item.year}</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Community ratings (anonymous) ── */}
        <CommunityRatings
          type={entry.type}
          tmdbId={identity.tmdbId}
          resolving={identity.resolving}
          refreshKey={ratingSavedTick}
          tone="light"
          label={entry.type === 'show' ? 'Spud Community Rating — Entire Series (All Seasons)' : 'SPUD COMMUNITY RATING'}
        />

      </ScrollView>

      {recommendationItem && (
        <QuickLogSheet
          item={recommendationItem}
          visible
          onClose={() => setRecommendationItem(null)}
          onSaved={() => setRecommendationItem(null)}
          insets={{ bottom: insets.bottom }}
          source="entry_detail_recommendation"
        />
      )}

      {/* ── Date picker modal ── */}
      <Modal visible={dateModalOpen} transparent animationType="slide" onRequestClose={() => setDateModalOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setDateModalOpen(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: sheetBottomPadding }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Date Watched</Text>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>MONTH</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity key={m}
                  style={[styles.monthChip, { backgroundColor: pickedMonth === i ? colors.darkPurple : colors.muted }]}
                onPress={() => setPickedMonth(i)}>
                <Text style={{ color: pickedMonth === i ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 13 }}>{m.slice(0, 3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>YEAR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {YEARS.map(y => (
              <TouchableOpacity key={y}
                style={[styles.monthChip, { backgroundColor: pickedYear === y ? colors.darkPurple : colors.muted }]}
                onPress={() => setPickedYear(y)}>
                <Text style={{ color: pickedYear === y ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 13 }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setDateModalOpen(false)}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalSave, { backgroundColor: colors.darkPurple }]} onPress={confirmDate}>
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>
                {MONTHS[pickedMonth]} {pickedYear}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Episode sheet ── */}
      <Modal visible={!!epSheet} transparent animationType="slide" onRequestClose={() => setEpSheet(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEpSheet(null)} />
        {epSheet && (
          <View style={[styles.episodeSheet, { backgroundColor: colors.background, paddingBottom: sheetBottomPadding }]}>
            <View style={styles.modalHandle} />

            {/* ── Sticky header: close | title | save ── */}
            <View style={styles.sheetHeader}>
              {/* Close — always reachable */}
              <TouchableOpacity
                onPress={() => setEpSheet(null)}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                style={[styles.sheetCloseBtn, { backgroundColor: colors.muted }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </TouchableOpacity>

              <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 0, flex: 1, textAlign: 'center' }]}>
                Season Progress
              </Text>

              {/* Save — always reachable */}
              <TouchableOpacity
                onPress={saveEpisodes}
                disabled={updateEntry.isPending}
                style={[styles.sheetSaveBtn, { backgroundColor: colors.darkPurple, opacity: updateEntry.isPending ? 0.6 : 1 }]}
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>
                  {updateEntry.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

              {/* Season tabs with poster thumbnails */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
              {epSheet.seasonNums.map(num => (
                <TouchableOpacity key={num}
                  style={[styles.seasonTab, { backgroundColor: epSheet.activeSeason === num ? colors.darkPurple : colors.muted }]}
                  onPress={() => switchEpSeason(num)}>
                    {tmdbSeasonsList.find(s => s.number === num)?.posterUrl ? (
                      <Image
                        source={{ uri: tmdbSeasonsList.find(s => s.number === num)?.posterUrl ?? undefined }}
                        style={styles.seasonTabPoster}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.seasonTabPoster, { backgroundColor: colors.border }]} />
                    )}
                    <Text style={{ color: epSheet.activeSeason === num ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 12 }}>Season {num}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {identity.tmdbId ? <SeasonCommunityChart tmdbId={identity.tmdbId} seasonNumber={epSheet.activeSeason} /> : null}

            {/* Episode list */}
            {epSheet.loading[epSheet.activeSeason]
              ? <ActivityIndicator size="large" color={colors.darkPurple} style={{ margin: 24 }} />
              : activeEps.length === 0
                ? <Text style={[styles.synopsisText, { color: colors.mutedForeground, textAlign: 'center', margin: 24 }]}>No episode data available</Text>
                : (
                  <ScrollView style={styles.epList} showsVerticalScrollIndicator={true}>
                    {activeEps.map(ep => (
                      <TouchableOpacity
                        key={ep.number}
                        style={[styles.epRow, {
                          backgroundColor: ep.watched ? `${colors.darkPurple}14` : colors.card,
                          borderColor: ep.watched ? `${colors.darkPurple}44` : colors.border,
                        }]}
                        onPress={() => { Haptics.selectionAsync(); toggleEpisode(ep.number); }}
                        activeOpacity={0.7}
                      >
                        {/* Episode still */}
                        <View style={[styles.epStill, { backgroundColor: colors.muted }]}>
                          {ep.stillUrl
                            ? <Image source={{ uri: ep.stillUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            : <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Manrope_600SemiBold' }}>E{ep.number}</Text>}
                        </View>
                        {/* Info */}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.epTitle, { color: ep.watched ? colors.darkPurple : colors.foreground }]} numberOfLines={2}>
                            S{String(epSheet.activeSeason).padStart(2,'0')}E{String(ep.number).padStart(2,'0')}{ep.title ? ` · ${ep.title}` : ''}
                          </Text>
                          {(ep.airDate || ep.runtime) && (
                            <Text style={[styles.epDate, { color: colors.mutedForeground }]}>
                              {ep.airDate ?? ''}{ep.airDate && ep.runtime ? ' · ' : ''}{ep.runtime ? `${ep.runtime} min` : ''}
                            </Text>
                          )}
                          {ep.overview ? (
                            <Text style={[styles.epOverview, { color: colors.mutedForeground }]} numberOfLines={2}>{ep.overview}</Text>
                          ) : null}
                        </View>
                        {/* Checkbox */}
                        <View style={[styles.epCheck, { backgroundColor: ep.watched ? colors.darkPurple : colors.muted }]}>
                          {ep.watched && <Feather name="check" size={12} color={colors.primaryForeground} />}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
          </View>
        )}
      </Modal>

      {/* ── Season rating modal ── */}
      <Modal visible={!!seasonRatingModal} transparent animationType="slide" onRequestClose={() => setSeasonRatingModal(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSeasonRatingModal(null)} />
        {seasonRatingModal && (
          <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: sheetBottomPadding }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Your rating · Season {seasonRatingModal.num}</Text>
            {identity.tmdbId ? <SeasonCommunityChart tmdbId={identity.tmdbId} seasonNumber={seasonRatingModal.num} /> : null}
            <View style={[styles.starsRow, { marginBottom: 20 }]}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star}
                  onPress={() => setSeasonRatingModal(s => s ? { ...s, rating: s.rating === star ? 0 : star } : s)}>
                  <FontAwesome
                    name="star"
                    size={25}
                    color={star <= seasonRatingModal.rating ? '#FFD34D' : colors.mutedForeground}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setSeasonRatingModal(null)}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, { backgroundColor: colors.darkPurple }]} onPress={saveSeasonRating}>
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const POSTER_W = 110;
const POSTER_H = 165;

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerSide: { width: 48, alignItems: 'flex-start', justifyContent: 'center' },
  headerActions: { width: 128, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Manrope_600SemiBold' },
  trashButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },

  heroRow: { flexDirection: 'row', gap: 16 },
  poster: { width: POSTER_W, height: POSTER_H, borderRadius: 10 },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroInfo: { flex: 1, gap: 8, paddingTop: 4 },
  entryTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', lineHeight: 24 },
  yearText: { fontSize: 13, fontFamily: 'Manrope_400Regular' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusBadgeText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
  rtBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  rtText: { color: '#ffffff', fontSize: 10, fontFamily: 'Manrope_600SemiBold' },

  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  starsRow: { flexDirection: 'row', gap: 4 },

  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  statusChipText: { fontSize: 13, fontFamily: 'Manrope_500Medium' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  dateText: { fontSize: 14, fontFamily: 'Manrope_400Regular' },

  synopsisText: { fontSize: 14, fontFamily: 'Manrope_400Regular', lineHeight: 21 },

  castList: { gap: 14, paddingVertical: 4 },
  castCard: { width: 80, alignItems: 'center', gap: 6 },
  castPhoto: { width: 64, height: 64, borderRadius: 32 },
  castPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  castName: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', textAlign: 'center', lineHeight: 16 },
  castCharacter: { fontSize: 11, fontFamily: 'Manrope_400Regular', textAlign: 'center', lineHeight: 15 },
  publicRatingText: { fontSize: 21, lineHeight: 27, fontFamily: 'Manrope_700Bold' },
  ratingSource: { fontSize: 11, fontFamily: 'Manrope_400Regular' },

  directorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  directorName: { fontSize: 14, fontFamily: 'Manrope_500Medium' },

  // Season cards
  seasonsContainer: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  seasonCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  seasonCardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  seasonCardActions: { alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  seasonPoster: { width: 50, height: 75, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  seasonName: { fontSize: 14, fontFamily: 'Manrope_700Bold' },
  seasonMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
  viewEpisodes: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
  miniProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniProgressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  miniProgressFill: { height: '100%', borderRadius: 2 },
  miniProgressText: { fontSize: 10, fontFamily: 'Manrope_600SemiBold', minWidth: 30 },
  miniStars: { flexDirection: 'row', gap: 2 },

  // Watch providers
  providersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerLogo: { width: 40, height: 40, borderRadius: 10 },

  // Recommendations
  recCard: { width: 90, gap: 6 },
  recPoster: { width: 90, height: 135, borderRadius: 10 },
  recTitle: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', lineHeight: 15 },
  recYear: { fontSize: 10, fontFamily: 'Manrope_400Regular' },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '85%' },
  episodeSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '88%', flex: 1 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D4C9BC', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sheetCloseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheetSaveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  modalSave: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },

  // Month/year picker
  monthChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },

  // Season tabs in episode sheet
  seasonTab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  seasonTabPoster: { width: 34, height: 50, borderRadius: 7, overflow: 'hidden' },

  // Episode list
  epList: { flex: 1, marginBottom: 8 },
  epRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 6 },
  epStill: { width: 96, height: 54, borderRadius: 7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  epTitle: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', lineHeight: 17 },
  epDate: { fontSize: 10, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  epOverview: { fontSize: 10, fontFamily: 'Manrope_400Regular', marginTop: 2, lineHeight: 14 },
  epCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

});
