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
  Share,
  FlatList,
  ActionSheetIOS,
  Animated,
  Modal,
} from 'react-native';
import { Paths, downloadAsync as fsDownload } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, router, Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface CastMember { name: string; character: string; profileUrl: string | null; order: number }
interface TmdbDirector { name: string; job: string; profileUrl: string | null }
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

function getApiBase() { return process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : ''; }

function formatMonthYear(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  // ── Success banner ────────────────────────────────────────────────────────────
  const bannerY = useRef(new Animated.Value(-60)).current;
  const [bannerMsg, setBannerMsg] = useState('');

  function showSuccess(msg: string) {
    setBannerMsg(msg);
    Animated.sequence([
      Animated.timing(bannerY, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(bannerY, { toValue: -60, duration: 280, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Local state ───────────────────────────────────────────────────────────────
  const [localRating, setLocalRating] = useState(0);
  const [localStatus, setLocalStatus] = useState<Status>('completed');
  const [localDate, setLocalDate] = useState(''); // stored YYYY-MM-01
  const [instagramAvailable, setInstagramAvailable] = useState(false);

  // Date picker modal
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [pickedMonth, setPickedMonth] = useState(new Date().getMonth()); // 0-indexed
  const [pickedYear, setPickedYear] = useState(new Date().getFullYear());

  // Episode sheet
  const [epSheet, setEpSheet] = useState<EpSheetState | null>(null);
  // Season rating modal
  const [seasonRatingModal, setSeasonRatingModal] = useState<{ num: number; rating: number } | null>(null);

  useEffect(() => {
    if (entry) {
      setLocalRating(entry.rating ?? 0);
      setLocalStatus((entry.status ?? 'completed') as Status);
      setLocalDate(entry.dateWatched ?? '');
    }
  }, [entry]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      import('react-native').then(({ Linking }) =>
        Linking.canOpenURL('instagram://app').then(setInstagramAvailable).catch(() => setInstagramAvailable(false))
      );
    } else {
      setInstagramAvailable(true);
    }
  }, []);

  // ── Autosave ──────────────────────────────────────────────────────────────────
  function autosave(patch: object, successText: string) {
    updateEntry.mutate(
      { id: Number(id), data: patch as any },
      {
        onSuccess: () => {
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
    autosave({ seasons: updated }, `Season ${activeSeason} saved`);
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
      { number: num, status: 'watched', dateWatched: existing?.dateWatched ?? today, rating: rating || null, notes: null, episodes: existing?.episodes },
    ];
    autosave({ seasons: updated }, `Season ${num} rated`);
    setSeasonRatingModal(null);
  }

  // ── Share ─────────────────────────────────────────────────────────────────────
  async function handleShareText() {
    if (!entry) return;
    const yearText = entry.year ? ` (${entry.year})` : '';
    const ratingText = entry.rating ? ` ${'⭐'.repeat(entry.rating)}` : '';
    const actionText = entry.status === 'watching' ? 'watching' : entry.status === 'plan_to_watch' ? 'planning to watch' : 'watched';
    try { await Share.share({ message: `I just ${actionText} "${entry.title}"${yearText}${ratingText}\n\nTracked on CouchPotato 🥔`, title: entry.title }); } catch {}
  }

  async function handleShareInstagram() {
    if (!entry?.posterUrl) return;
    try {
      const tmpPath = Paths.join(Paths.cache, `poster-${entry.id}.jpg`);
      const { status } = await fsDownload(entry.posterUrl, tmpPath);
      if (status !== 200) throw new Error('Download failed');
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert('Not supported', 'Sharing is not available.'); return; }
      await Sharing.shareAsync(tmpPath, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Share poster' });
    } catch { Alert.alert('Error', 'Could not load the poster.'); }
  }

  function handleShare() {
    if (!entry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const hasPoster = !!entry.posterUrl;
    const showIG = hasPoster && instagramAvailable;
    if (Platform.OS === 'ios') {
      const opts = ['Cancel', 'Share text'];
      if (showIG) opts.push('Share to Instagram Stories');
      ActionSheetIOS.showActionSheetWithOptions({ options: opts, cancelButtonIndex: 0 }, idx => {
        if (idx === 1) handleShareText();
        else if (idx === 2 && showIG) handleShareInstagram();
      });
    } else {
      const buttons: any[] = [{ text: 'Share text', onPress: handleShareText }];
      if (showIG) buttons.push({ text: 'Share to Instagram', onPress: handleShareInstagram });
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Share', undefined, buttons);
    }
  }

  async function doDelete() {
    try {
      await deleteEntry.mutateAsync({ id: Number(id) });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey({}) });
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const topPad = insets.top + 12;
  const savedSeasons = getSeasonsArray();
  const tmdbSeasonsList = tmdbSeasons.filter(s => s.number > 0);
  const watchedNums = new Set(savedSeasons.filter(s => s.status === 'watched').map(s => s.number));

  const activeEps = epSheet
    ? (epSheet.bySeasonEdits[epSheet.activeSeason] ?? epSheet.bySeasonLoaded[epSheet.activeSeason] ?? [])
    : [];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Success Banner ── */}
      <Animated.View style={[styles.successBanner, { transform: [{ translateY: bannerY }], top: insets.top }]} pointerEvents="none">
        <Feather name="check-circle" size={18} color="#ffffff" />
        <Text style={styles.successText}>Success — {bannerMsg}</Text>
      </Animated.View>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.headerSide} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="share-2" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="trash-2" size={20} color="#e53e3e" />
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
              <View style={styles.rtBadge}><Text style={styles.rtText}>🍅 {omdbRatings.rtScore}</Text></View>
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text style={[styles.entryTitle, { color: colors.foreground }]} numberOfLines={3}>{entry.title}</Text>
            {entry.year != null && <Text style={[styles.yearText, { color: colors.mutedForeground }]}>{entry.year}</Text>}
            {omdbRatings?.imdbRating && (
              <View style={styles.imdbBadge}><Text style={styles.imdbText}>⭐ IMDB {omdbRatings.imdbRating}</Text></View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: localStatus === 'completed' ? colors.primary : localStatus === 'watching' ? '#9BD6FF' : colors.muted }]}>
              <Text style={[styles.statusBadgeText, { color: localStatus === 'completed' ? colors.primaryForeground : localStatus === 'watching' ? '#116149' : colors.mutedForeground }]}>
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
                  style={[styles.statusChip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]}
                  onPress={() => { Haptics.selectionAsync(); setLocalStatus(opt.value); autosave({ status: opt.value }, 'Status updated'); }}
                >
                  <Text style={[styles.statusChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── C) Rating ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YOUR RATING</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star}
                onPress={() => { Haptics.selectionAsync(); const r = localRating === star ? 0 : star; setLocalRating(r); autosave({ rating: r || null }, 'Rating saved'); }}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Feather name="star" size={28} color={star <= localRating ? colors.primary : colors.border} style={styles.starIcon} />
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
        {(() => {
          const plot = tmdbDetail?.overview || entry.synopsis;
          if (!plot && !tmdbLoading) return null;
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PLOT SUMMARY</Text>
              {tmdbLoading && !plot
                ? <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
                : <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>{plot}</Text>}
            </View>
          );
        })()}

        {/* ── F) Cast ── */}
        {(tmdbLoading || (tmdbDetail && tmdbDetail.cast.length > 0)) && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CAST</Text>
            {tmdbLoading && !tmdbDetail
              ? <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
              : (
                <FlatList
                  data={tmdbDetail?.cast ?? []}
                  keyExtractor={(item, i) => `${item.name}-${i}`}
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.castList}
                  renderItem={({ item }) => (
                    <View style={styles.castCard}>
                      {item.profileUrl
                        ? <Image source={{ uri: item.profileUrl }} style={[styles.castPhoto, { backgroundColor: colors.muted }]} resizeMode="cover" />
                        : <View style={[styles.castPhoto, styles.castPhotoPlaceholder, { backgroundColor: colors.muted }]}><Feather name="user" size={22} color={colors.mutedForeground} /></View>}
                      <Text style={[styles.castName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
                      {item.character ? <Text style={[styles.castCharacter, { color: colors.mutedForeground }]} numberOfLines={2}>{item.character}</Text> : null}
                    </View>
                  )}
                />
              )}
          </View>
        )}

        {/* ── G) Director / Creator ── */}
        {tmdbDetail && tmdbDetail.directors.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{entry.type === 'movie' ? 'DIRECTOR' : 'CREATOR'}</Text>
            <View style={styles.directorRow}>
              {tmdbDetail.directors.map((d, i) => (
                <Text key={i} style={[styles.directorName, { color: colors.foreground }]}>{d.name}</Text>
              ))}
            </View>
          </View>
        )}

        {/* ── H) Seasons — poster cards ── */}
        {entry.type === 'show' && tmdbSeasonsList.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SEASONS</Text>
              <Text style={[styles.sectionBadge, { color: colors.primary }]}>
                {watchedNums.size}/{tmdbSeasonsList.length} watched
              </Text>
            </View>
            <View style={[styles.seasonsContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
              {tmdbSeasonsList.map((season, idx) => {
                const sd = savedSeasons.find(s => s.number === season.number);
                const isWatched = watchedNums.has(season.number);
                const epList = sd?.episodes ?? [];
                const epWatched = epList.filter(e => e.watched).length;
                const epTotal = epList.length;
                return (
                  <TouchableOpacity
                    key={season.number}
                    style={[styles.seasonCard, idx < tmdbSeasonsList.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                    onPress={() => { Haptics.selectionAsync(); openEpisodeSheet(season.number); }}
                    activeOpacity={0.7}
                  >
                    {/* Season poster */}
                    <View style={[styles.seasonPoster, { backgroundColor: colors.muted }]}>
                      {season.posterUrl
                        ? <Image source={{ uri: season.posterUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        : <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Manrope_600SemiBold' }}>S{season.number}</Text>}
                    </View>
                    {/* Season info */}
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.seasonName, { color: colors.foreground }]}>{season.name}</Text>
                      <Text style={[styles.seasonMeta, { color: colors.mutedForeground }]}>
                        {season.episodeCount} episode{season.episodeCount !== 1 ? 's' : ''}
                        {season.airYear ? ` · ${season.airYear}` : ''}
                      </Text>
                      {epTotal > 0 && (
                        <View style={styles.miniProgressRow}>
                          <View style={[styles.miniProgressTrack, { backgroundColor: colors.muted }]}>
                            <View style={[styles.miniProgressFill, { backgroundColor: colors.primary, width: `${Math.round(epWatched / epTotal * 100)}%` as any }]} />
                          </View>
                          <Text style={[styles.miniProgressText, { color: colors.primary }]}>{epWatched}/{epTotal}</Text>
                        </View>
                      )}
                      <Text style={[styles.viewEpisodes, { color: isWatched ? colors.primary : '#4A78FF' }]}>
                        {isWatched ? 'Watched ✓' : 'View episodes →'}
                      </Text>
                    </View>
                    {/* Season star rating */}
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {isWatched && (
                        <TouchableOpacity onPress={e => { openEpisodeSheet(season.number); }} style={styles.miniStars}>
                          {[1,2,3,4,5].map(star => (
                            <Text key={star} style={{ fontSize: 10, color: star <= (sd?.rating ?? 0) ? '#FFD34D' : colors.border }}>★</Text>
                          ))}
                        </TouchableOpacity>
                      )}
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── I) Where to Watch ── */}
        {entry.tmdbId && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WHERE TO WATCH</Text>
            {providersLoading
              ? <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
              : watchProviders && watchProviders.streaming.length > 0 ? (
                <View style={styles.providersRow}>
                  {watchProviders.streaming.map(p => <Image key={p.providerId} source={{ uri: p.logoUrl }} style={styles.providerLogo} />)}
                </View>
              ) : watchProviders && (watchProviders.rent.length > 0 || watchProviders.buy.length > 0) ? (
                <>
                  <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>Available to rent/buy</Text>
                  <View style={styles.providersRow}>
                    {[...watchProviders.rent, ...watchProviders.buy]
                      .filter((p, i, arr) => arr.findIndex(x => x.providerId === p.providerId) === i)
                      .map(p => <Image key={p.providerId} source={{ uri: p.logoUrl }} style={[styles.providerLogo, { opacity: 0.7 }]} />)}
                  </View>
                </>
              ) : (
                <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>Not available to stream right now</Text>
              )}
          </View>
        )}

        {/* ── J) Recommendations ── */}
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
                <View style={styles.recCard}>
                  {item.posterUrl
                    ? <Image source={{ uri: item.posterUrl }} style={styles.recPoster} resizeMode="cover" />
                    : <View style={[styles.recPoster, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.mutedForeground, fontSize: 20 }}>{item.title[0]}</Text></View>}
                  <Text style={[styles.recTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
                  {item.year && <Text style={[styles.recYear, { color: colors.mutedForeground }]}>{item.year}</Text>}
                </View>
              )}
            />
          </View>
        )}

        {/* ── K) Delete ── */}
        <TouchableOpacity style={[styles.deleteButton, { borderColor: '#e53e3e' }]} onPress={confirmDelete} disabled={deleteEntry.isPending}>
          {deleteEntry.isPending ? <ActivityIndicator size="small" color="#e53e3e" /> : <Text style={styles.deleteText}>Delete entry</Text>}
        </TouchableOpacity>

      </ScrollView>

      {/* ── Date picker modal ── */}
      <Modal visible={dateModalOpen} transparent animationType="slide" onRequestClose={() => setDateModalOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setDateModalOpen(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Date Watched</Text>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>MONTH</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity key={m}
                style={[styles.monthChip, { backgroundColor: pickedMonth === i ? colors.primary : colors.muted }]}
                onPress={() => setPickedMonth(i)}>
                <Text style={{ color: pickedMonth === i ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 13 }}>{m.slice(0, 3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>YEAR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {YEARS.map(y => (
              <TouchableOpacity key={y}
                style={[styles.monthChip, { backgroundColor: pickedYear === y ? colors.primary : colors.muted }]}
                onPress={() => setPickedYear(y)}>
                <Text style={{ color: pickedYear === y ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 13 }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setDateModalOpen(false)}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalSave, { backgroundColor: colors.primary }]} onPress={confirmDate}>
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
          <View style={[styles.episodeSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 10 }]}>Season Progress</Text>

            {/* Season tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
              {epSheet.seasonNums.map(num => (
                <TouchableOpacity key={num}
                  style={[styles.seasonTab, { backgroundColor: epSheet.activeSeason === num ? colors.primary : colors.muted }]}
                  onPress={() => switchEpSeason(num)}>
                  <Text style={{ color: epSheet.activeSeason === num ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 12 }}>Season {num}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Progress bar */}
            {activeEps.length > 0 && (() => {
              const w = activeEps.filter(e => e.watched).length;
              const t = activeEps.length;
              return (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                    <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(w / t * 100)}%` as any }]} />
                  </View>
                  <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{w}/{t} eps</Text>
                </View>
              );
            })()}

            {/* Episode list */}
            {epSheet.loading[epSheet.activeSeason]
              ? <ActivityIndicator size="large" color={colors.primary} style={{ margin: 24 }} />
              : activeEps.length === 0
                ? <Text style={[styles.synopsisText, { color: colors.mutedForeground, textAlign: 'center', margin: 24 }]}>No episode data available</Text>
                : (
                  <ScrollView style={styles.epList} showsVerticalScrollIndicator={false}>
                    {activeEps.map(ep => (
                      <TouchableOpacity
                        key={ep.number}
                        style={[styles.epRow, {
                          backgroundColor: ep.watched ? `${colors.primary}14` : colors.card,
                          borderColor: ep.watched ? `${colors.primary}44` : colors.border,
                        }]}
                        onPress={() => { Haptics.selectionAsync(); toggleEpisode(ep.number); }}
                        activeOpacity={0.7}
                      >
                        {/* Episode still */}
                        <View style={[styles.epStill, { backgroundColor: colors.muted }]}>
                          {ep.stillUrl
                            ? <Image source={{ uri: ep.stillUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                            : <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Manrope_600SemiBold' }}>E{ep.number}</Text>}
                        </View>
                        {/* Info */}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.epTitle, { color: ep.watched ? colors.primary : colors.foreground }]} numberOfLines={2}>
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
                        <View style={[styles.epCheck, { backgroundColor: ep.watched ? colors.primary : colors.muted }]}>
                          {ep.watched && <Feather name="check" size={12} color={colors.primaryForeground} />}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

            {/* Footer */}
            <View style={[styles.modalActions, { marginTop: 8 }]}>
              <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setEpSheet(null)}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, { backgroundColor: colors.primary }]} onPress={saveEpisodes} disabled={updateEntry.isPending}>
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>
                  {updateEntry.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* ── Season rating modal ── */}
      <Modal visible={!!seasonRatingModal} transparent animationType="slide" onRequestClose={() => setSeasonRatingModal(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSeasonRatingModal(null)} />
        {seasonRatingModal && (
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Season {seasonRatingModal.num} — Rate</Text>
            <View style={[styles.starsRow, { marginBottom: 20 }]}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star}
                  onPress={() => setSeasonRatingModal(s => s ? { ...s, rating: s.rating === star ? 0 : star } : s)}>
                  <Text style={{ fontSize: 36, color: star <= seasonRatingModal.rating ? '#FFD34D' : colors.border }}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setSeasonRatingModal(null)}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, { backgroundColor: colors.primary }]} onPress={saveSeasonRating}>
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

  successBanner: { position: 'absolute', left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#116149' },
  successText: { color: '#ffffff', fontFamily: 'Manrope_600SemiBold', fontSize: 14, flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerSide: { width: 48, alignItems: 'flex-start', justifyContent: 'center' },
  headerActions: { width: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Manrope_600SemiBold' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },

  heroRow: { flexDirection: 'row', gap: 16 },
  poster: { width: POSTER_W, height: POSTER_H, borderRadius: 10 },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroInfo: { flex: 1, gap: 8, paddingTop: 4 },
  entryTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', lineHeight: 24 },
  yearText: { fontSize: 13, fontFamily: 'Manrope_400Regular' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
  rtBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  rtText: { color: '#ffffff', fontSize: 10, fontFamily: 'Manrope_600SemiBold' },
  imdbBadge: { backgroundColor: '#F5C518', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  imdbText: { color: '#000000', fontSize: 11, fontFamily: 'Manrope_600SemiBold' },

  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionBadge: { fontSize: 12, fontFamily: 'Manrope_500Medium' },

  starsRow: { flexDirection: 'row', gap: 4 },
  starIcon: { marginRight: 2 },

  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 13, fontFamily: 'Manrope_500Medium' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  dateText: { fontSize: 14, fontFamily: 'Manrope_400Regular' },

  synopsisText: { fontSize: 14, fontFamily: 'Manrope_400Regular', lineHeight: 21 },

  castList: { gap: 14, paddingVertical: 4 },
  castCard: { width: 80, alignItems: 'center', gap: 6 },
  castPhoto: { width: 64, height: 64, borderRadius: 32 },
  castPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  castName: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', textAlign: 'center', lineHeight: 16 },
  castCharacter: { fontSize: 11, fontFamily: 'Manrope_400Regular', textAlign: 'center', lineHeight: 15 },

  directorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  directorName: { fontSize: 14, fontFamily: 'Manrope_500Medium' },

  // Season cards
  seasonsContainer: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  seasonCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
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

  // Delete
  deleteButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: '#e53e3e' },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '60%' },
  episodeSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '88%', flex: 1 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D4C9BC', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalSave: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },

  // Month/year picker
  monthChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },

  // Season tabs in episode sheet
  seasonTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },

  // Episode list
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, fontFamily: 'Manrope_500Medium', minWidth: 50, textAlign: 'right' },
  epList: { flex: 1, marginBottom: 8 },
  epRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 6 },
  epStill: { width: 96, height: 54, borderRadius: 7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  epTitle: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', lineHeight: 17 },
  epDate: { fontSize: 10, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  epOverview: { fontSize: 10, fontFamily: 'Manrope_400Regular', marginTop: 2, lineHeight: 14 },
  epCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
