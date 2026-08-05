import { useState, useEffect, useCallback } from 'react';
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

// ── TMDB detail types ─────────────────────────────────────────────────────────

interface CastMember {
  name: string;
  character: string;
  profileUrl: string | null;
  order: number;
}

interface TmdbDetail {
  title: string;
  overview: string | null;
  cast: CastMember[];
  directors: { name: string; job: string; profileUrl: string | null }[];
  runtime: number | null;
  releaseYear: number | null;
  voteAverage: number | null;
  genres: string[];
}

// ── useTmdbDetail hook ────────────────────────────────────────────────────────

function useTmdbDetail(tmdbId: number | null | undefined, type: string | undefined) {
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tmdbId || !type) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;

    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const url = `https://${domain}/api/tmdb/${mediaType}/${tmdbId}`;

    setLoading(true);
    authFetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TmdbDetail | null) => {
        if (data) setDetail(data);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
  }, [tmdbId, type]);

  return { detail, loading };
}

// ── useSeasonCount hook ───────────────────────────────────────────────────────

function useSeasonCount(tmdbId: number | null | undefined, type: string | undefined) {
  const [seasonCount, setSeasonCount] = useState<number | null>(null);

  useEffect(() => {
    if (!tmdbId || type !== 'show') { setSeasonCount(null); return; }
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;

    authFetch(`https://${domain}/api/tmdb/show/${tmdbId}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { numberOfSeasons?: number }) => setSeasonCount(d.numberOfSeasons ?? null))
      .catch(() => {});
  }, [tmdbId, type]);

  return seasonCount;
}

// ── Season types ──────────────────────────────────────────────────────────────

interface Season {
  number: number;
  status: string;
  dateWatched?: string | null;
  rating?: number | null;
}

// ── SeasonRow component ───────────────────────────────────────────────────────

interface SeasonRowProps {
  num: number;
  season: Season | undefined;
  onToggle: (num: number) => void;
  onRate: (num: number, rating: number | null) => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  isPending: boolean;
}

function SeasonRow({ num, season, onToggle, onRate, colors, isPending }: SeasonRowProps) {
  const isWatched = season?.status === 'watched';
  const currentRating = season?.rating ?? 0;

  return (
    <View style={[seasonStyles.row, { borderColor: colors.border }]}>
      {/* Season number + toggle */}
      <TouchableOpacity
        style={[
          seasonStyles.toggleBtn,
          { backgroundColor: isWatched ? colors.primary : colors.muted },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          onToggle(num);
        }}
        disabled={isPending}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Feather
          name={isWatched ? 'check' : 'circle'}
          size={16}
          color={isWatched ? colors.primaryForeground : colors.mutedForeground}
        />
      </TouchableOpacity>

      <Text style={[seasonStyles.label, { color: isWatched ? colors.foreground : colors.mutedForeground }]}>
        Season {num}
      </Text>

      {/* Star rating — only visible when watched */}
      {isWatched && (
        <View style={seasonStyles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => {
                Haptics.selectionAsync();
                onRate(num, currentRating === star ? null : star);
              }}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              disabled={isPending}
            >
              <Feather
                name="star"
                size={18}
                color={star <= currentRating ? colors.primary : colors.border}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const seasonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
  },
  stars: {
    flexDirection: 'row',
    gap: 3,
  },
});

// ── Status chip config ────────────────────────────────────────────────────────

type Status = 'completed' | 'watching' | 'plan_to_watch';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'completed', label: 'Watched' },
  { value: 'watching', label: 'Watching' },
  { value: 'plan_to_watch', label: 'Watchlist' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded } = useAuth();

  // Guard: deep-link cold-starts bypass the tabs layout auth guard
  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const { data: entry, isLoading } = useGetEntry(Number(id));
  const { detail: tmdbDetail, loading: tmdbLoading } = useTmdbDetail(
    entry?.tmdbId,
    entry?.type
  );
  const seasonCount = useSeasonCount(entry?.tmdbId, entry?.type);

  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editRating, setEditRating] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [instagramAvailable, setInstagramAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      // iOS: LSApplicationQueriesSchemes in app.json lets us check reliably
      Linking.canOpenURL('instagram://app')
        .then(setInstagramAvailable)
        .catch(() => setInstagramAvailable(false));
    } else {
      // Android: canOpenURL for custom schemes needs <queries> manifest entry
      // which isn't added in managed workflow; shareAsync handles missing apps
      // gracefully so just enable the option and let the share sheet decide.
      setInstagramAvailable(true);
    }
  }, []);

  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  // ── Season handlers ─────────────────────────────────────────────────────────

  const getSeasonsArray = useCallback((): Season[] => {
    return ((entry as any)?.seasons ?? []) as Season[];
  }, [entry]);

  function toggleSeason(num: number) {
    if (!entry) return;
    const seasons = getSeasonsArray();
    const isWatched = seasons.some((s) => s.number === num && s.status === 'watched');
    const today = new Date().toISOString().split('T')[0];
    const updated = isWatched
      ? seasons.filter((s) => s.number !== num)
      : [...seasons.filter((s) => s.number !== num), { number: num, status: 'watched', dateWatched: today }];
    updateEntry.mutate(
      { id: Number(id), data: { seasons: updated } as any },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(Number(id)) }) }
    );
  }

  function rateSeasonFn(num: number, rating: number | null) {
    if (!entry) return;
    const seasons = getSeasonsArray();
    const updated = seasons.map((s) => s.number === num ? { ...s, rating } : s);
    updateEntry.mutate(
      { id: Number(id), data: { seasons: updated } as any },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(Number(id)) }) }
    );
  }

  // ── Start editing ───────────────────────────────────────────────────────────

  function startEditing() {
    if (!entry) return;
    setEditStatus(entry.status ?? 'completed');
    setEditRating(entry.rating ?? 0);
    setEditNotes(entry.notes ?? '');
    setEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // ── Save handler ────────────────────────────────────────────────────────────

  async function handleSave() {
    try {
      await updateEntry.mutateAsync({
        id: Number(id),
        data: {
          status: editStatus as any,
          rating: editRating || undefined,
          notes: editNotes.trim() || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(Number(id)) });
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  }

  // ── Share handlers ──────────────────────────────────────────────────────────

  async function handleShareText() {
    if (!entry) return;
    const yearText = entry.year ? ` (${entry.year})` : '';
    const ratingText = entry.rating ? ` ${'⭐'.repeat(entry.rating)}` : '';
    const actionText =
      entry.status === 'watching'
        ? 'watching'
        : entry.status === 'plan_to_watch'
          ? 'planning to watch'
          : 'watched';
    const typeText = entry.type === 'movie' ? 'movie' : 'show';
    try {
      await Share.share({
        message: `I just ${actionText} the ${typeText} "${entry.title}"${yearText}${ratingText}\n\nTracked on CouchPotato 🥔`,
        title: entry.title,
      });
    } catch {
      // user cancelled or share failed — no-op
    }
  }

  async function handleShareInstagram() {
    if (!entry?.posterUrl) return;
    try {
      // Download poster to a local temp file (expo-file-system v19 new API)
      const tmpPath = Paths.join(Paths.cache, `poster-${entry.id}.jpg`);
      const { status } = await fsDownload(entry.posterUrl, tmpPath);
      if (status !== 200) throw new Error('Download failed');

      // Check whether the system can share files (should always be true on iOS/Android)
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Not supported', 'Sharing is not available on this device.');
        return;
      }

      // Open the native share sheet with the poster — user picks Instagram Stories from there
      await Sharing.shareAsync(tmpPath, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: 'Share poster to Instagram Stories',
      });
    } catch {
      Alert.alert('Error', 'Could not load the poster. Please try again.');
    }
  }

  function handleShare() {
    if (!entry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const hasPoster = !!entry.posterUrl;
    const showInstagram = hasPoster && instagramAvailable;

    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Share text'];
      if (showInstagram) options.push('Share to Instagram Stories');

      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) handleShareText();
          else if (idx === 2 && showInstagram) handleShareInstagram();
        }
      );
    } else {
      // Android — Alert acts as the action sheet
      type AlertBtn = { text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' };
      const buttons: AlertBtn[] = [{ text: 'Share text', onPress: handleShareText }];
      if (showInstagram) {
        buttons.push({ text: 'Share to Instagram Stories', onPress: handleShareInstagram });
      }
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Share', undefined, buttons);
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────────

  async function doDelete() {
    try {
      await deleteEntry.mutateAsync({ id: Number(id) });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey({}) });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to delete entry. Please try again.');
    }
  }

  function confirmDelete() {
    Alert.alert('Delete entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  }

  // ── Status badge color ──────────────────────────────────────────────────────

  function statusBadgeStyle(status: string) {
    if (status === 'completed') {
      return { bg: colors.primary, text: colors.primaryForeground };
    }
    if (status === 'watching') {
      return { bg: '#9BD6FF', text: colors.foreground };
    }
    return { bg: colors.muted, text: colors.mutedForeground };
  }

  function statusLabel(status: string) {
    if (status === 'completed') return 'Completed';
    if (status === 'watching') return 'Watching';
    return 'Plan to watch';
  }

  // ── Loading state ───────────────────────────────────────────────────────────

  if (isLoading || !entry) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const topPad = insets.top + 12;
  const badge = statusBadgeStyle(entry.status);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* Title */}
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Details</Text>

        {/* Right actions */}
        <View style={styles.headerActions}>
          {/* Share */}
          {!editing && (
            <TouchableOpacity
              onPress={handleShare}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="share-2" size={20} color={colors.foreground} />
            </TouchableOpacity>
          )}
          {/* Edit / Save */}
          {editing ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={updateEntry.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {updateEntry.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={startEditing}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="edit-2" size={20} color={colors.foreground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* A) Hero row */}
        <View style={styles.heroRow}>
          {entry.posterUrl ? (
            <Image
              source={{ uri: entry.posterUrl }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: colors.muted }]}>
              <Feather name="film" size={32} color={colors.mutedForeground} />
            </View>
          )}

          <View style={styles.heroInfo}>
            <Text style={[styles.entryTitle, { color: colors.foreground }]} numberOfLines={3}>
              {entry.title}
            </Text>

            <View style={styles.pillRow}>
              <View style={[styles.typePill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.typePillText, { color: colors.mutedForeground }]}>
                  {entry.type === 'movie' ? 'Movie' : 'Show'}
                </Text>
              </View>
            </View>

            {entry.year != null && (
              <Text style={[styles.yearText, { color: colors.mutedForeground }]}>
                {entry.year}
              </Text>
            )}

            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                {statusLabel(entry.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* B) Rating */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>RATING</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= (editing ? editRating : (entry.rating ?? 0));
              return (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    if (!editing) return;
                    Haptics.selectionAsync();
                    setEditRating(editRating === star ? 0 : star);
                  }}
                  disabled={!editing}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Feather
                    name="star"
                    size={28}
                    color={filled ? colors.primary : colors.border}
                    style={styles.starIcon}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* C) Status — edit mode only */}
        {editing && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>STATUS</Text>
            <View style={styles.chipsRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = editStatus === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEditStatus(opt.value);
                    }}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: active ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* D) Notes */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTES</Text>
          {editing ? (
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              placeholder="Add notes…"
              placeholderTextColor={colors.mutedForeground}
              textAlignVertical="top"
            />
          ) : (
            <Text
              style={[
                styles.notesText,
                {
                  color: entry.notes ? colors.foreground : colors.mutedForeground,
                },
              ]}
            >
              {entry.notes || 'No notes added'}
            </Text>
          )}
        </View>

        {/* E) Plot summary — TMDB overview preferred, entry.synopsis as fallback */}
        {(() => {
          const plot = tmdbDetail?.overview || entry.synopsis;
          if (!plot && !tmdbLoading) return null;
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PLOT SUMMARY</Text>
              {tmdbLoading && !plot ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
              ) : (
                <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>
                  {plot}
                </Text>
              )}
            </View>
          );
        })()}

        {/* F) Cast — from TMDB */}
        {(tmdbLoading || (tmdbDetail && tmdbDetail.cast.length > 0)) && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CAST</Text>
            {tmdbLoading && !tmdbDetail ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
            ) : (
              <FlatList
                data={tmdbDetail?.cast ?? []}
                keyExtractor={(item, i) => `${item.name}-${i}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.castList}
                renderItem={({ item }) => (
                  <View style={styles.castCard}>
                    {item.profileUrl ? (
                      <Image
                        source={{ uri: item.profileUrl }}
                        style={[styles.castPhoto, { backgroundColor: colors.muted }]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.castPhoto, styles.castPhotoPlaceholder, { backgroundColor: colors.muted }]}>
                        <Feather name="user" size={22} color={colors.mutedForeground} />
                      </View>
                    )}
                    <Text style={[styles.castName, { color: colors.foreground }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.character ? (
                      <Text style={[styles.castCharacter, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {item.character}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            )}
          </View>
        )}

        {/* G) Directors / Creators — from TMDB */}
        {tmdbDetail && tmdbDetail.directors.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {entry.type === 'movie' ? 'DIRECTOR' : 'CREATOR'}
            </Text>
            <View style={styles.directorRow}>
              {tmdbDetail.directors.map((d, i) => (
                <Text key={i} style={[styles.directorName, { color: colors.foreground }]}>
                  {d.name}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* H) Season Tracker — shows only */}
        {entry.type === 'show' && seasonCount != null && seasonCount > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              SEASONS
            </Text>
            <View style={[styles.seasonsContainer, { borderColor: colors.border }]}>
              {Array.from({ length: seasonCount }, (_, i) => i + 1).map((num) => {
                const seasons = getSeasonsArray();
                const seasonData = seasons.find((s) => s.number === num);
                return (
                  <SeasonRow
                    key={num}
                    num={num}
                    season={seasonData}
                    onToggle={toggleSeason}
                    onRate={rateSeasonFn}
                    colors={colors}
                    isPending={updateEntry.isPending}
                  />
                );
              })}
            </View>
            <Text style={[styles.seasonsProgress, { color: colors.mutedForeground }]}>
              {getSeasonsArray().filter((s) => s.status === 'watched').length} of {seasonCount} watched
            </Text>
          </View>
        )}

        {/* I) Delete button */}
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: '#e53e3e' }]}
          onPress={confirmDelete}
          disabled={deleteEntry.isPending}
        >
          {deleteEntry.isPending ? (
            <ActivityIndicator size="small" color="#e53e3e" />
          ) : (
            <Text style={styles.deleteText}>Delete entry</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerActions: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
  },
  saveText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
  },

  // Hero
  heroRow: {
    flexDirection: 'row',
    gap: 16,
  },
  poster: {
    width: 110,
    height: 165,
    borderRadius: 10,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },
  entryTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    lineHeight: 24,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typePillText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },
  yearText: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },

  // Section
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.8,
  },

  // Stars
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  starIcon: {
    marginRight: 2,
  },

  // Status chips
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
  },

  // Notes
  notesText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 21,
  },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 21,
  },

  // Synopsis / plot
  synopsisText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 21,
  },

  // Cast
  castList: {
    gap: 14,
    paddingVertical: 4,
  },
  castCard: {
    width: 80,
    alignItems: 'center',
    gap: 6,
  },
  castPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  castPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  castName: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    textAlign: 'center',
    lineHeight: 16,
  },
  castCharacter: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    lineHeight: 15,
  },

  // Directors
  directorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  directorName: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
  },

  // Seasons
  seasonsContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  seasonsProgress: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    marginTop: 4,
  },

  // Delete
  deleteButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: '#e53e3e',
  },
});
