import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { StarRating } from '@/components/StarRating';
import { useColors } from '@/hooks/useColors';
import {
  useGetEntry,
  useUpdateEntry,
  useDeleteEntry,
  getListEntriesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_OPTIONS = [
  { value: 'completed' as const, label: 'Completed' },
  { value: 'watching' as const, label: 'Watching' },
  { value: 'plan_to_watch' as const, label: 'Plan to Watch' },
];

export default function EntryDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const entryId = Number(id);
  const { data: entry, isLoading, isError } = useGetEntry(entryId);
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'movie' | 'show'>('movie');
  const [status, setStatus] = useState<'completed' | 'watching' | 'plan_to_watch'>('completed');
  const [rating, setRating] = useState<number>(0);
  const [dateWatched, setDateWatched] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

  // Sync form from loaded entry
  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setType(entry.type);
      setStatus(entry.status);
      setRating(entry.rating ?? 0);
      setDateWatched(entry.dateWatched ?? '');
      setNotes(entry.notes ?? '');
      setTags(entry.tags.join(', '));
    }
  }, [entry]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await updateEntry.mutateAsync({
        id: entryId,
        data: {
          title: title.trim(),
          type,
          status,
          rating: rating > 0 ? rating : null,
          dateWatched: dateWatched || null,
          notes: notes.trim() || null,
          tags: tagList,
        },
      });
      qc.invalidateQueries({ queryKey: ['/api/entries'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete entry',
      `Are you sure you want to delete "${entry?.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              await deleteEntry.mutateAsync({ id: entryId });
              qc.invalidateQueries({ queryKey: ['/api/entries'] });
              qc.invalidateQueries({ queryKey: ['/api/years'] });
              router.back();
            } catch {
              Alert.alert('Error', 'Could not delete entry.');
            }
          },
        },
      ],
    );
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const statusLabel = STATUS_OPTIONS.find((s) => s.value === entry?.status)?.label ?? '';

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !entry) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={36} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Entry not found</Text>
        <Pressable onPress={() => router.back()} style={[styles.retryBtn, { borderColor: colors.primary }]}>
          <Text style={[styles.retryBtnText, { color: colors.primary }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => { if (isEditing) { setIsEditing(false); } else { router.back(); } }} hitSlop={8}>
          <Feather name={isEditing ? 'x' : 'arrow-left'} size={22} color={colors.foreground} />
        </Pressable>

        <Text style={[styles.toolbarTitle, { color: colors.foreground }]} numberOfLines={1}>
          {isEditing ? 'Edit Entry' : entry.title}
        </Text>

        <View style={styles.toolbarActions}>
          {isEditing ? (
            <Pressable
              onPress={handleSave}
              disabled={updateEntry.isPending}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              {updateEntry.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
              )}
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => setIsEditing(true)} hitSlop={8} style={{ marginRight: 16 }}>
                <Feather name="edit-2" size={20} color={colors.primary} />
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={8}>
                <Feather name="trash-2" size={20} color={colors.destructive} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {isEditing ? (
        /* Edit form */
        <KeyboardAwareScrollViewCompat
          keyboardShouldPersistTaps="handled"
          bottomOffset={20}
          contentContainerStyle={[styles.form, { paddingBottom: bottomPad + 40 }]}
        >
          <Text style={[styles.label, { color: colors.mutedForeground }]}>TITLE</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, { color: colors.foreground, fontFamily: 'Manrope_400Regular' }]}
            />
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>TYPE</Text>
          <View style={[styles.toggleRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            {(['movie', 'show'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => { Haptics.selectionAsync(); setType(t); }}
                style={[
                  styles.toggleBtn,
                  { backgroundColor: type === t ? colors.primary : 'transparent', borderRadius: colors.radius - 4 },
                ]}
              >
                <Feather name={t === 'movie' ? 'film' : 'tv'} size={14} color={type === t ? colors.primaryForeground : colors.mutedForeground} style={{ marginRight: 5 }} />
                <Text style={[styles.toggleText, { color: type === t ? colors.primaryForeground : colors.mutedForeground }]}>
                  {t === 'movie' ? 'Movie' : 'Show'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>STATUS</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((s) => (
              <Pressable
                key={s.value}
                onPress={() => { Haptics.selectionAsync(); setStatus(s.value); }}
                style={[
                  styles.statusBtn,
                  { backgroundColor: status === s.value ? colors.primary : colors.muted, borderRadius: colors.radius },
                ]}
              >
                <Text style={[styles.statusText, { color: status === s.value ? colors.primaryForeground : colors.mutedForeground }]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>RATING</Text>
          <StarRating value={rating} onChange={setRating} size={28} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>DATE WATCHED</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <TextInput
              value={dateWatched}
              onChangeText={setDateWatched}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, { color: colors.foreground, fontFamily: 'Manrope_400Regular' }]}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>TAGS</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <TextInput
              value={tags}
              onChangeText={setTags}
              placeholder="sci-fi, drama…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, { color: colors.foreground, fontFamily: 'Manrope_400Regular' }]}
              autoCapitalize="none"
            />
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES</Text>
          <View style={[styles.inputRow, styles.notesInput, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Your thoughts…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, { color: colors.foreground, fontFamily: 'Manrope_400Regular', textAlignVertical: 'top' }]}
              multiline
              numberOfLines={5}
            />
          </View>
        </KeyboardAwareScrollViewCompat>
      ) : (
        /* View mode */
        <ScrollView contentContainerStyle={[styles.viewContent, { paddingBottom: bottomPad + 24 }]}>
          {/* Poster */}
          <View style={[styles.posterWrapper, { backgroundColor: colors.muted }]}>
            {entry.posterUrl ? (
              <Image
                source={{ uri: entry.posterUrl }}
                style={styles.poster}
                contentFit="cover"
              />
            ) : (
              <View style={styles.posterPlaceholder}>
                <Feather name={entry.type === 'movie' ? 'film' : 'tv'} size={48} color={colors.mutedForeground} />
              </View>
            )}
          </View>

          <View style={styles.detailPad}>
            {/* Title + type */}
            <Text style={[styles.entryTitle, { color: colors.foreground }]}>{entry.title}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.typeBadge, { backgroundColor: entry.type === 'movie' ? colors.secondary : colors.accent }]}>
                <Text style={[styles.typeBadgeText, { color: entry.type === 'movie' ? colors.secondaryForeground : colors.accentForeground }]}>
                  {entry.type === 'movie' ? 'Movie' : 'Show'}
                </Text>
              </View>
              {entry.year && (
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{entry.year}</Text>
              )}
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{statusLabel}</Text>
            </View>

            {/* Rating */}
            <View style={{ marginTop: 10 }}>
              <StarRating value={entry.rating ?? null} size={22} readonly />
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Date */}
            {entry.dateWatched && (
              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.foreground }]}>{entry.dateWatched}</Text>
              </View>
            )}

            {/* Tags */}
            {entry.tags.length > 0 && (
              <View style={styles.detailRow}>
                <Feather name="tag" size={16} color={colors.mutedForeground} />
                <View style={styles.tagWrap}>
                  {entry.tags.map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: colors.muted, borderRadius: 6 }]}>
                      <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Synopsis */}
            {entry.synopsis && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.synopsisLabel, { color: colors.mutedForeground }]}>Synopsis</Text>
                <Text style={[styles.synopsis, { color: colors.foreground }]}>{entry.synopsis}</Text>
              </>
            )}

            {/* Notes */}
            {entry.notes && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.synopsisLabel, { color: colors.mutedForeground }]}>Notes</Text>
                <Text style={[styles.synopsis, { color: colors.foreground }]}>{entry.notes}</Text>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, fontFamily: 'Manrope_600SemiBold' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderRadius: 20 },
  retryBtnText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  toolbarTitle: { flex: 1, fontSize: 16, fontFamily: 'Manrope_700Bold' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, minWidth: 60, alignItems: 'center' },
  saveBtnText: { fontFamily: 'Manrope_700Bold', fontSize: 14 },
  form: { padding: 20, gap: 8 },
  label: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  notesInput: { alignItems: 'flex-start', minHeight: 100 },
  textInput: { flex: 1, fontSize: 15, padding: 0 },
  toggleRow: { flexDirection: 'row', padding: 4, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  toggleText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  statusText: { fontSize: 13, fontFamily: 'Manrope_500Medium' },
  // View mode
  viewContent: { paddingBottom: 40 },
  posterWrapper: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' },
  poster: { width: '100%', height: '100%' },
  posterPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  detailPad: { padding: 20 },
  entryTitle: { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', letterSpacing: -0.5, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontFamily: 'Manrope_700Bold' },
  metaText: { fontSize: 14, fontFamily: 'Manrope_400Regular' },
  divider: { height: 1, marginVertical: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  detailText: { fontSize: 14, fontFamily: 'Manrope_500Medium', flex: 1 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
  synopsisLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5, marginBottom: 6 },
  synopsis: { fontSize: 14, fontFamily: 'Manrope_400Regular', lineHeight: 22 },
});
