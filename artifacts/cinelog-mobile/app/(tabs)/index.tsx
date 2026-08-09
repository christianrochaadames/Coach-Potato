import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Modal,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/expo';
import {
  useListEntries, useCreateEntry, useUpdateEntry,
  getListEntriesQueryKey, getListYearsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

// Computed in the component via useWindowDimensions to avoid SSR issues
const POSTER_GAP = 8;
const POSTER_SIDE_PAD = 20;

// ── Avatar image map ─────────────────────────────────────────────────────────
const AVATAR_MAP: Record<string, any> = {
  '2':  require('@/assets/images/spud-avatar-2.png'),
  '3':  require('@/assets/images/spud-avatar-3.png'),
  '4':  require('@/assets/images/spud-avatar-4.png'),
  '5':  require('@/assets/images/spud-avatar-5.png'),
  '6':  require('@/assets/images/spud-avatar-6.png'),
  '7':  require('@/assets/images/spud-avatar-7.png'),
  '8':  require('@/assets/images/spud-avatar-8.png'),
  '9':  require('@/assets/images/spud-avatar-9.png'),
  '10': require('@/assets/images/spud-avatar-10.png'),
  '11': require('@/assets/images/spud-avatar-11.png'),
  '12': require('@/assets/images/spud-avatar-12.png'),
  '13': require('@/assets/images/spud-avatar-13.png'),
  '14': require('@/assets/images/spud-avatar-14.png'),
  '15': require('@/assets/images/spud-avatar-15.png'),
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function groupByYear(entries: any[]) {
  const map = new Map<number, any[]>();
  for (const e of entries) {
    const yr =
      e.year ??
      (e.dateWatched ? new Date(e.dateWatched).getFullYear() : null) ??
      0;
    if (!map.has(yr)) map.set(yr, []);
    map.get(yr)!.push(e);
  }
  return [...map.entries()].sort(([a], [b]) => b - a);
}

function useGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

function useProfile() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<{
    firstName?: string; avatarId?: string; avatarUrl?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
        const res = await fetch(`https://${domain}/api/profile`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && res.ok) setProfile(await res.json());
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  return profile;
}

type RecItem = {
  tmdbId: number; title: string; type: 'movie' | 'show';
  year: number | null; posterUrl: string | null; overview?: string | null;
};

function useRecommendations() {
  const { getToken } = useAuth();
  const [results, setResults] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const refetch = useCallback(() => { setLoading(true); setKey(k => k + 1); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
        const res = await fetch(`https://${domain}/api/recommendations?_ts=${Date.now()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && res.ok) {
          const d = await res.json();
          setResults(d.results ?? []);
        }
      } catch {} finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [key]);

  return { results, loading, refetch };
}

// ── Sub-components ────────────────────────────────────────────────────────────
function YearPill({ year }: { year: number }) {
  return (
    <View style={styles.yearPillWrap}>
      <View style={styles.yearPill}>
        <Text style={styles.yearPillText}>{year === 0 ? 'Unknown year' : year}</Text>
      </View>
    </View>
  );
}

function PosterThumb({ entry, onPress, posterW }: { entry: any; onPress: () => void; posterW: number }) {
  const queryClient = useQueryClient();
  const updateEntry = useUpdateEntry();
  const [localRating, setLocalRating] = useState<number>(entry.rating ?? 0);

  // Sync if parent entry changes
  useEffect(() => { setLocalRating(entry.rating ?? 0); }, [entry.rating]);

  const handleStarTap = (star: number) => {
    const newRating = localRating === star ? 0 : star;
    setLocalRating(newRating);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateEntry.mutate(
      { id: entry.id, data: { rating: newRating > 0 ? newRating : null } as any },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() }) },
    );
  };

  return (
    <View style={{ width: posterW }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View style={[styles.posterThumb, { width: posterW, height: posterW * 1.5 }]}>
          {entry.posterUrl ? (
            <Image source={{ uri: entry.posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.posterPlaceholder]}>
              <Feather name="film" size={20} color="#EFE4D2" />
            </View>
          )}
        </View>
      </TouchableOpacity>
      <Text style={styles.posterTitle} numberOfLines={1}>{entry.title}</Text>
      {/* Interactive star row */}
      <View style={styles.posterStarsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity
            key={star}
            onPress={() => handleStarTap(star)}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <Text style={[styles.posterStar, { color: star <= localRating ? '#116149' : '#D4C9BC' }]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function HorizPoster({ entry, onPress }: { entry: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.horizCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.horizPoster}>
        {entry.posterUrl ? (
          <Image source={{ uri: entry.posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.posterPlaceholder]}>
            <Feather name="film" size={20} color="#EFE4D2" />
          </View>
        )}
      </View>
      <Text style={styles.horizTitle} numberOfLines={2}>{entry.title}</Text>
      {(entry.rating ?? 0) > 0 && (
        <Text style={styles.horizStars}>{'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}</Text>
      )}
    </TouchableOpacity>
  );
}

function RecCard({ rec, onPress, onSkip }: { rec: RecItem; onPress: () => void; onSkip: () => void }) {
  return (
    <View style={styles.horizCard}>
      <TouchableOpacity style={styles.horizPoster} onPress={onPress} activeOpacity={0.8}>
        {rec.posterUrl ? (
          <Image source={{ uri: rec.posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.posterPlaceholder]}>
            <Text style={{ color: '#116149', fontSize: 18, fontWeight: '700' }}>
              {rec.title[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={onSkip}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={12} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
      <Text style={styles.horizTitle} numberOfLines={2}>{rec.title}</Text>
      <Text style={styles.horizMeta}>
        {rec.year} · {rec.type === 'movie' ? 'Movie' : 'TV Show'}
      </Text>
    </View>
  );
}

// ── Quick-add sheet ───────────────────────────────────────────────────────────
function QuickAddSheet({
  rec,
  onClose,
  onAdd,
  adding,
}: {
  rec: RecItem | null;
  onClose: () => void;
  onAdd: (status: 'watching' | 'plan_to_watch' | 'completed', year?: number) => void;
  adding: boolean;
}) {
  const [pickingYear, setPickingYear] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const years = Array.from(
    { length: new Date().getFullYear() - 1950 + 1 },
    (_, i) => new Date().getFullYear() - i,
  );

  useEffect(() => { if (!rec) setPickingYear(false); }, [rec]);

  if (!rec) return null;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            {rec.posterUrl && (
              <Image source={{ uri: rec.posterUrl }} style={styles.sheetPoster} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{rec.title}</Text>
              <Text style={styles.sheetMeta}>
                {rec.year ?? '—'} · {rec.type === 'movie' ? 'Movie' : 'TV Show'}
              </Text>
              {rec.overview ? (
                <Text style={styles.sheetOverview} numberOfLines={3}>{rec.overview}</Text>
              ) : null}
            </View>
          </View>

          {pickingYear ? (
            <View>
              <Text style={styles.sheetLabel}>When did you watch it?</Text>
              <ScrollView style={styles.yearScroll} showsVerticalScrollIndicator={false}>
                {years.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.yearRow, y === year && styles.yearRowActive]}
                    onPress={() => setYear(y)}
                  >
                    <Text style={[styles.yearRowText, y === year && styles.yearRowTextActive]}>{y}</Text>
                    {y === year && <Feather name="check" size={14} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.sheetRow}>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => setPickingYear(false)}>
                  <Text style={styles.btnSecondaryText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, adding && { opacity: 0.5 }]}
                  onPress={() => { onAdd('completed', year); }}
                  disabled={adding}
                >
                  {adding ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.btnPrimaryText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.btnPrimary, adding && { opacity: 0.5 }]}
                onPress={() => onAdd('watching')}
                disabled={adding}
              >
                {adding ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={styles.btnPrimaryText}>Currently Watching</Text>
                )}
              </TouchableOpacity>
              <View style={styles.sheetRow}>
                <TouchableOpacity
                  style={[styles.btnOutline, adding && { opacity: 0.5 }]}
                  onPress={() => onAdd('plan_to_watch')}
                  disabled={adding}
                >
                  <Text style={styles.btnOutlineText}>Watchlist</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnOutline, adding && { opacity: 0.5 }]}
                  onPress={() => setPickingYear(true)}
                  disabled={adding}
                >
                  <Text style={styles.btnOutlineText}>Watched</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Home screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const posterW = (screenW - POSTER_SIDE_PAD * 2 - POSTER_GAP * 2) / 3;
  const greeting = useGreeting();
  const profile = useProfile();
  const queryClient = useQueryClient();

  const scrollRef = useRef<ScrollView>(null);
  const watchingY = useRef(0);
  const watchedY = useRef(0);

  const { data: watching } = useListEntries({ status: 'watching' } as any);
  const { data: watchlist } = useListEntries({ status: 'plan_to_watch' } as any);
  const { data: completed, isLoading } = useListEntries({ status: 'completed' } as any);
  const createEntry = useCreateEntry();

  const watchedCount  = (completed as any[])?.length ?? 0;
  const watchingCount = (watching as any[])?.length ?? 0;
  const queueCount    = (watchlist as any[])?.length ?? 0;
  const yearGroups    = groupByYear((completed as any[]) ?? []);

  const { results: recs, loading: recsLoading, refetch: refetchRecs } = useRecommendations();
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [addingRec, setAddingRec] = useState<RecItem | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async (status: 'watching' | 'plan_to_watch' | 'completed', year?: number) => {
    if (!addingRec) return;
    setAdding(true);
    createEntry.mutate(
      {
        data: {
          title: addingRec.title, type: addingRec.type, status,
          posterUrl: addingRec.posterUrl ?? undefined,
          tmdbId: addingRec.tmdbId, year: addingRec.year ?? undefined,
          dateWatched: status === 'completed' ? `${year ?? new Date().getFullYear()}-01-01` : undefined,
        } as any,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          setAddingRec(null);
        },
        onSettled: () => setAdding(false),
      },
    );
  };

  const handleSkip = (tmdbId: number) => {
    setSkipped(prev => new Set([...prev, tmdbId]));
    if (addingRec?.tmdbId === tmdbId) setAddingRec(null);
    const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
    fetch(`https://${domain}/api/recommendations/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbId, signal: 'skip' }),
    }).catch(() => {});
  };

  const visibleRecs = recs.filter(r => !skipped.has(r.tmdbId));

  // Avatar
  const { avatarId, avatarUrl, firstName } = profile ?? {};
  const avatarSource: any =
    avatarUrl ? { uri: avatarUrl }
    : avatarId ? AVATAR_MAP[avatarId]
    : require('@/assets/images/spud.png');
  const avatarResizeMode = avatarUrl ? 'cover' : 'contain';

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF3E8' }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Image
            source={require('@/assets/images/spud-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <View style={styles.avatarCircle}>
              <Image source={avatarSource} style={styles.avatarImg} resizeMode={avatarResizeMode as any} />
            </View>
            <View style={styles.profilePill}>
              <Text style={styles.profilePillText}>My Profile</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Hero stats card ── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroGreeting}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>
          <Text style={styles.heroSub}>Welcome back to your personal TV &amp; movie library.</Text>
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statChip}
              activeOpacity={0.75}
              onPress={() => scrollRef.current?.scrollTo({ y: watchedY.current - 8, animated: true })}
            >
              <Text style={styles.statNum}>{watchedCount}</Text>
              <Text style={styles.statLabel}>Watched</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statChip}
              activeOpacity={0.75}
              onPress={() => scrollRef.current?.scrollTo({ y: watchingY.current - 8, animated: true })}
            >
              <Text style={styles.statNum}>{watchingCount}</Text>
              <Text style={styles.statLabel}>Watching</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statChip}
              onPress={() => router.push('/(tabs)/watchlist')}
              activeOpacity={0.75}
            >
              <Text style={styles.statNum}>{queueCount}</Text>
              <Text style={styles.statLabel}>Watchlist</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Currently Watching ── */}
        <View
          style={styles.section}
          onLayout={e => { watchingY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>Currently Watching</Text>
        </View>
        {watchingCount > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselPad}>
            {(watching as any[])!.map((entry: any) => (
              <HorizPoster
                key={entry.id}
                entry={entry}
                onPress={() => { Haptics.selectionAsync(); router.push(('/entry/' + entry.id) as any); }}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.emptyNote, { marginHorizontal: 20, marginBottom: 20 }]}>
            Nothing here yet. We've got some serious watching to do.
          </Text>
        )}

        {/* ── Recommendations ── */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Based on what you've watched</Text>
          {watchedCount > 0 && (
            <View style={styles.pickedPill}>
              <Text style={styles.pickedPillText}>Picked for you</Text>
            </View>
          )}
        </View>

        {watchedCount === 0 ? (
          <Text style={[styles.emptyNote, { marginHorizontal: 20, marginBottom: 20 }]}>
            Spud needs to know your taste first. Add a few things you've watched and recommendations will appear here.
          </Text>
        ) : recsLoading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselPad}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.horizCard, { opacity: 0.4 }]}>
                <View style={[styles.horizPoster, { backgroundColor: '#EFE4D2' }]} />
                <View style={{ height: 10, borderRadius: 5, backgroundColor: '#EFE4D2', marginTop: 6, width: 80 }} />
              </View>
            ))}
          </ScrollView>
        ) : visibleRecs.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselPad}>
              {visibleRecs.map(rec => (
                <RecCard
                  key={rec.tmdbId}
                  rec={rec}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAddingRec(rec); }}
                  onSkip={() => handleSkip(rec.tmdbId)}
                />
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refetchRecs(); }}
              activeOpacity={0.7}
            >
              <Feather name="refresh-cw" size={12} color="#116149" />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {/* ── Watchlist banner ── */}
        {queueCount > 0 && (
          <TouchableOpacity
            style={styles.watchlistBanner}
            onPress={() => router.push('/(tabs)/watchlist')}
            activeOpacity={0.85}
          >
            <Feather name="bookmark" size={18} color="#6B46C1" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>
                {queueCount} title{queueCount !== 1 ? 's' : ''} in your watchlist
              </Text>
              <Text style={styles.bannerSub}>Tap to see what's up next →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Watched by year ── */}
        <View
          style={[styles.section, { marginTop: 8 }]}
          onLayout={e => { watchedY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>Watched</Text>
        </View>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color="#116149" size="large" />
          </View>
        ) : yearGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyNote}>
              Well, this is awkward… nothing here yet. Start tracking what you've watched!
            </Text>
            <Image
              source={require('@/assets/images/spud-sleeping.png')}
              style={{ width: 200, height: 200, marginVertical: 20 }}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.findBtn}
              onPress={() => router.push('/(tabs)/search')}
              activeOpacity={0.85}
            >
              <Text style={styles.findBtnText}>Find something to watch</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {yearGroups.map(([year, entries]) => (
              <View key={year} style={{ marginBottom: 24 }}>
                <YearPill year={year} />
                {/* 3-column grid */}
                {Array.from({ length: Math.ceil(entries.length / 3) }, (_, row) => (
                  <View key={row} style={styles.gridRow}>
                    {entries.slice(row * 3, row * 3 + 3).map((entry: any) => (
                      <PosterThumb
                        key={entry.id}
                        entry={entry}
                        posterW={posterW}
                        onPress={() => { Haptics.selectionAsync(); router.push(('/entry/' + entry.id) as any); }}
                      />
                    ))}
                    {/* Fill empty cells */}
                    {entries.slice(row * 3, row * 3 + 3).length < 3 &&
                      Array.from({ length: 3 - entries.slice(row * 3, row * 3 + 3).length }, (_, i) => (
                        <View key={'empty-' + i} style={{ width: posterW }} />
                      ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/search'); }}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={28} color="#116149" />
      </TouchableOpacity>

      {/* ── Quick-add sheet ── */}
      <QuickAddSheet
        rec={addingRec}
        onClose={() => setAddingRec(null)}
        onAdd={handleAdd}
        adding={adding}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logo: { height: 120, width: 240 },
  avatarBtn: { alignItems: 'center', gap: 4 },
  avatarCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#EFE4D2', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 76, height: 76 },
  profilePill: {
    backgroundColor: '#FFD34D', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  profilePillText: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: '#111111' },

  heroCard: {
    backgroundColor: '#4A1020',
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
  },
  heroGreeting: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: '#ffffff', marginBottom: 2 },
  heroSub: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#FFD6E7', opacity: 0.7, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statChip: {
    flex: 1, backgroundColor: '#FFD6E7', borderRadius: 16, padding: 12,
  },
  statNum: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: '#4A1020' },
  statLabel: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: '#4A1020', opacity: 0.7, marginTop: 2 },

  section: { paddingHorizontal: 20, marginBottom: 10, gap: 6 },
  sectionTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#111111' },
  emptyNote: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },

  carouselPad: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },

  horizCard: { width: 108 },
  horizPoster: {
    width: 108, height: 162, borderRadius: 12,
    backgroundColor: '#EFE4D2', overflow: 'hidden',
    marginBottom: 6,
  },
  horizTitle: {
    fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: '#111111', lineHeight: 16,
  },
  horizMeta: { fontSize: 10, fontFamily: 'Manrope_400Regular', color: '#7E7A73', marginTop: 2 },
  horizStars: { fontSize: 10, color: '#FFD34D', marginTop: 2 },
  skipBtn: {
    position: 'absolute', bottom: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  pickedPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#6B46C1', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  pickedPillText: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', marginRight: 20, marginTop: 8,
    backgroundColor: '#EFE4D2', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  refreshText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: '#116149' },

  watchlistBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 20, marginTop: 8,
    backgroundColor: '#C5B8FF',
    borderWidth: 2, borderColor: '#6B46C1', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  bannerTitle: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#6B46C1' },
  bannerSub: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: '#6B46C1', opacity: 0.7 },

  gridRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  posterThumb: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#EFE4D2', marginBottom: 4 },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE4D2' },
  posterTitle: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: '#111111', marginTop: 2 },
  posterStars: { fontSize: 10, color: '#FFD34D' },
  posterStarsRow: { flexDirection: 'row', gap: 1, marginTop: 2 },
  posterStar: { fontSize: 11 },

  yearPillWrap: { marginBottom: 10, marginTop: 4 },
  yearPill: {
    alignSelf: 'flex-start', backgroundColor: '#FFD34D', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  yearPillText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#111111' },

  emptyState: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  findBtn: {
    backgroundColor: '#5B50D0', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  findBtnText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#BDECC8',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },

  // Sheet
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 20,
  },
  sheetHeader: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  sheetPoster: { width: 72, height: 100, borderRadius: 12 },
  sheetTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold', color: '#111111', lineHeight: 22 },
  sheetMeta: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#7E7A73', marginTop: 2 },
  sheetOverview: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#7E7A73', marginTop: 6, lineHeight: 17 },
  sheetLabel: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: '#111111', marginBottom: 8 },
  sheetActions: { gap: 12 },
  sheetRow: { flexDirection: 'row', gap: 12 },
  btnPrimary: {
    flex: 1, backgroundColor: '#116149', borderRadius: 24,
    paddingVertical: 14, alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
  btnOutline: {
    flex: 1, borderRadius: 24, paddingVertical: 14, alignItems: 'center',
    borderWidth: 2, borderColor: '#116149',
  },
  btnOutlineText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#116149' },
  btnSecondary: {
    flex: 1, borderRadius: 24, paddingVertical: 14, alignItems: 'center',
    borderWidth: 2, borderColor: '#E2D9CE',
  },
  btnSecondaryText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#7E7A73' },
  yearScroll: { maxHeight: 200, marginBottom: 16 },
  yearRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 12, marginBottom: 4,
  },
  yearRowActive: { backgroundColor: '#116149' },
  yearRowText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: '#111111' },
  yearRowTextActive: { color: '#ffffff' },
});
