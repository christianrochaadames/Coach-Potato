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
  TextInput,
  Share,
  FlatList,
  ActionSheetIOS,
  Linking,
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
import { PLATFORMS } from '@/constants/platforms';

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

interface TmdbRec {
  tmdbId: number; title: string; type: 'movie' | 'show';
  year: number | null; posterUrl: string | null;
}

interface EpisodeData { number: number; title?: string; watched: boolean; airDate?: string | null }

interface Season {
  number: number; status: string; dateWatched?: string | null;
  rating?: number | null; notes?: string | null; episodes?: EpisodeData[];
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function getApiBase() { return process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : ''; }

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

function useSeasonCount(tmdbId: number | null | undefined, type: string | undefined) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!tmdbId || type !== 'show') { setCount(null); return; }
    const base = getApiBase(); if (!base) return;
    authFetch(`${base}/api/tmdb/show/${tmdbId}`).then(r => r.ok ? r.json() : {}).then((d: { numberOfSeasons?: number }) => setCount(d.numberOfSeasons ?? null)).catch(() => {});
  }, [tmdbId, type]);
  return count;
}

function useWatchProviders(tmdbId: number | null | undefined, type: string | undefined) {
  const [providers, setProviders] = useState<WatchProviders | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!tmdbId || !type) return;
    const base = getApiBase(); if (!base) return;
    const media = type === 'movie' ? 'movie' : 'tv';
    const url = `${base}/api/tmdb/${media}/${tmdbId}/providers?region=US`;
    setLoading(true);
    authFetch(url).then(r => r.ok ? r.json() : null).then(d => d && setProviders(d)).catch(() => {}).finally(() => setLoading(false));
  }, [tmdbId, type]);
  return { providers, loading };
}

function useOmdbRatings(title: string | undefined, year: number | null | undefined) {
  const [ratings, setRatings] = useState<OmdbRatings | null>(null);
  useEffect(() => {
    if (!title) return;
    const base = getApiBase(); if (!base) return;
    const y = year ? `&year=${year}` : '';
    authFetch(`${base}/api/omdb/ratings?title=${encodeURIComponent(title)}${y}`).then(r => r.ok ? r.json() : null).then(d => d && setRatings({ rtScore: d.rtScore, imdbRating: d.imdbRating })).catch(() => {});
  }, [title, year]);
  return ratings;
}

function useRecommendations(tmdbId: number | null | undefined, type: string | undefined) {
  const [recs, setRecs] = useState<TmdbRec[]>([]);
  useEffect(() => {
    if (!tmdbId || !type) return;
    const base = getApiBase(); if (!base) return;
    const media = type === 'movie' ? 'movie' : 'tv';
    authFetch(`${base}/api/tmdb/${media}/${tmdbId}/recommendations`).then(r => r.ok ? r.json() : null).then(d => setRecs(d?.results ?? [])).catch(() => {});
  }, [tmdbId, type]);
  return recs;
}

// ── Platform helpers ──────────────────────────────────────────────────────────

function platformColor(p: string): { bg: string; text: string } {
  if (p === 'Cinema') return { bg: '#F97316', text: '#ffffff' };
  if (p === 'DVD / Blu-ray') return { bg: '#7E7A73', text: '#ffffff' };
  return { bg: '#4A78FF', text: '#ffffff' };
}

// ── Season component ──────────────────────────────────────────────────────────

interface SeasonRowProps {
  num: number; season: Season | undefined;
  onTap: (num: number) => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  isPending: boolean;
}

function SeasonRow({ num, season, onTap, colors, isPending }: SeasonRowProps) {
  const isWatched = season?.status === 'watched';
  const epCount = season?.episodes?.length ?? 0;
  const epWatched = season?.episodes?.filter(e => e.watched).length ?? 0;
  const rating = season?.rating ?? 0;

  return (
    <TouchableOpacity
      style={[srStyles.row, { borderColor: colors.border }]}
      onPress={() => { Haptics.selectionAsync(); onTap(num); }}
      disabled={isPending}
      activeOpacity={0.7}
    >
      <View style={[srStyles.circle, { backgroundColor: isWatched ? colors.primary : colors.muted }]}>
        <Feather name={isWatched ? 'check' : 'circle'} size={14} color={isWatched ? colors.primaryForeground : colors.mutedForeground} />
      </View>
      <View style={srStyles.info}>
        <Text style={[srStyles.label, { color: isWatched ? colors.foreground : colors.mutedForeground }]}>Season {num}</Text>
        {epCount > 0 && <Text style={[srStyles.sub, { color: colors.mutedForeground }]}>{epWatched}/{epCount} episodes</Text>}
      </View>
      {isWatched && rating > 0 && (
        <Text style={{ color: '#FFD34D', fontSize: 12 }}>{'★'.repeat(rating)}</Text>
      )}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const srStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  circle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  label: { fontSize: 14, fontFamily: 'Manrope_500Medium' },
  sub: { fontSize: 11, fontFamily: 'Manrope_400Regular', marginTop: 1 },
});

// ── Status config ─────────────────────────────────────────────────────────────

type Status = 'completed' | 'watching' | 'plan_to_watch';
const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'completed', label: '✓ Watched' },
  { value: 'watching', label: '▶ Watching' },
  { value: 'plan_to_watch', label: '🔖 Watchlist' },
];

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
  const seasonCount = useSeasonCount(entry?.tmdbId, entry?.type);
  const { providers: watchProviders, loading: providersLoading } = useWatchProviders(entry?.tmdbId, entry?.type);
  const omdbRatings = useOmdbRatings(entry?.title, entry?.year);
  const recommendations = useRecommendations(entry?.tmdbId, entry?.type);

  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  // ── Success banner ───────────────────────────────────────────────────────────
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

  // ── Editable state ───────────────────────────────────────────────────────────
  const [localRating, setLocalRating] = useState(0);
  const [localStatus, setLocalStatus] = useState<Status>('completed');
  const [localNotes, setLocalNotes] = useState('');
  const [localPlatform, setLocalPlatform] = useState('');
  const [localDate, setLocalDate] = useState('');
  const [platformModalOpen, setPlatformModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [instagramAvailable, setInstagramAvailable] = useState(false);

  // Episode tracking
  const [episodeSheet, setEpisodeSheet] = useState<{
    seasonNum: number; episodes: EpisodeData[]; loading: boolean;
    seasonRating: number; seasonNote: string;
  } | null>(null);

  useEffect(() => {
    if (entry) {
      setLocalRating(entry.rating ?? 0);
      setLocalStatus((entry.status ?? 'completed') as Status);
      setLocalNotes(entry.notes ?? '');
      setLocalPlatform((entry as any).platform ?? '');
      setLocalDate(entry.dateWatched ?? '');
    }
  }, [entry]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      Linking.canOpenURL('instagram://app').then(setInstagramAvailable).catch(() => setInstagramAvailable(false));
    } else {
      setInstagramAvailable(true);
    }
  }, []);

  // ── Autosave ─────────────────────────────────────────────────────────────────
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

  // ── Season helpers ────────────────────────────────────────────────────────────
  function getSeasonsArray(): Season[] { return ((entry as any)?.seasons ?? []) as Season[]; }

  function openEpisodeSheet(num: number) {
    const seasons = getSeasonsArray();
    const existing = seasons.find(s => s.number === num);
    const existingEps = existing?.episodes ?? [];
    setEpisodeSheet({ seasonNum: num, episodes: existingEps, loading: !!entry?.tmdbId, seasonRating: existing?.rating ?? 0, seasonNote: existing?.notes ?? '' });

    if (entry?.tmdbId) {
      const base = getApiBase();
      if (!base) { setEpisodeSheet(prev => prev ? { ...prev, loading: false } : null); return; }
      authFetch(`${base}/api/tmdb/tv/${entry.tmdbId}/season/${num}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.episodes) { setEpisodeSheet(prev => prev ? { ...prev, loading: false } : null); return; }
          const fetched: EpisodeData[] = (d.episodes as any[]).map((ep: any) => {
            const prev = existingEps.find(e => e.number === ep.episode_number);
            return { number: ep.episode_number, title: ep.name, watched: prev?.watched ?? false, airDate: ep.air_date ?? null };
          });
          setEpisodeSheet(prev => prev ? { ...prev, episodes: fetched, loading: false } : null);
        })
        .catch(() => setEpisodeSheet(prev => prev ? { ...prev, loading: false } : null));
    }
  }

  function toggleEpisode(epNum: number) {
    setEpisodeSheet(prev =>
      prev ? { ...prev, episodes: prev.episodes.map(ep => ep.number === epNum ? { ...ep, watched: !ep.watched } : ep) } : null
    );
  }

  function saveEpisodes() {
    if (!episodeSheet) return;
    const { seasonNum, episodes, seasonRating, seasonNote } = episodeSheet;
    const seasons = getSeasonsArray();
    const watchedCount = episodes.filter(e => e.watched).length;
    const autoStatus: 'watched' | 'watching' = watchedCount === episodes.length && episodes.length > 0 ? 'watched' : 'watching';
    const updated: Season[] = [
      ...seasons.filter(s => s.number !== seasonNum),
      {
        ...(seasons.find(s => s.number === seasonNum) ?? { number: seasonNum }),
        status: autoStatus,
        rating: seasonRating || null,
        notes: seasonNote.trim() || null,
        episodes,
      },
    ];
    autosave({ seasons: updated }, `Season ${seasonNum} saved`);
    setEpisodeSheet(null);
  }

  // ── Share handlers ────────────────────────────────────────────────────────────
  async function handleShareText() {
    if (!entry) return;
    const yearText = entry.year ? ` (${entry.year})` : '';
    const ratingText = entry.rating ? ` ${'⭐'.repeat(entry.rating)}` : '';
    const actionText = entry.status === 'watching' ? 'watching' : entry.status === 'plan_to_watch' ? 'planning to watch' : 'watched';
    try {
      await Share.share({ message: `I just ${actionText} "${entry.title}"${yearText}${ratingText}\n\nTracked on CouchPotato 🥔`, title: entry.title });
    } catch {}
  }

  async function handleShareInstagram() {
    if (!entry?.posterUrl) return;
    try {
      const tmpPath = Paths.join(Paths.cache, `poster-${entry.id}.jpg`);
      const { status } = await fsDownload(entry.posterUrl, tmpPath);
      if (status !== 200) throw new Error('Download failed');
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert('Not supported', 'Sharing is not available.'); return; }
      await Sharing.shareAsync(tmpPath, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Share poster to Instagram Stories' });
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
      if (showIG) buttons.push({ text: 'Share to Instagram Stories', onPress: handleShareInstagram });
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Share', undefined, buttons);
    }
  }

  function handlePlatformPick() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      const opts = ['Cancel', 'Clear platform', ...PLATFORMS];
      ActionSheetIOS.showActionSheetWithOptions({ options: opts, cancelButtonIndex: 0 }, idx => {
        if (idx === 0) return;
        if (idx === 1) { setLocalPlatform(''); autosave({ platform: null }, 'Platform cleared'); return; }
        const selected = PLATFORMS[idx - 2];
        if (selected) { setLocalPlatform(selected); autosave({ platform: selected }, 'Platform saved'); }
      });
    } else {
      setPlatformModalOpen(true);
    }
  }

  function showDatePicker() {
    setDateInput(localDate);
    setDateModalOpen(true);
  }

  function confirmDate() {
    setDateModalOpen(false);
    const d = dateInput.trim();
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      Alert.alert('Invalid date', 'Please use YYYY-MM-DD format'); return;
    }
    setLocalDate(d);
    autosave({ dateWatched: d || null }, 'Date saved');
  }

  function setDateToday() {
    const today = new Date().toISOString().split('T')[0];
    setDateInput(today);
    setLocalDate(today);
    setDateModalOpen(false);
    autosave({ dateWatched: today }, 'Date saved');
  }

  async function doDelete() {
    try {
      await deleteEntry.mutateAsync({ id: Number(id) });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey({}) });
      router.back();
    } catch { Alert.alert('Error', 'Failed to delete entry. Please try again.'); }
  }

  function confirmDelete() {
    Alert.alert('Delete entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  }

  function statusBadgeStyle(status: string) {
    if (status === 'completed') return { bg: colors.primary, text: colors.primaryForeground };
    if (status === 'watching') return { bg: '#9BD6FF', text: colors.foreground };
    return { bg: colors.muted, text: colors.mutedForeground };
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
  const badge = statusBadgeStyle(localStatus);
  const seasons = getSeasonsArray();
  const totalSeasons = Math.max(seasonCount ?? 0, ...seasons.map(s => s.number), 0);
  const watchedSeasons = seasons.filter(s => s.status === 'watched').length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Success Banner ── */}
      <Animated.View
        style={[styles.successBanner, { transform: [{ translateY: bannerY }], top: insets.top }]}
        pointerEvents="none"
      >
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
            {entry.posterUrl ? (
              <Image source={{ uri: entry.posterUrl }} style={styles.poster} resizeMode="cover" />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: colors.muted }]}>
                <Feather name="film" size={32} color={colors.mutedForeground} />
              </View>
            )}
            {/* RT badge */}
            {omdbRatings?.rtScore && (
              <View style={styles.rtBadge}>
                <Text style={styles.rtText}>🍅 {omdbRatings.rtScore}</Text>
              </View>
            )}
          </View>

          <View style={styles.heroInfo}>
            <Text style={[styles.entryTitle, { color: colors.foreground }]} numberOfLines={3}>{entry.title}</Text>
            {entry.year != null && <Text style={[styles.yearText, { color: colors.mutedForeground }]}>{entry.year}</Text>}

            {/* IMDB badge */}
            {omdbRatings?.imdbRating && (
              <View style={[styles.imdbBadge]}>
                <Text style={styles.imdbText}>⭐ IMDB {omdbRatings.imdbRating}</Text>
              </View>
            )}

            {/* Current status badge */}
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                {localStatus === 'completed' ? 'Watched' : localStatus === 'watching' ? 'Watching' : 'Watchlist'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── B) Status chips — always editable ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>STATUS</Text>
          <View style={styles.chipsRow}>
            {STATUS_OPTIONS.map(opt => {
              const active = localStatus === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.statusChip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setLocalStatus(opt.value);
                    autosave({ status: opt.value }, 'Status updated');
                  }}
                >
                  <Text style={[styles.statusChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── C) Rating — always tappable ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YOUR RATING</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => {
              const filled = star <= localRating;
              return (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    Haptics.selectionAsync();
                    const newRating = localRating === star ? 0 : star;
                    setLocalRating(newRating);
                    autosave({ rating: newRating || null }, 'Rating saved');
                  }}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Feather name="star" size={28} color={filled ? colors.primary : colors.border} style={styles.starIcon} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── D) Date watched ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATE WATCHED</Text>
          <TouchableOpacity
            style={[styles.dateRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={showDatePicker}
          >
            <Feather name="calendar" size={16} color={colors.mutedForeground} />
            <Text style={[styles.dateText, { color: localDate ? colors.foreground : colors.mutedForeground }]}>
              {localDate || 'Tap to set date'}
            </Text>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* ── E) Platform / Location ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PLATFORM / LOCATION</Text>
          <TouchableOpacity
            style={[styles.dateRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handlePlatformPick}
          >
            <Feather name="monitor" size={16} color={colors.mutedForeground} />
            {localPlatform ? (
              <View style={[styles.platformPill, { backgroundColor: platformColor(localPlatform).bg }]}>
                <Text style={[styles.platformPillText, { color: platformColor(localPlatform).text }]}>
                  {localPlatform === 'Cinema' ? '🎬 ' : ''}{localPlatform}
                </Text>
              </View>
            ) : (
              <Text style={[styles.dateText, { color: colors.mutedForeground }]}>Tap to set platform</Text>
            )}
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* ── F) Notes — always editable ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTES</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={localNotes}
            onChangeText={setLocalNotes}
            onBlur={() => autosave({ notes: localNotes.trim() || null }, 'Notes saved')}
            multiline
            placeholder="Add notes…"
            placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top"
          />
        </View>

        {/* ── G) Plot summary ── */}
        {(() => {
          const plot = tmdbDetail?.overview || entry.synopsis;
          if (!plot && !tmdbLoading) return null;
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PLOT SUMMARY</Text>
              {tmdbLoading && !plot ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
              ) : (
                <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>{plot}</Text>
              )}
            </View>
          );
        })()}

        {/* ── H) Cast ── */}
        {(tmdbLoading || (tmdbDetail && tmdbDetail.cast.length > 0)) && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CAST</Text>
            {tmdbLoading && !tmdbDetail ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
            ) : (
              <FlatList
                data={tmdbDetail?.cast ?? []}
                keyExtractor={(item, i) => `${item.name}-${i}`}
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.castList}
                renderItem={({ item }) => (
                  <View style={styles.castCard}>
                    {item.profileUrl ? (
                      <Image source={{ uri: item.profileUrl }} style={[styles.castPhoto, { backgroundColor: colors.muted }]} resizeMode="cover" />
                    ) : (
                      <View style={[styles.castPhoto, styles.castPhotoPlaceholder, { backgroundColor: colors.muted }]}>
                        <Feather name="user" size={22} color={colors.mutedForeground} />
                      </View>
                    )}
                    <Text style={[styles.castName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
                    {item.character ? <Text style={[styles.castCharacter, { color: colors.mutedForeground }]} numberOfLines={2}>{item.character}</Text> : null}
                  </View>
                )}
              />
            )}
          </View>
        )}

        {/* ── I) Director ── */}
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

        {/* ── J) Season Tracker ── */}
        {entry.type === 'show' && totalSeasons > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SEASONS</Text>
              <Text style={[styles.sectionBadge, { color: colors.primary }]}>{watchedSeasons}/{totalSeasons} watched</Text>
            </View>
            <View style={[styles.seasonsContainer, { borderColor: colors.border }]}>
              {Array.from({ length: totalSeasons }, (_, i) => i + 1).map(num => (
                <SeasonRow
                  key={num}
                  num={num}
                  season={seasons.find(s => s.number === num)}
                  onTap={openEpisodeSheet}
                  colors={colors}
                  isPending={updateEntry.isPending}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── K) Where to Watch ── */}
        {entry.tmdbId && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WHERE TO WATCH</Text>
            {providersLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
            ) : watchProviders && watchProviders.streaming.length > 0 ? (
              <View style={styles.providersRow}>
                {watchProviders.streaming.map(p => (
                  <Image key={p.providerId} source={{ uri: p.logoUrl }} style={styles.providerLogo} />
                ))}
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

        {/* ── L) Recommendations ── */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YOU MAY ALSO LIKE</Text>
              <Text style={[styles.sectionBadge, { color: colors.mutedForeground }]}>{recommendations.length} titles</Text>
            </View>
            <FlatList
              data={recommendations.slice(0, 12)}
              keyExtractor={item => String(item.tmdbId)}
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
              renderItem={({ item }) => (
                <View style={styles.recCard}>
                  {item.posterUrl ? (
                    <Image source={{ uri: item.posterUrl }} style={styles.recPoster} resizeMode="cover" />
                  ) : (
                    <View style={[styles.recPoster, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 20 }}>{item.title[0]}</Text>
                    </View>
                  )}
                  <Text style={[styles.recTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
                  {item.year && <Text style={[styles.recYear, { color: colors.mutedForeground }]}>{item.year}</Text>}
                </View>
              )}
            />
          </View>
        )}

        {/* ── M) Delete ── */}
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
          <TextInput
            style={[styles.dateInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
            autoFocus
          />
          <TouchableOpacity style={[styles.todayBtn, { borderColor: colors.border }]} onPress={setDateToday}>
            <Text style={{ color: colors.primary, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>Set to today</Text>
          </TouchableOpacity>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setDateModalOpen(false)}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalSave, { backgroundColor: colors.primary }]} onPress={confirmDate}>
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Platform picker modal (Android) ── */}
      <Modal visible={platformModalOpen} transparent animationType="slide" onRequestClose={() => setPlatformModalOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPlatformModalOpen(false)} />
        <View style={[styles.platformSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Platform / Location</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => {
                const pStyle = platformColor(p);
                const active = localPlatform === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.platformChip, { backgroundColor: active ? pStyle.bg : colors.muted }]}
                    onPress={() => {
                      setLocalPlatform(p);
                      setPlatformModalOpen(false);
                      autosave({ platform: p }, 'Platform saved');
                    }}
                  >
                    <Text style={[styles.platformChipText, { color: active ? pStyle.text : colors.mutedForeground }]}>
                      {p === 'Cinema' ? '🎬 Cinema' : p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.clearPlatformBtn, { borderColor: '#e53e3e' }]}
              onPress={() => { setLocalPlatform(''); setPlatformModalOpen(false); autosave({ platform: null }, 'Platform cleared'); }}
            >
              <Text style={{ color: '#e53e3e', fontFamily: 'Manrope_600SemiBold', fontSize: 13 }}>Clear platform</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Episode tracking sheet ── */}
      <Modal visible={!!episodeSheet} transparent animationType="slide" onRequestClose={() => setEpisodeSheet(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEpisodeSheet(null)} />
        {episodeSheet && (
          <View style={[styles.episodeSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <View style={styles.epHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 0 }]}>Season {episodeSheet.seasonNum}</Text>
              <View style={styles.epStars}>
                {[1,2,3,4,5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setEpisodeSheet(prev => prev ? { ...prev, seasonRating: prev.seasonRating === star ? 0 : star } : null)}>
                    <Text style={{ fontSize: 20, color: star <= episodeSheet.seasonRating ? '#FFD34D' : colors.border }}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Progress */}
            {episodeSheet.episodes.length > 0 && (() => {
              const watched = episodeSheet.episodes.filter(e => e.watched).length;
              const total = episodeSheet.episodes.length;
              const pct = total > 0 ? watched / total : 0;
              return (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                    <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${pct * 100}%` }]} />
                  </View>
                  <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{watched}/{total} eps</Text>
                </View>
              );
            })()}

            {episodeSheet.loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ margin: 24 }} />
            ) : episodeSheet.episodes.length === 0 ? (
              <Text style={[styles.synopsisText, { color: colors.mutedForeground, textAlign: 'center', margin: 24 }]}>No episode data available</Text>
            ) : (
              <ScrollView style={styles.epList} showsVerticalScrollIndicator={false}>
                {episodeSheet.episodes.map(ep => (
                  <TouchableOpacity
                    key={ep.number}
                    style={[styles.epRow, {
                      backgroundColor: ep.watched ? `${colors.primary}14` : colors.card,
                      borderColor: ep.watched ? `${colors.primary}44` : colors.border,
                    }]}
                    onPress={() => { Haptics.selectionAsync(); toggleEpisode(ep.number); }}
                  >
                    <View style={[styles.epCheck, { backgroundColor: ep.watched ? colors.primary : colors.muted }]}>
                      {ep.watched && <Feather name="check" size={12} color={colors.primaryForeground} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.epTitle, { color: ep.watched ? colors.primary : colors.foreground }]}>
                        E{ep.number}{ep.title ? ` · ${ep.title}` : ''}
                      </Text>
                      {ep.airDate && <Text style={[styles.epDate, { color: colors.mutedForeground }]}>{ep.airDate}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setEpisodeSheet(null)}>
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

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const POSTER_W = 110;
const POSTER_H = 165;

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Success banner
  successBanner: {
    position: 'absolute', left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#116149',
  },
  successText: { color: '#ffffff', fontFamily: 'Manrope_600SemiBold', fontSize: 14, flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerSide: { width: 48, alignItems: 'flex-start', justifyContent: 'center' },
  headerActions: { width: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Manrope_600SemiBold' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },

  // Hero
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

  // Section
  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionBadge: { fontSize: 12, fontFamily: 'Manrope_500Medium' },

  // Stars
  starsRow: { flexDirection: 'row', gap: 4 },
  starIcon: { marginRight: 2 },

  // Status chips
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 13, fontFamily: 'Manrope_500Medium' },

  // Date row
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  dateText: { flex: 1, fontSize: 14, fontFamily: 'Manrope_400Regular' },

  // Platform pill
  platformPill: { flex: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  platformPillText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },

  // Notes
  notesInput: { borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 80, fontSize: 14, fontFamily: 'Manrope_400Regular', lineHeight: 21 },

  // Synopsis
  synopsisText: { fontSize: 14, fontFamily: 'Manrope_400Regular', lineHeight: 21 },

  // Cast
  castList: { gap: 14, paddingVertical: 4 },
  castCard: { width: 80, alignItems: 'center', gap: 6 },
  castPhoto: { width: 64, height: 64, borderRadius: 32 },
  castPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  castName: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', textAlign: 'center', lineHeight: 16 },
  castCharacter: { fontSize: 11, fontFamily: 'Manrope_400Regular', textAlign: 'center', lineHeight: 15 },

  // Director
  directorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  directorName: { fontSize: 14, fontFamily: 'Manrope_500Medium' },

  // Seasons
  seasonsContainer: { borderTopWidth: StyleSheet.hairlineWidth },

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
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '55%' },
  platformSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '75%' },
  episodeSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '82%', flex: 1 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D4C9BC', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', marginBottom: 16 },
  dateInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: 'Manrope_400Regular', marginBottom: 12 },
  todayBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalSave: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },

  // Platform grid
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  platformChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  platformChipText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
  clearPlatformBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },

  // Episode sheet
  epHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  epStars: { flexDirection: 'row', gap: 4 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, fontFamily: 'Manrope_500Medium', minWidth: 50, textAlign: 'right' },
  epList: { flex: 1, marginBottom: 8 },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  epCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  epTitle: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
  epDate: { fontSize: 11, fontFamily: 'Manrope_400Regular', marginTop: 2 },
});
