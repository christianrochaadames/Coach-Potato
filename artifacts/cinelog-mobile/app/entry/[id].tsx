import { useState } from 'react';
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
} from 'react-native';
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

  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editRating, setEditRating] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');

  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

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

  // ── Share handler ───────────────────────────────────────────────────────────

  async function handleShare() {
    if (!entry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

        {/* E) Synopsis — view only */}
        {entry.synopsis ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SYNOPSIS</Text>
            <Text style={[styles.synopsisText, { color: colors.mutedForeground }]}>
              {entry.synopsis}
            </Text>
          </View>
        ) : null}

        {/* F) Delete button */}
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

  // Synopsis
  synopsisText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 21,
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
