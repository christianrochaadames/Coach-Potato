import { getGetCommunityRatingsQueryKey, getGetShowSeasonCommunityRatingsQueryKey } from '@workspace/api-client-react';
/**
 * Search Tab — matches web app:
 * • No query → Popular TV Shows + Popular Movies sections, Refresh cycles pages
 * • Query → Debounced TMDB search results
 * • "In your collection" detection with pink highlight
 * • Info and collection sheet (synopsis / credits / providers / status)
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
  Alert,
  Animated,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateEntry, useDeleteEntry, useListEntries,
  useUpdateEntry,
  getListEntriesQueryKey,
} from '@workspace/api-client-react';
import { authFetch } from '@/utils/authFetch';
import { trackEvent } from '@/utils/analytics';
import { CommunityRatings, SeasonCommunityChart, SeasonCommunitySummary } from '@/components/CommunityRatings';
import { ShareTitleButton } from '@/components/ShareTitleButton';
import { WatchedYearRating } from '@/components/WatchedYearRating';
import { upsertSeasonProgress } from '@/utils/seasonProgress';
import { getShowTrackingMode } from '@/utils/seasonShelves';

type TrackingMode = 'whole_show' | 'seasons';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TmdbItem {
  tmdbId: number;
  title: string;
  type: 'movie' | 'show';
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
}

interface TmdbDetail {
  title: string;
  overview: string | null;
  cast: Array<{ name: string; character: string; profileUrl: string | null; personId?: number | null }>;
  directors: Array<{ name: string; job: string; profileUrl: string | null; personId?: number | null }>;
  runtime: number | null;
  releaseYear: number | null;
  voteAverage: number | null;
  genres: string[];
}

interface WatchProvider {
  providerId: number;
  providerName: string;
  logoUrl: string;
  displayPriority?: number;
}

interface WatchProviders {
  region: string;
  link: string | null;
  streaming: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

type Status = 'completed' | 'watching' | 'plan_to_watch';
export type QuickLogSource =
  | 'search'
  | 'home'
  | 'recommendation'
  | 'watchlist'
  | 'onboarding'
  | 'stats'
  | 'entry_detail_recommendation';

interface TmdbSeason {
  number: number;
  name: string;
  episodeCount: number;
  posterUrl: string | null;
  airYear: number | null;
}

interface TmdbEpisode {
  episode_number: number;
  name: string;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  stillUrl: string | null;
}

function getBase(): string | null {
  const d = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  return d ? `https://${d}` : null;
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
  return value
    .replace(/\b(with ads|standard|essential|premium|on tv|amazon channel|roku channel|apple tv channel|channel)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)
    .join(' ') || value;
}

function providerPriority(provider: WatchProvider, group: string): number {
  const name = provider.providerName.toLowerCase();
  if (group === 'paramount') {
    if (name.includes('premium') || name === 'paramount plus' || name === 'paramount+') return 0;
    if (name.includes('essential') || name.includes('on tv')) return 10;
    if (name.includes('channel') || name.includes('with ads')) return 20;
  }
  if (group === 'prime') {
    if (name.includes('prime video') && !name.includes('channel')) return 0;
    if (name.includes('channel')) return 20;
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
  return Array.from(grouped.entries())
    .map(([group, candidates]) =>
      [...candidates].sort((a, b) => providerPriority(a, group) - providerPriority(b, group))[0],
    )
    .filter(Boolean);
}

function providerUrl(provider: WatchProvider, fallback: string | null): string | null {
  const name = provider.providerName.toLowerCase();
  if (name.includes('netflix')) return 'https://www.netflix.com/';
  if (name.includes('amazon') || name.includes('prime video')) return 'https://www.primevideo.com/';
  if (name.includes('apple tv')) return 'https://tv.apple.com/';
  if (name.includes('paramount')) return 'https://www.paramountplus.com/';
  if (name.includes('disney')) return 'https://www.disneyplus.com/';
  if (name.includes('hulu')) return 'https://www.hulu.com/';
  if (name.includes('max') || name.includes('hbo')) return 'https://www.max.com/';
  if (name.includes('peacock')) return 'https://www.peacocktv.com/';
  if (name.includes('youtube')) return 'https://www.youtube.com/';
  if (name.includes('starz')) return 'https://www.starz.com/';
  if (name.includes('showtime')) return 'https://www.showtime.com/';
  if (name.includes('crunchyroll')) return 'https://www.crunchyroll.com/';
  return fallback;
}

// ── TMDB Search hook ──────────────────────────────────────────────────────────

function useTmdbSearch(query: string) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const base = getBase();
        if (!base) throw new Error('Movie database connection is not configured.');
        const token = await getTokenRef.current();
        const res = await authFetch(`${base}/api/tmdb/search?q=${encodeURIComponent(query)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            res.status === 401
              ? 'Your session expired. Please sign in again.'
              : body?.error ?? `TMDB search failed (${res.status})`,
          );
        }
        const data = await res.json();
        if (!cancelled) setResults(data.results ?? []);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setError(err instanceof Error ? err.message : 'Could not load search results.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, retryKey, isLoaded, isSignedIn, userId]);

  return { results, loading, error, retry: () => setRetryKey(key => key + 1) };
}

// ── Popular hook (movies + shows, paginated) ──────────────────────────────────

function usePopular() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const cache = useQueryClient();
  const activeRequest = useRef(0);
  const loadingKey = useRef<string | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [movies, setMovies] = useState<TmdbItem[]>([]);
  const [shows, setShows] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const canFetch = isLoaded && isSignedIn && !!userId;

  const fetch_ = useCallback(async (p: number) => {
    if (!canFetch) {
      setLoading(false);
      setMovies([]);
      setShows([]);
      return;
    }
    const base = getBase();
    if (!base) {
      setError('Movie database connection is not configured.');
      return;
    }
    const key = JSON.stringify([userId, p]);
    if (loadingKey.current === key) return;
    loadingKey.current = key;
    const version = ++activeRequest.current;
    const queryKey = ['mobile-popular', userId, p];
    const cached = cache.getQueryData<{ movies: TmdbItem[]; shows: TmdbItem[] }>(queryKey);
    setMovies(cached?.movies ?? []);
    setShows(cached?.shows ?? []);
    setLoading(true);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const res = await authFetch(`${base}/api/tmdb/popular?page=${p}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          res.status === 401
            ? 'Your session expired. Please sign in again.'
            : body?.error ?? `TMDB popular titles failed (${res.status})`,
        );
      }
      const payload = await res.json();
      if (activeRequest.current !== version) return;
      cache.setQueryData(queryKey, payload);
      setMovies(payload.movies ?? []);
      setShows(payload.shows ?? []);
    } catch (err) {
      if (activeRequest.current !== version) return;
      setMovies([]);
      setShows([]);
      setError(err instanceof Error ? err.message : 'Could not load popular titles.');
    } finally {
      if (activeRequest.current === version) {
        setLoading(false);
        loadingKey.current = null;
      }
    }
  }, [canFetch, userId, cache]);

  useEffect(() => {
    void fetch_(page);
    return () => { activeRequest.current++; loadingKey.current = null; };
  }, [page, fetch_]);

  const refresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPage(p => p + 1);
  }, []);

  const reload = useCallback(() => {
    void fetch_(page);
  }, [fetch_, page]);

  return { movies, shows, loading, error, refresh, reload };
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
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
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
          {[item.year, item.type === 'movie' ? 'Movie' : 'TV show'].filter(Boolean).join(' · ')}
        </Text>
        {inCollection && (
          <Text style={styles.inCollectionText}>✓ In your collection</Text>
        )}
      </View>
      <View
        style={[
          styles.resultArrow,
          {
            backgroundColor: item.type === 'movie' ? '#E0E7FF' : '#EDE9FE',
          },
        ]}
        pointerEvents="none"
      >
        <Feather
          name="chevron-right"
          size={19}
          color={item.type === 'movie' ? '#3730A3' : '#5B21B6'}
        />
      </View>
    </TouchableOpacity>
  );
}

type PersonCard = {
  name: string;
  profileUrl: string | null;
  character?: string;
  personId?: number | null;
};

function PeopleStrip({ people }: { people: PersonCard[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.peopleRow}
    >
      {people.map(person => (
        <TouchableOpacity
          key={`${person.name}-${person.character ?? ''}`}
          style={styles.personItem}
          disabled={!person.personId}
          onPress={() => person.personId
            ? Linking.openURL(`https://www.themoviedb.org/person/${person.personId}`).catch(() => {})
            : undefined}
          accessibilityRole={person.personId ? 'link' : undefined}
          accessibilityLabel={person.personId ? `Open ${person.name}'s profile` : person.name}
        >
          {person.profileUrl ? (
            <Image
              source={{ uri: person.profileUrl }}
              style={styles.personAvatar}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.personAvatar, styles.personAvatarPlaceholder]}>
              <Feather name="user" size={18} color="#7E7A73" />
            </View>
          )}
          <Text style={styles.personName} numberOfLines={2}>{person.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Info / collection sheet ───────────────────────────────────────────────────

const STATUSES: { key: Status; label: string }[] = [
  { key: 'completed', label: 'Watched' },
  { key: 'watching', label: 'Watching' },
  { key: 'plan_to_watch', label: 'Watchlist' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const EMPTY_SEASONS: Array<Record<string, any>> = [];

export function QuickLogSheet({
  item, visible, onClose, onSaved, insets,
  initialStatus = null, entryId = null, canDelete = false, onDeleted,
  initialDateWatched = null, initialRating = null, initialSeasons = EMPTY_SEASONS,
  initialSeasonNumber = null,
  showProviders = true, showRecommendations = true, source,
}: {
  item: TmdbItem | null; visible: boolean;
  onClose: () => void; onSaved: (status?: Status, tmdbId?: number) => void;
  insets: { bottom: number; top?: number };
  initialStatus?: Status | null;
  entryId?: number | null;
  canDelete?: boolean;
  onDeleted?: () => void;
  initialDateWatched?: string | null;
  initialRating?: number | null;
  initialSeasons?: Array<Record<string, any>>;
  initialSeasonNumber?: number | null;
  showProviders?: boolean;
  showRecommendations?: boolean;
  source: QuickLogSource;
}) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const queryClient = useQueryClient();
  const { data: collectionData } = useListEntries({} as any);
  const createEntry = useCreateEntry();
  const deleteEntry = useDeleteEntry();
  const updateEntry = useUpdateEntry();

  const [status, setStatus] = useState<Status | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [watchProviders, setWatchProviders] = useState<WatchProviders | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tvSeasons, setTvSeasons] = useState<TmdbSeason[]>([]);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [seasonDraft, setSeasonDraft] = useState<{ number: number; status: 'watched' | 'watching' | 'plan_to_watch' | null; year: number; rating: number } | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<TmdbEpisode[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [watchedDetailsVisible, setWatchedDetailsVisible] = useState(false);
  const [recommendations, setRecommendations] = useState<TmdbItem[]>([]);
  const [detailItem, setDetailItem] = useState<TmdbItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seasonRecords, setSeasonRecords] = useState<Array<Record<string, any>>>([]);
  const [ratingTick, setRatingTick] = useState(0);
  const savedRatingRef = useRef(0);
  const savedStatusRef = useRef<Status | null>(null);
  const seasonSaveInFlight = useRef(false);
  const seasonRequestId = useRef(0);
  const createdSeasonEntryId = useRef<number | null>(null);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('whole_show');
  const [seasonFocus, setSeasonFocus] = useState<number | null>(null);
  const sheetScrollRef = useRef<ScrollView>(null);
  const seasonStripRef = useRef<ScrollView>(null);
  const seasonsSectionY = useRef(0);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const viewItem = detailItem ?? item;
  const viewEntry = viewItem
    ? ((collectionData as any[] | undefined)?.find(entry => entry.tmdbId === viewItem.tmdbId) ?? null)
    : null;
  const effectiveEntryId = (detailItem ? viewEntry?.id : entryId) ?? viewEntry?.id ?? createdSeasonEntryId.current ?? null;
  const effectiveInitialStatus = detailItem ? (viewEntry?.status ?? null) : initialStatus;
  const effectiveInitialDateWatched = detailItem ? (viewEntry?.dateWatched ?? null) : initialDateWatched;
  const effectiveInitialRating = detailItem ? (viewEntry?.rating ?? null) : initialRating;
  const effectiveInitialSeasons = detailItem ? (viewEntry?.seasons ?? EMPTY_SEASONS) : initialSeasons;
  const activeSource: QuickLogSource = detailItem ? 'recommendation' : source;

  const handleSheetClose = useCallback(() => {
    if (seasonSaveInFlight.current) return;
    onCloseRef.current();
  }, []);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !seasonSaveInFlight.current,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !seasonSaveInFlight.current && gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => sheetTranslateY.stopAnimation(),
      onPanResponderMove: (_, gesture) => {
        if (!seasonSaveInFlight.current && gesture.dy > 0) sheetTranslateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (!seasonSaveInFlight.current && (gesture.dy > 80 || gesture.vy > 0.8)) {
          Animated.timing(sheetTranslateY, {
            toValue: 700,
            duration: 160,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished && !seasonSaveInFlight.current) handleSheetClose();
            else sheetTranslateY.setValue(0);
          });
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            tension: 70,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const resetLocalState = useCallback((
    nextStatus: Status | null,
    nextDateWatched: string | null,
    nextRating: number | null,
    nextSeasons: Array<Record<string, any>>,
  ) => {
    sheetTranslateY.setValue(0);
    setStatus(nextStatus);
    savedStatusRef.current = nextStatus;
    const watchedDate = nextDateWatched ? new Date(`${nextDateWatched}T00:00:00`) : null;
    const hasValidDate = watchedDate && !Number.isNaN(watchedDate.getTime());
    setYear(hasValidDate ? watchedDate.getFullYear() : new Date().getFullYear());
    setMonth(hasValidDate ? watchedDate.getMonth() + 1 : new Date().getMonth() + 1);
    setRating(nextRating ?? 0);
    savedRatingRef.current = nextRating ?? 0;
    setSaving(false);
    setActiveSeason(null);
    setSeasonDraft(null);
    setSeasonEpisodes([]);
    setSeasonLoading(false);
    setWatchedDetailsVisible(false);
    setRecommendations([]);
    setSeasonRecords(nextSeasons);
    createdSeasonEntryId.current = null;
  }, [sheetTranslateY]);

  const resetTrackingMode = (entry: Record<string, any> | null, seasons: Array<Record<string, any>>) => {
    // Without an entry, derive from any seed seasons; the local choice then rides along on create.
    setTrackingMode(getShowTrackingMode((entry ?? { type: 'show', seasons }) as any));
  };

  useEffect(() => {
    if (item && collectionData !== undefined) {
      setDetailItem(null);
      resetLocalState(viewEntry?.status ?? initialStatus, viewEntry?.dateWatched ?? initialDateWatched,
        viewEntry?.rating ?? initialRating, viewEntry?.seasons ?? initialSeasons);
      resetTrackingMode(viewEntry, viewEntry?.seasons ?? initialSeasons);
      setSeasonFocus(initialSeasonNumber ?? null);
    }
    // A query refresh after autosaving must not reset the currently open season.
  }, [item?.tmdbId, visible, collectionData !== undefined, resetLocalState]);

  useEffect(() => {
    if (detailItem) {
      resetLocalState(effectiveInitialStatus, effectiveInitialDateWatched, effectiveInitialRating, effectiveInitialSeasons);
      resetTrackingMode(viewEntry, effectiveInitialSeasons);
      setSeasonFocus(null);
    }
  }, [detailItem?.tmdbId, resetLocalState]);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setWatchProviders(null);
    setTvSeasons([]);
    setActiveSeason(null);
    setSeasonEpisodes([]);
    setRecommendations([]);
    if (!viewItem) {
      setDetailLoading(false);
      return;
    }
    const base = getBase();
    if (!base) {
      setDetailLoading(false);
      return;
    }

    const media = viewItem.type === 'movie' ? 'movie' : 'tv';
    setDetailLoading(true);
    (async () => {
      try {
        const token = await getTokenRef.current();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const [detailResponse, providerResponse, seasonResponse, recommendationResponse] = await Promise.all([
          authFetch(`${base}/api/tmdb/${media}/${viewItem.tmdbId}`, { headers }),
          authFetch(`${base}/api/tmdb/${media}/${viewItem.tmdbId}/providers?region=US`, { headers }),
          viewItem.type === 'show'
            ? authFetch(`${base}/api/tmdb/show/${viewItem.tmdbId}`, { headers })
            : Promise.resolve(null),
          authFetch(`${base}/api/tmdb/${media}/${viewItem.tmdbId}/recommendations`, { headers }),
        ]);
        const [nextDetail, nextProviders, nextSeasons, nextRecommendations] = await Promise.all([
          detailResponse.ok ? detailResponse.json() : null,
          providerResponse.ok ? providerResponse.json() : null,
          seasonResponse?.ok ? seasonResponse.json() : null,
          recommendationResponse.ok ? recommendationResponse.json() : null,
        ]);
        if (!cancelled) {
          setDetail(nextDetail);
          setWatchProviders(nextProviders);
          setTvSeasons(nextSeasons?.seasons ?? []);
          setRecommendations(
            (nextRecommendations?.results ?? []).filter((recommendation: TmdbItem) => Boolean(recommendation.posterUrl)),
          );
        }
      } catch {
        // The search result still provides a useful fallback synopsis.
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [viewItem?.tmdbId, viewItem?.type]);

  const openSeason = async (seasonNumber: number) => {
    if (seasonSaveInFlight.current) return;
    const requestId = ++seasonRequestId.current;
    if (!viewItem || viewItem.type !== 'show') return;
    setActiveSeason(seasonNumber);
    const saved = seasonRecords.find(season => season.number === seasonNumber);
    setSeasonDraft(seasonNumber < 1 ? null : { number: seasonNumber, status: saved?.status ?? null,
      year: saved?.dateWatched ? Number(saved.dateWatched.slice(0, 4)) : new Date().getFullYear(),
      rating: saved?.rating ?? 0 });
    setSeasonEpisodes([]);
    setSeasonLoading(true);
    try {
      const base = getBase();
      if (!base) return;
      const token = await getTokenRef.current();
      const response = await authFetch(
        `${base}/api/tmdb/tv/${viewItem.tmdbId}/season/${seasonNumber}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (response.ok) {
        const data = await response.json();
        const episodes = data.episodes ?? [];
        if (requestId === seasonRequestId.current && episodes.length > 0) {
          setSeasonEpisodes(episodes);
        }
      }
    } catch {
      if (requestId === seasonRequestId.current) setSeasonEpisodes([]);
    } finally {
      if (requestId === seasonRequestId.current) setSeasonLoading(false);
    }
  };

  const handleSave = async (nextStatus?: Status) => {
    const effectiveStatus = nextStatus ?? status;
    if (!viewItem || !effectiveStatus || seasonSaveInFlight.current) return;
    seasonSaveInFlight.current = true;
    const previousStatus = savedStatusRef.current;
    const previousRating = savedRatingRef.current;
    const savedRating = effectiveStatus === 'completed' ? rating : 0;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const baseData = {
        title: viewItem.title,
        type: viewItem.type,
        status: effectiveStatus,
        posterUrl: viewItem.posterUrl ?? undefined,
        synopsis: viewItem.overview ?? undefined,
        tmdbId: viewItem.tmdbId,
        ...(viewItem.type === 'show' ? { trackingMode: 'whole_show' as const } : {}),
      };
      if (effectiveEntryId) {
        await updateEntry.mutateAsync({
          id: effectiveEntryId,
          data: effectiveStatus === 'completed'
            ? {
                ...baseData,
                dateWatched: `${year}-01-01`,
                rating: rating > 0 ? rating : null,
              }
            : {
                ...baseData,
                dateWatched: null,
                rating: null,
              },
        } as any);
      } else {
        const created = await createEntry.mutateAsync({
          data: effectiveStatus === 'completed'
            ? {
                ...baseData,
                dateWatched: `${year}-01-01`,
                ...(rating > 0 ? { rating } : {}),
              }
            : baseData,
        } as any);
        if ((created as any)?.id) createdSeasonEntryId.current = (created as any).id;
      }
      await queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      if (viewItem.type === 'show') await queryClient.invalidateQueries({ queryKey: getGetShowSeasonCommunityRatingsQueryKey(viewItem.tmdbId) });
      if (effectiveEntryId) {
        if (previousStatus === 'plan_to_watch' && effectiveStatus === 'watching') {
          trackEvent('watchlist_item_started');
        } else if (previousStatus !== 'completed' && effectiveStatus === 'completed') {
          trackEvent('title_completed', { source: activeSource });
        }
      } else {
        trackEvent('entry_created', {
          status: effectiveStatus,
          media_type: viewItem.type,
          source: activeSource,
        });
      }
      if (savedRating !== previousRating) {
        trackEvent('rating_saved', { rating: savedRating, cleared: savedRating === 0 });
      }
      savedRatingRef.current = savedRating;
      if (viewItem?.tmdbId) await queryClient.invalidateQueries({ queryKey: getGetCommunityRatingsQueryKey(viewItem.type === 'movie' ? 'movie' : 'show', viewItem.tmdbId) });
      setRatingTick(t => t + 1);
      savedStatusRef.current = effectiveStatus;
      setRating(savedRating);
      setStatus(effectiveStatus);
      if (viewItem.type === 'show') setTrackingMode('whole_show');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(effectiveStatus, viewItem.tmdbId);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStatus(savedStatusRef.current);
      Alert.alert('Could not save title', 'Please try again.');
    } finally { seasonSaveInFlight.current = false; setSaving(false); }
  };

  const persistWatchedDetails = async (
    nextMonth = month,
    nextYear = year,
    nextRating = rating,
  ) => {
    if (!effectiveEntryId || status !== 'completed' || saving || seasonSaveInFlight.current) return;
    seasonSaveInFlight.current = true;
    setSaving(true);
    try {
      await updateEntry.mutateAsync({
          id: effectiveEntryId,
        data: {
          dateWatched: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
          year: nextYear,
          rating: nextRating > 0 ? nextRating : null,
          ...(viewItem?.type === 'show' ? { trackingMode: 'whole_show' } : {}),
        } as any,
      });
      await queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      if (nextRating !== savedRatingRef.current) {
        trackEvent('rating_saved', { rating: nextRating, cleared: nextRating === 0 });
      }
      savedRatingRef.current = nextRating;
      if (viewItem?.tmdbId) {
        await queryClient.invalidateQueries({ queryKey: getGetCommunityRatingsQueryKey(viewItem.type === 'movie' ? 'movie' : 'show', viewItem.tmdbId) });
      }
      setRatingTick(t => t + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not save watched details', 'Please try again.');
    } finally {
      seasonSaveInFlight.current = false;
      setSaving(false);
    }
  };

  const persistSeasonDetails = async (seasonNumber: number, nextStatus: 'watched' | 'watching' | 'plan_to_watch', nextYear: number, nextRating: number) => {
    if (!viewItem || saving || seasonSaveInFlight.current) return;
    seasonSaveInFlight.current = true;
    const previousDraft = seasonDraft;
    const existing = seasonRecords.find(season => season.number === seasonNumber);
    setSaving(true);
    try {
      const nextSeasons = upsertSeasonProgress(seasonRecords as Array<{ number: number }>, { number: seasonNumber, status: nextStatus, year: nextYear, rating: nextRating });
      const targetId = effectiveEntryId ?? createdSeasonEntryId.current ?? viewEntry?.id;
      if (targetId) {
        await updateEntry.mutateAsync({ id: targetId, data: { seasons: nextSeasons, trackingMode: 'seasons' } as any });
      } else {
        const saved = await createEntry.mutateAsync({ data: {
          title: viewItem.title, type: 'show', tmdbId: viewItem.tmdbId,
          status: nextStatus === 'watched' ? 'completed' : nextStatus,
          ...(viewItem.posterUrl ? { posterUrl: viewItem.posterUrl } : {}),
          seasons: nextSeasons,
          trackingMode: 'seasons',
        } as any });
        createdSeasonEntryId.current = saved.id;
      }
      setSeasonRecords(nextSeasons);
      setTrackingMode('seasons');
      await queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetShowSeasonCommunityRatingsQueryKey(viewItem!.tmdbId) });
      trackEvent(existing ? 'season_progress_saved' : 'season_completed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSeasonDraft(previousDraft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not save season details', 'Please try again.');
    } finally {
      seasonSaveInFlight.current = false;
      setSaving(false);
    }
  };

  const changeSeasonDraft = (patch: Partial<NonNullable<typeof seasonDraft>>) => {
    if (!seasonDraft || saving || seasonSaveInFlight.current) return;
    const next = { ...seasonDraft, ...patch };
    setSeasonDraft(next);
    if (next.status) void persistSeasonDetails(next.number, next.status, next.year, next.rating);
  };

  useEffect(() => {
    if (visible && !detailItem && initialSeasonNumber && tvSeasons.length) {
      void openSeason(initialSeasonNumber);
      const strip = tvSeasons.filter(season => season.number > 0);
      setTimeout(() => scrollSeasonStripTo(initialSeasonNumber, strip), 120);
    }
  }, [visible, item?.tmdbId, initialSeasonNumber, tvSeasons, detailItem?.tmdbId]);

  const chooseTrackingMode = async (mode: TrackingMode) => {
    if (mode === trackingMode || saving || seasonSaveInFlight.current) return;
    Haptics.selectionAsync();
    const previous = trackingMode;
    setTrackingMode(mode);
    // No entry yet: keep the choice locally; the next create carries it.
    if (!effectiveEntryId) return;
    seasonSaveInFlight.current = true;
    setSaving(true);
    try {
      // Only the presentation flag changes; parent metadata and season records stay intact.
      await updateEntry.mutateAsync({ id: effectiveEntryId, data: { trackingMode: mode } as any });
      await queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
    } catch {
      setTrackingMode(previous);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not change tracking', 'Please try again.');
    } finally {
      seasonSaveInFlight.current = false;
      setSaving(false);
    }
  };

  const scrollSeasonStripTo = (seasonNumber: number, list: TmdbSeason[]) => {
    const index = list.findIndex(season => season.number === seasonNumber);
    if (index >= 0) seasonStripRef.current?.scrollTo({ x: Math.max(0, index * 88 - 40), animated: true });
  };

  const viewEntireShow = () => {
    if (seasonSaveInFlight.current) return;
    setSeasonFocus(null);
    requestAnimationFrame(() => sheetScrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const goToAllSeasons = () => {
    if (seasonSaveInFlight.current) return;
    setActiveSeason(null);
    setSeasonDraft(null);
    ++seasonRequestId.current;
    setSeasonFocus(null);
    setTimeout(() => sheetScrollRef.current?.scrollTo({ y: Math.max(0, seasonsSectionY.current - 12), animated: true }), 60);
  };

  const selectSeason = (seasonNumber: number, list: TmdbSeason[]) => {
    if (seasonSaveInFlight.current) return;
    setSeasonFocus(seasonNumber);
    void openSeason(seasonNumber);
    scrollSeasonStripTo(seasonNumber, list);
    requestAnimationFrame(() => sheetScrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const confirmDelete = () => {
    if (!effectiveEntryId || deleting) return;
    Alert.alert('Remove from your collection?', viewItem?.type === 'show'
      ? 'This removes the whole show and all its saved season history from your collection.'
      : 'This will remove the title from your collection.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteEntry.mutateAsync({ id: effectiveEntryId });
            await queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
            if (viewItem?.type === 'show') await queryClient.invalidateQueries({ queryKey: getGetShowSeasonCommunityRatingsQueryKey(viewItem.tmdbId) });
            if (viewItem) await queryClient.invalidateQueries({ queryKey: getGetCommunityRatingsQueryKey(viewItem.type === 'movie' ? 'movie' : 'show', viewItem.tmdbId) });
            if (status === 'plan_to_watch') {
              trackEvent('watchlist_item_removed');
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDeleted?.();
            onClose();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Could not remove title', 'Please try again.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const confirmDeleteSeason = (seasonNumber: number) => {
    const targetId = effectiveEntryId;
    if (!targetId || deleting || seasonSaveInFlight.current || !viewItem) return;
    const record = seasonRecords.find(season => season.number === seasonNumber);
    if (!record) {
      Alert.alert(`Season ${seasonNumber} isn't tracked`, 'There is nothing saved for this season yet. To remove the whole TV show, go to View Entire TV Show (All Seasons) and tap the trash button there.');
      return;
    }
    const remaining = seasonRecords.filter(season => season.number !== seasonNumber);
    const message = remaining.length === 0
      ? `This is your last tracked season. Removing Season ${seasonNumber} clears its status, rating, year, notes and episode progress. ${viewItem.title} stays in your collection.`
      : `This clears Season ${seasonNumber}'s status, rating, year, notes and episode progress. Your other seasons and whole-show details are kept.`;
    Alert.alert(`Remove Season ${seasonNumber}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove season',
        style: 'destructive',
        onPress: async () => {
          if (seasonSaveInFlight.current) return;
          seasonSaveInFlight.current = true;
          setDeleting(true);
          try {
            await updateEntry.mutateAsync({ id: targetId, data: { seasons: remaining } as any });
            setSeasonRecords(remaining);
            setSeasonDraft(draft => draft && draft.number === seasonNumber ? { ...draft, status: null, rating: 0 } : draft);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() }),
              queryClient.invalidateQueries({ queryKey: getGetShowSeasonCommunityRatingsQueryKey(viewItem.tmdbId) }),
              queryClient.invalidateQueries({ queryKey: getGetCommunityRatingsQueryKey('show', viewItem.tmdbId) }),
            ]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Could not remove season', 'Please try again.');
          } finally {
            seasonSaveInFlight.current = false;
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const rateSeasonFromStrip = (season: TmdbSeason, star: number, list: TmdbSeason[]) => {
    if (saving || seasonSaveInFlight.current) return;
    const record = seasonRecords.find(r => r.number === season.number);
    Haptics.selectionAsync();
    if (record?.status === 'watched') {
      const recordYear = record.dateWatched ? Number(String(record.dateWatched).slice(0, 4)) : new Date().getFullYear();
      if (seasonDraft?.number === season.number) setSeasonDraft({ ...seasonDraft, rating: star });
      void persistSeasonDetails(season.number, 'watched', recordYear, star);
      return;
    }
    // Not watched yet: open the season's own status controls instead of inventing completion.
    selectSeason(season.number, list);
  };

  if (!viewItem) return null;

  const providerList = dedupeProviders([
    ...(watchProviders?.streaming ?? []),
    ...(watchProviders?.rent ?? []),
    ...(watchProviders?.buy ?? []),
  ]).slice(0, 6);
  const summary = detail?.overview ?? viewItem.overview;
  const castPeople = detail?.cast?.slice(0, 8) ?? [];
  const creatorPeople = detail?.directors ?? [];
  const visibleSeasons = tvSeasons.filter(
    season => season.number > 0,
  );
  const isShow = viewItem.type === 'show';
  const detailSeasonTotal = (detail as any)?.numberOfSeasons ?? (detail as any)?.number_of_seasons;
  const regularSeasonCount: number | null = typeof detailSeasonTotal === 'number'
    ? detailSeasonTotal
    : (!detailLoading && tvSeasons.length > 0 ? visibleSeasons.length : null);
  const showTrackingChooser = isShow && regularSeasonCount !== null && regularSeasonCount > 1;
  const focusedSeason = seasonFocus !== null ? tvSeasons.find(season => season.number === seasonFocus) ?? null : null;
  const showWholeControls = !isShow || (seasonFocus === null && trackingMode === 'whole_show');
  const busy = saving || deleting;

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleSheetClose}>
      <View style={StyleSheet.absoluteFill}>
        <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={handleSheetClose} />
           <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <ScrollView
            ref={sheetScrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}
          >
            <View {...sheetPanResponder.panHandlers} style={styles.grabber}>
              <View style={styles.grabberLine} />
            </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            {seasonFocus !== null ? (
              focusedSeason?.posterUrl ? (
                <Image source={{ uri: focusedSeason.posterUrl }} style={styles.sheetPoster} resizeMode="cover" />
              ) : (
                <View style={[styles.sheetPoster, { backgroundColor: '#EFE4D2', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={styles.focusPosterNumber}>S{seasonFocus}</Text>
                </View>
              )
            ) : viewItem.posterUrl ? (
              <Image source={{ uri: viewItem.posterUrl }} style={styles.sheetPoster} resizeMode="cover" />
            ) : (
              <View style={[styles.sheetPoster, { backgroundColor: '#EFE4D2', alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="film" size={16} color="#A09898" />
              </View>
            )}
            <View style={styles.sheetTitleBody}>
              {seasonFocus !== null ? (
                <>
                  <Text style={styles.focusEyebrow}>SEASON {seasonFocus}</Text>
                  <Text style={styles.sheetTitle} numberOfLines={2}>{viewItem.title}</Text>
                  <Text style={styles.sheetMeta}>
                    {focusedSeason ? `${focusedSeason.episodeCount} episodes${focusedSeason.airYear ? ` · ${focusedSeason.airYear}` : ''}` : 'TV show'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.sheetTitle} numberOfLines={2}>{viewItem.title}</Text>
                  <Text style={styles.sheetMeta}>
                    {viewItem.type === 'movie' ? 'Movie' : 'TV show'}{viewItem.year ? ` · ${viewItem.year}` : ''}
                  </Text>
                </>
              )}
            </View>
             <View style={styles.sheetHeaderActions}>
                {effectiveEntryId ? (
                 <TouchableOpacity
                   style={styles.deleteCircle}
                   onPress={() => (seasonFocus !== null ? confirmDeleteSeason(seasonFocus) : confirmDelete())}
                   disabled={deleting}
                   hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                   accessibilityRole="button"
                    accessibilityLabel={seasonFocus !== null ? `Remove Season ${seasonFocus} from your collection` : `Remove ${viewItem.title} from your collection`}
                 >
                   {deleting ? (
                     <ActivityIndicator size="small" color="#ffffff" />
                   ) : (
                     <Feather name="trash-2" size={17} color="#ffffff" />
                   )}
                 </TouchableOpacity>
                ) : null}
                <ShareTitleButton title={{ title: viewItem.title, type: viewItem.type, year: viewItem.year, tmdbId: viewItem.tmdbId }} />
                <TouchableOpacity
                  style={[styles.closeCircle, busy && { opacity: 0.4 }]}
                  onPress={handleSheetClose}
                  disabled={busy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close details"
                >
                  <Feather name="x" size={18} color="#5B3FA5" />
                </TouchableOpacity>
             </View>
          </View>

          {/* Collection actions — keep the primary action close to the poster */}
          {seasonFocus !== null ? (
            <View style={styles.focusNav}>
              <TouchableOpacity style={styles.focusPrimary} onPress={goToAllSeasons} accessibilityRole="button" testID="view-entire-show">
                <Text style={styles.focusPrimaryText}>View Entire TV Show (All Seasons)</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {showTrackingChooser && seasonFocus === null ? (
            <View style={[styles.sheetSection, styles.collectionSection]}>
              <Text style={styles.sheetLabel}>How do you want to track this TV show?</Text>
              <View style={styles.modeRow} accessibilityRole="radiogroup">
                {([['whole_show', 'Track whole TV show', 'Show one poster for the whole TV show in your Watched, Watching or Watchlist.'], ['seasons', 'Track individual seasons', 'Show a poster for each season separately in your Watched, Watching or Watchlist.']] as const).map(([key, label, hint]) => {
                  const active = trackingMode === key;
                  return (
                    <TouchableOpacity key={key} style={[styles.modeCard, active && styles.modeCardActive]} disabled={busy}
                      onPress={() => void chooseTrackingMode(key)} accessibilityRole="radio" accessibilityState={{ selected: active, disabled: busy }}
                      testID={`tracking-mode-${key}`}>
                      <Text style={[styles.modeLabel, active && styles.chipTextActive]}>{label}</Text>
                      <Text style={[styles.modeHint, active && styles.modeHintActive]}>{hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {showWholeControls && <View style={[styles.sheetSection, styles.collectionSection]}>
            <Text style={styles.sheetLabel}>{isShow ? 'WHOLE SHOW' : 'ADD TO YOUR COLLECTION'}</Text>
            <View style={styles.chipsRow}>
              {STATUSES.map(s => {
                const active = status === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.chip, active && styles.chipActive]}
                    disabled={busy}
                    onPress={() => {
                      Haptics.selectionAsync();
                       setStatus(s.key);
                       if (s.key === 'completed') {
                         setWatchedDetailsVisible(true);
                       } else {
                         void handleSave(s.key);
                       }
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>}

            {status === 'completed' && effectiveEntryId && showWholeControls ? (
             <View style={styles.watchedDetailsSection}>
               <Text style={styles.sheetLabel}>{isShow ? 'WHOLE SHOW · WATCHED' : 'WATCHED'}</Text>
               <View style={styles.watchedDateRow}>
                 <View style={styles.dateStepper}>
                   <TouchableOpacity
                     style={styles.dateStepperButton}
                     onPress={() => {
                       const nextMonth = month === 1 ? 12 : month - 1;
                       const nextYear = month === 1 ? year - 1 : year;
                       setMonth(nextMonth);
                       setYear(nextYear);
                       void persistWatchedDetails(nextMonth, nextYear);
                     }}
                     disabled={saving}
                     accessibilityLabel="Previous watched month"
                   >
                     <Feather name="chevron-left" size={16} color="#3B3275" />
                   </TouchableOpacity>
                   <Text style={styles.dateStepperText}>{MONTHS[month - 1]}</Text>
                   <TouchableOpacity
                     style={styles.dateStepperButton}
                     onPress={() => {
                       const nextMonth = month === 12 ? 1 : month + 1;
                       const nextYear = month === 12 ? year + 1 : year;
                       setMonth(nextMonth);
                       setYear(nextYear);
                       void persistWatchedDetails(nextMonth, nextYear);
                     }}
                     disabled={saving}
                     accessibilityLabel="Next watched month"
                   >
                     <Feather name="chevron-right" size={16} color="#3B3275" />
                   </TouchableOpacity>
                 </View>
                 <View style={styles.dateStepper}>
                   <TouchableOpacity
                     style={styles.dateStepperButton}
                     onPress={() => {
                       const nextYear = year - 1;
                       setYear(nextYear);
                       void persistWatchedDetails(month, nextYear);
                     }}
                     disabled={saving}
                     accessibilityLabel="Previous watched year"
                   >
                     <Feather name="chevron-left" size={16} color="#3B3275" />
                   </TouchableOpacity>
                   <Text style={styles.dateStepperText}>{year}</Text>
                   <TouchableOpacity
                     style={styles.dateStepperButton}
                     onPress={() => {
                       if (year >= new Date().getFullYear()) return;
                       const nextYear = year + 1;
                       setYear(nextYear);
                       void persistWatchedDetails(month, nextYear);
                     }}
                     disabled={saving || year >= new Date().getFullYear()}
                     accessibilityLabel="Next watched year"
                   >
                     <Feather name="chevron-right" size={16} color="#3B3275" />
                   </TouchableOpacity>
                 </View>
               </View>
               <Text style={styles.watchedRatingLabel}>{viewItem.type === 'show' ? 'YOUR OVERALL SHOW RATING' : 'YOUR RATING'}</Text>
               <View style={styles.starsRow}>
                 {[1, 2, 3, 4, 5].map(star => (
                   <TouchableOpacity
                     key={star}
                     onPress={() => {
                       const nextRating = rating === star ? 0 : star;
                       setRating(nextRating);
                       void persistWatchedDetails(month, year, nextRating);
                     }}
                     disabled={saving}
                     hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                     accessibilityLabel={`Rate ${star} out of 5 stars`}
                   >
                     <FontAwesome
                       name="star"
                       size={21}
                       color={star <= rating ? '#FFD34D' : '#D4C9BC'}
                     />
                   </TouchableOpacity>
                 ))}
               </View>
             </View>
           ) : null}

          {/* Public rating intentionally sits before the synopsis. */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>PUBLIC RATING</Text>
            {detailLoading ? (
              <ActivityIndicator size="small" color="#5B3FA5" />
            ) : (
              <Text style={styles.publicRatingText}>
                {detail?.voteAverage != null ? `${detail.voteAverage.toFixed(1)} / 10` : 'Not rated yet'}
              </Text>
            )}
            <Text style={styles.ratingSource}>The Movie Database (TMDB)</Text>
          </View>

          {/* Detail information */}
          {seasonFocus === null ? <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>ABOUT</Text>
            {detailLoading ? (
              <ActivityIndicator size="small" color="#5B3FA5" />
            ) : (
              <Text style={styles.detailBody}>
                {summary || 'No synopsis is available for this title.'}
              </Text>
            )}
          </View> : null}

          {viewItem.type === 'show' && visibleSeasons.length > 0 ? (
            <View style={styles.detailSection} onLayout={event => { seasonsSectionY.current = event.nativeEvent.layout.y; }}>
              <Text style={styles.detailLabel}>{seasonFocus !== null ? 'ALL SEASONS' : 'SEASONS'}</Text>
              <ScrollView
                ref={seasonStripRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.seasonList}
              >
                {visibleSeasons.map(season => (
                  <View key={season.number} style={styles.seasonItem}>
                    <TouchableOpacity
                      style={[
                        styles.seasonCard,
                        activeSeason === season.number && styles.seasonCardActive,
                      ]}
                      onPress={() => selectSeason(season.number, visibleSeasons)}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      {season.posterUrl ? (
                        <Image source={{ uri: season.posterUrl }} style={styles.seasonPoster} resizeMode="cover" />
                      ) : (
                        <View style={[styles.seasonPoster, styles.seasonPosterPlaceholder]}>
                          <Feather name="image" size={16} color="#7E7A73" />
                        </View>
                      )}
                      <Text style={styles.seasonName} numberOfLines={1}>
                        {season.number === 0 ? 'Specials' : `Season ${season.number}`}
                      </Text>
                      <Text style={styles.seasonEpisodesCount}>{season.episodeCount} episodes</Text>
                      <SeasonCommunitySummary tmdbId={viewItem.tmdbId} seasonNumber={season.number} />
                    </TouchableOpacity>
                    {season.number >= 1 ? (
                      <View style={styles.seasonRatingPill}>
                        {[1, 2, 3, 4, 5].map(star => {
                          const seasonRating = seasonRecords.find(record => record.number === season.number)?.rating ?? 0;
                          return (
                            <TouchableOpacity
                              key={star}
                              onPress={() => rateSeasonFromStrip(season, star, visibleSeasons)}
                              disabled={saving}
                              hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}
                              accessibilityLabel={`Rate ${season.name || `Season ${season.number}`} ${star} out of 5 stars`}
                            >
                              <FontAwesome
                                name={star <= seasonRating ? 'star' : 'star-o'}
                                size={12}
                                color={star <= seasonRating ? '#FFD34D' : '#B9A9E8'}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>

              {activeSeason !== null && (
                <View style={styles.episodeSection}>
                  <Text style={styles.episodeSectionTitle}>Season {activeSeason}</Text>
                  {seasonDraft?.number === activeSeason ? (
                    <View testID="season-status-editor">
                      <View style={styles.chipsRow}>
                        {(['watched', 'watching', 'plan_to_watch'] as const).map((key, index) => (
                          <TouchableOpacity key={key} disabled={saving}
                            style={[styles.chip, seasonDraft.status === key && styles.chipActive]}
                            onPress={() => changeSeasonDraft({ status: key })}
                            accessibilityRole="button" accessibilityState={{ selected: seasonDraft.status === key }}>
                            <Text style={[styles.chipText, seasonDraft.status === key && styles.chipTextActive]}>{['Watched', 'Watching', 'Watchlist'][index]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {seasonDraft.status === 'watched' ? (
                        <WatchedYearRating year={seasonDraft.year} rating={seasonDraft.rating} disabled={saving}
                          onYearChange={year => changeSeasonDraft({ year })}
                          onRatingChange={rating => changeSeasonDraft({ rating })} />
                      ) : null}
                      <Text accessibilityLiveRegion="polite" style={styles.seasonEpisodesCount}>
                        {saving ? 'Saving…' : seasonDraft.status ? 'Changes save automatically' : 'Choose a status to add this season'}
                      </Text>
                    </View>
                  ) : null}
                  <SeasonCommunityChart tmdbId={viewItem.tmdbId} seasonNumber={activeSeason} />
                  {seasonLoading ? (
                    <ActivityIndicator size="small" color="#5B3FA5" />
                  ) : seasonEpisodes.length > 0 ? (
                    <View>
                      {seasonEpisodes.map(episode => (
                        <View key={episode.episode_number} style={styles.episodeCard}>
                          {episode.stillUrl ? (
                            <Image source={{ uri: episode.stillUrl }} style={styles.episodeStill} resizeMode="cover" />
                          ) : (
                            <View style={[styles.episodeStill, styles.seasonPosterPlaceholder]}>
                              <Feather name="image" size={16} color="#7E7A73" />
                            </View>
                          )}
                          <View style={styles.episodeCopy}>
                            <Text style={styles.episodeTitle} numberOfLines={2}>
                              {episode.episode_number}. {episode.name}
                            </Text>
                            {episode.overview ? (
                              <Text style={styles.episodeOverview} numberOfLines={3}>
                                {episode.overview}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {creatorPeople.length > 0 ? (
            <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{viewItem.type === 'movie' ? 'DIRECTOR' : 'CREATOR'}</Text>
              <PeopleStrip people={creatorPeople} />
            </View>
          ) : null}

          {castPeople.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>CAST</Text>
              <PeopleStrip people={castPeople} />
            </View>
          ) : null}

          {detail?.genres?.length ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>GENRES</Text>
              <Text style={styles.detailBody}>{detail.genres.join(' · ')}</Text>
            </View>
          ) : null}

          {showProviders ? <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>WHERE TO WATCH</Text>
            {detailLoading ? (
              <ActivityIndicator size="small" color="#5B3FA5" />
            ) : providerList.length > 0 ? (
              <View style={styles.providerList}>
                {providerList.map(provider => {
                  const href = providerUrl(provider, watchProviders?.link ?? null);
                  return (
                    <TouchableOpacity
                      key={provider.providerId}
                      style={styles.providerCard}
                      onPress={() => href ? Linking.openURL(href).catch(() => {}) : undefined}
                      activeOpacity={0.75}
                      disabled={!href}
                      accessibilityRole={href ? 'link' : undefined}
                      accessibilityLabel={`Open ${provider.providerName}`}
                    >
                      <Image source={{ uri: provider.logoUrl }} style={styles.providerLogo} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.detailBody}>No streaming providers found in the US.</Text>
            )}
          </View> : null}

          {showRecommendations && recommendations.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>You May Also Like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendationList}
              >
                {recommendations.slice(0, 12).map(recommendation => (
                  <TouchableOpacity
                    key={`${recommendation.type}-${recommendation.tmdbId}`}
                    style={styles.recommendationCard}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDetailItem(recommendation);
                      trackEvent('title_detail_viewed', {
                        source: 'recommendation',
                        media_type: recommendation.type,
                        in_collection: Boolean(
                          (collectionData as any[] | undefined)?.some(
                            entry => entry.tmdbId === recommendation.tmdbId,
                          ),
                        ),
                      });
                    }}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel={`Open details for ${recommendation.title}`}
                  >
                    {recommendation.posterUrl ? (
                      <Image
                        source={{ uri: recommendation.posterUrl }}
                        style={styles.recommendationPoster}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text style={styles.recommendationTitle} numberOfLines={2}>
                      {recommendation.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <CommunityRatings type={viewItem.type} tmdbId={viewItem.tmdbId} refreshKey={ratingTick} tone="light" />

            </ScrollView>
           </Animated.View>
        </KeyboardAvoidingView>
        {watchedDetailsVisible && (
          <KeyboardAvoidingView
            style={[styles.watchedModalOverlay, StyleSheet.absoluteFill]}
            behavior="padding"
            keyboardVerticalOffset={0}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setWatchedDetailsVisible(false)}
            />
            <ScrollView
              contentContainerStyle={[
                styles.watchedModalScrollContent,
                { paddingTop: (insets.top ?? 0) + 20, paddingBottom: insets.bottom + 20 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
            <View style={styles.watchedModalCard}>
            <Text style={styles.watchedModalTitle}>When did you watch it?</Text>
            <Text style={styles.watchedModalSubtitle}>Add the year and your rating.</Text>

            <Text style={styles.watchedModalLabel}>YEAR WATCHED</Text>
            <View style={styles.yearRow}>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => { Haptics.selectionAsync(); setYear(y => y - 1); }}
              >
                <Feather name="minus" size={16} color="#111111" />
              </TouchableOpacity>
              <Text style={styles.yearText}>{year}</Text>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => {
                  if (year < new Date().getFullYear()) {
                    Haptics.selectionAsync();
                    setYear(y => y + 1);
                  }
                }}
              >
                <Feather name="plus" size={16} color="#111111" />
              </TouchableOpacity>
            </View>

            <Text style={styles.watchedModalLabel}>YOUR RATING</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => { Haptics.selectionAsync(); setRating(rating === star ? 0 : star); }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                   <FontAwesome
                    name="star"
                    size={23}
                    color={star <= rating ? '#FFD34D' : '#D4C9BC'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.watchedModalDone}
              onPress={() => {
                setWatchedDetailsVisible(false);
                void handleSave('completed');
              }}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.watchedModalDoneText}>Done</Text>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<TmdbItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [savedNoticeVisible, setSavedNoticeVisible] = useState(false);

  // User's collection for "In your collection" detection
  const { data: collectionData } = useListEntries({} as any);
  const collectionTmdbIds = new Set<number>(
    ((collectionData as any[]) ?? [])
      .map((e: any) => e.tmdbId)
      .filter(Boolean)
  );

  const { results, loading: searchLoading, error: searchError, retry: retrySearch } = useTmdbSearch(query);
  const {
    movies, shows, loading: popularLoading, error: popularError, refresh, reload: reloadPopular,
  } = usePopular();
  const availableShows = shows.filter(item => !collectionTmdbIds.has(item.tmdbId));
  const availableMovies = movies.filter(item => !collectionTmdbIds.has(item.tmdbId));

  const isSearching = query.trim().length > 0;
  const isLoading = isSearching ? searchLoading : popularLoading;
  const initialPopularLoading = !isSearching && popularLoading && movies.length === 0 && shows.length === 0;
  const dataError = isSearching ? searchError : popularError;
  const handleSelect = useCallback((item: TmdbItem) => {
    Haptics.selectionAsync();
    setSelectedItem(item);
    setSheetVisible(true);
    trackEvent('title_detail_viewed', {
      source: 'search',
      media_type: item.type,
      in_collection: collectionTmdbIds.has(item.tmdbId),
    });
  }, [collectionTmdbIds]);

  const handleClose = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

  const handleSaved = useCallback(() => {
    setSavedNoticeVisible(true);
    setSheetVisible(false);
    reloadPopular();
    setTimeout(() => {
      setSelectedItem(null);
      setSavedNoticeVisible(false);
    }, 2200);
  }, [reloadPopular]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 60;
  const cardBottomGap = Platform.OS === 'web' ? 76 : 20;

  const renderItem = ({ item }: { item: TmdbItem }) => {
    const inColl = collectionTmdbIds.has(item.tmdbId);
    return (
      <View>
        <ResultCard item={item} onPress={handleSelect} inCollection={inColl} />
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
            <View style={styles.searchInputWrap}>
              {!query ? (
                <Text
                  pointerEvents="none"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.searchPlaceholder}
                >
                  Search TV shows and movies.
                </Text>
              ) : null}
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search TV shows and movies"
                testID="search-input"
              />
            </View>
            {isSearching && isLoading ? (
              <ActivityIndicator size="small" color="#FFD34D" />
            ) : null}
          </View>
        </View>

        {/* ── Content ── */}
         {dataError ? (
           <View style={styles.errorState}>
             <Feather name="wifi-off" size={34} color="#A04A4A" />
             <Text style={styles.errorTitle}>Movie database unavailable</Text>
             <Text style={styles.errorSubtitle}>{dataError}</Text>
              <TouchableOpacity
               style={styles.retryBtn}
               onPress={isSearching ? retrySearch : refresh}
               activeOpacity={0.8}
             >
                <Feather name="refresh-cw" size={14} color="#A04A4A" />
               <Text style={styles.retryText}>Try again</Text>
             </TouchableOpacity>
           </View>
         ) : isSearching ? (
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
                   <Text style={styles.emptyTitle}>
                      No results
                   </Text>
                   <Text style={styles.emptySubtitle}>
                      Try a title, actor, or director name
                   </Text>
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
            refreshControl={
              <RefreshControl
                refreshing={popularLoading && !initialPopularLoading}
                onRefresh={refresh}
                tintColor="#FFD34D"
                colors={['#FFD34D']}
              />
            }
          >
            {initialPopularLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#FFD34D" />
              </View>
             ) : availableMovies.length === 0 && availableShows.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={40} color="#D4C9BC" />
                <Text style={styles.emptyTitle}>Your collection has these covered</Text>
                <Text style={styles.emptySubtitle}>Refresh later for more titles to discover</Text>
              </View>
            ) : (
              <>
                {/* Popular TV Shows */}
                  {availableShows.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { paddingTop: 0 }]}>POPULAR TV SHOWS</Text>
                      {availableShows.slice(0, 20).map(item => (
                  <View key={item.tmdbId}>
                     <ResultCard
                       item={item}
                       onPress={handleSelect}
                        inCollection={false}
                     />
                  </View>
                    ))}
                  </>
                )}

                {/* Popular Movies */}
                  {availableMovies.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 8 }]}>POPULAR MOVIES</Text>
                      {availableMovies.slice(0, 20).map(item => (
                  <View key={item.tmdbId}>
                     <ResultCard
                       item={item}
                       onPress={handleSelect}
                        inCollection={false}
                     />
                  </View>
                    ))}
                  </>
                )}
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
        source="search"
      />
      {savedNoticeVisible && (
        <View style={styles.savedToast} pointerEvents="none">
          <Text style={styles.savedToastText}>Saved</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  focusEyebrow: { fontSize: 11, fontFamily: 'Manrope_700Bold', color: '#5B3FA5', letterSpacing: 1 },
  focusPosterNumber: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: '#5B3FA5' },
  focusNav: { flexDirection: 'row', gap: 8, paddingTop: 14 },
  focusPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5B3FA5', borderRadius: 999, paddingVertical: 12 },
  focusPrimaryText: { color: '#ffffff', fontFamily: 'Manrope_700Bold', fontSize: 14 },
  focusSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDE9FE', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
  focusSecondaryText: { color: '#5B3FA5', fontFamily: 'Manrope_700Bold', fontSize: 14 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeCard: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#DDD3F5', backgroundColor: '#F6F2FF', padding: 12, gap: 3 },
  modeCardActive: { backgroundColor: '#5B3FA5', borderColor: '#5B3FA5' },
  modeLabel: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#3B3275' },
  modeHint: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  modeHintActive: { color: '#E4DCFA' },
  modeNote: { backgroundColor: '#F6F2FF', borderRadius: 12, padding: 12, gap: 6 },
  modeNoteText: { fontSize: 12, lineHeight: 17, fontFamily: 'Manrope_400Regular', color: '#3B3275' },
  modeNoteLink: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: '#5B3FA5' },
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
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8,
    borderWidth: 1, borderColor: '#116149',
  },
  refreshText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: '#116149' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 999, borderWidth: 1.5, borderColor: '#F5A623',
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: '#ffffff',
  },
  searchInput: {
    flex: 1, fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#111111',
    padding: 0, letterSpacing: 0, textAlign: 'left',
  },
  searchInputWrap: { flex: 1, minHeight: 20, justifyContent: 'center', position: 'relative' },
  searchPlaceholder: {
    position: 'absolute', left: 0, right: 0,
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#A09898',
    letterSpacing: 0, textAlign: 'left',
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
  resultArrow: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },
  inCollectionText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#116149' },
  peopleRow: { gap: 10, paddingRight: 4 },
  personItem: { width: 64, alignItems: 'center', gap: 5 },
  personAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#EFE4D2',
  },
  personAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  personName: {
    fontSize: 10, lineHeight: 13, fontFamily: 'Manrope_600SemiBold',
    color: '#3B3275', textAlign: 'center',
  },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },

  savedToast: {
    position: 'absolute', top: '44%', alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 999, backgroundColor: '#FF4BAE',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 5,
  },
  savedToastText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Manrope_600SemiBold', color: '#111111' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  errorState: {
    alignItems: 'center', paddingHorizontal: 28, paddingTop: 72, gap: 10,
  },
  errorTitle: {
    fontSize: 17, fontFamily: 'Manrope_700Bold', color: '#111111', textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13, lineHeight: 19, fontFamily: 'Manrope_400Regular',
    color: '#7E7A73', textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6,
    borderRadius: 999, borderWidth: 1, borderColor: '#A04A4A',
    paddingHorizontal: 16, paddingVertical: 9,
  },
  retryText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#A04A4A' },

  // Sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  sheetContent: { paddingHorizontal: 20, paddingTop: 8 },
  grabber: {
    width: 64, height: 24, borderRadius: 12,
    backgroundColor: 'transparent', alignSelf: 'center', marginBottom: 6,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  grabberLine: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: '#D4C9BC',
  },
  sheetHeader: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    marginBottom: 4,
  },
  sheetHeaderActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2,
  },
  deleteCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF4BAE',
  },
  closeCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1EDFF',
  },
  sheetPoster: { width: 72, height: 104, borderRadius: 12 },
  sheetTitleBody: { flex: 1, gap: 3 },
  sheetTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: '#111111', lineHeight: 23 },
  sheetMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },

  detailSection: { paddingTop: 16, gap: 7 },
  detailLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', color: '#7E7A73', letterSpacing: 0.8,
  },
  detailBody: {
    fontSize: 13, lineHeight: 19, fontFamily: 'Manrope_400Regular', color: '#3B3275',
  },
  publicRatingText: {
    fontSize: 20, lineHeight: 25, fontFamily: 'Manrope_700Bold', color: '#3B3275',
  },
  ratingSource: {
    fontSize: 11, fontFamily: 'Manrope_400Regular', color: '#7E7A73',
  },
  providerList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerCard: {
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1EDFF', borderRadius: 12, padding: 6,
  },
  providerLogo: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#E4DFEF' },

  sheetSection: { paddingTop: 16, gap: 10 },
  collectionSection: { paddingTop: 10 },
  sheetLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#7E7A73', letterSpacing: 0.8 },
  watchedDetailsSection: {
    paddingTop: 14, gap: 9, paddingBottom: 2,
  },
  watchedDateRow: { flexDirection: 'row', gap: 8 },
  dateStepper: {
    flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: '#F1EDFF',
    borderRadius: 999, paddingHorizontal: 4,
  },
  dateStepperButton: {
    width: 32, height: 34, alignItems: 'center', justifyContent: 'center',
  },
  dateStepperText: {
    flex: 1, textAlign: 'center', fontSize: 12,
    fontFamily: 'Manrope_700Bold', color: '#3B3275',
  },
  watchedRatingLabel: {
    fontSize: 10, fontFamily: 'Manrope_600SemiBold',
    color: '#7E7A73', letterSpacing: 0.7, marginTop: 2,
  },

  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 20,
    borderWidth: 0, backgroundColor: '#C5B8FF',
  },
  chipActive: { backgroundColor: '#5B3FA5' },
  chipText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: '#3B3275' },
  chipTextActive: { color: '#ffffff' },

  seasonList: { gap: 10, paddingRight: 4, alignItems: 'flex-start' },
  seasonItem: { width: 78, alignItems: 'center' },
  seasonCard: {
    width: 78, padding: 4, borderRadius: 12, backgroundColor: '#F1EDFF',
    alignItems: 'center', gap: 4,
  },
  seasonCardActive: { backgroundColor: '#E4DFEF', borderWidth: 2, borderColor: '#5B3FA5' },
  seasonPoster: { width: 68, height: 88, borderRadius: 8, backgroundColor: '#EFE4D2' },
  seasonPosterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  seasonName: {
    fontSize: 10, lineHeight: 13, fontFamily: 'Manrope_700Bold',
    color: '#3B3275', textAlign: 'center',
  },
  seasonEpisodesCount: {
    fontSize: 9, fontFamily: 'Manrope_400Regular', color: '#7E7A73', textAlign: 'center',
  },
  seasonRatingPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 2, marginTop: 5, paddingHorizontal: 2, paddingVertical: 0,
  },
  episodeSection: { gap: 8, marginTop: 2 },
  episodeSectionTitle: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#3B3275' },
  episodeCard: {
    flexDirection: 'row', gap: 10, padding: 8, marginBottom: 7,
    borderWidth: 1, borderColor: '#E2D9CE', borderRadius: 12, backgroundColor: '#FFF3E8',
  },
  episodeStill: {
    width: 96, height: 60, borderRadius: 8, backgroundColor: '#EFE4D2',
    alignItems: 'center', justifyContent: 'center',
  },
  episodeCopy: { flex: 1, gap: 3 },
  episodeTitle: { fontSize: 11, lineHeight: 15, fontFamily: 'Manrope_700Bold', color: '#111111' },
  episodeOverview: { fontSize: 10, lineHeight: 14, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  recommendationList: { gap: 10, paddingRight: 4 },
  recommendationCard: { width: 86, gap: 5 },
  recommendationPoster: {
    width: 86, height: 126, borderRadius: 9, backgroundColor: '#EFE4D2',
  },
  recommendationTitle: {
    fontSize: 10, lineHeight: 13, fontFamily: 'Manrope_600SemiBold',
    color: '#3B3275',
  },

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

  watchedModalOverlay: {
    flex: 1, backgroundColor: 'rgba(17,17,17,0.45)',
  },
  watchedModalScrollContent: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  watchedModalCard: {
    width: '100%', maxWidth: 360, borderRadius: 24, padding: 22,
    backgroundColor: '#ffffff', gap: 10,
  },
  watchedModalTitle: { fontSize: 19, fontFamily: 'Manrope_700Bold', color: '#111111' },
  watchedModalSubtitle: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  watchedModalLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', color: '#7E7A73',
    letterSpacing: 0.8, marginTop: 8,
  },
  watchedModalDone: {
    backgroundColor: '#FF4BAE', borderRadius: 999,
    paddingVertical: 13, alignItems: 'center', marginTop: 8,
  },
  watchedModalDoneText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
});
