import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { StarRating } from '@/components/StarRating';
import { useColors } from '@/hooks/useColors';
import {
  useCreateEntry,
  useListEntries,
  getListEntriesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import type { TmdbResult } from '@workspace/api-client-react';

const STATUS_OPTIONS = [
  { value: 'completed' as const, label: 'Completed' },
  { value: 'watching' as const, label: 'Watching' },
  { value: 'plan_to_watch' as const, label: 'Plan to Watch' },
];

export default function LogEntryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'movie' | 'show'>('movie');
  const [status, setStatus] = useState<'completed' | 'watching' | 'plan_to_watch'>('completed');
  const [rating, setRating] = useState<number>(0);
  const [dateWatched, setDateWatched] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

  // TMDB search state
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tmdbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createEntry = useCreateEntry();
  const isSaving = createEntry.isPending;

  // Pre-fill today's date when status is completed
  useEffect(() => {
    if (status === 'completed' && !dateWatched) {
      const today = new Date().toISOString().split('T')[0];
      setDateWatched(today);
    }
  }, [status]);

  // Debounced TMDB search
  const handleTitleChange = (text: string) => {
    setTitle(text);
    setSelectedTmdb(null);

    if (tmdbTimerRef.current) clearTimeout(tmdbTimerRef.current);
    if (text.length < 2) {
      setTmdbResults([]);
      setShowSuggestions(false);
      return;
    }

    tmdbTimerRef.current = setTimeout(async () => {
      setTmdbLoading(true);
      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const base = domain ? `https://${domain}` : '';
        const res = await fetch(`${base}/api/tmdb/search?q=${encodeURIComponent(text)}`);
        if (res.ok) {
          const data = await res.json();
          setTmdbResults(data.results?.slice(0, 5) ?? []);
          setShowSuggestions(true);
        }
      } catch {
        // TMDB unavailable — continue with manual entry
      } finally {
        setTmdbLoading(false);
      }
    }, 500);
  };

  const handleSelectTmdb = (result: TmdbResult) => {
    Haptics.selectionAsync();
    setSelectedTmdb(result);
    setTitle(result.title);
    setType(result.type);
    setShowSuggestions(false);
    setTmdbResults([]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title before saving.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await createEntry.mutateAsync({
        data: {
          title: title.trim(),
          type,
          status,
          rating: rating > 0 ? rating : undefined,
          dateWatched: dateWatched || undefined,
          notes: notes.trim() || undefined,
          tags: tagList,
          tmdbId: selectedTmdb?.tmdbId ?? undefined,
          posterUrl: selectedTmdb?.posterUrl ?? undefined,
          synopsis: selectedTmdb?.overview ?? undefined,
        },
      });

      // Invalidate entries queries so home refreshes
      qc.invalidateQueries({ queryKey: ['/api/entries'] });
      qc.invalidateQueries({ queryKey: ['/api/years'] });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Could not save entry. Please try again.');
    }
  };

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Log Entry</Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        contentContainerStyle={[styles.form, { paddingBottom: bottomPad + 40 }]}
      >
        {/* Title + TMDB search */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>TITLE</Text>
        <View style={[styles.inputRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          <TextInput
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Movie or show title…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Manrope_400Regular' }]}
            autoFocus
          />
          {tmdbLoading && <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginRight: 10 }} />}
        </View>

        {/* TMDB suggestions */}
        {showSuggestions && tmdbResults.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {tmdbResults.map((result) => (
              <Pressable
                key={result.tmdbId}
                onPress={() => handleSelectTmdb(result)}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {result.posterUrl && (
                  <Image
                    source={{ uri: result.posterUrl }}
                    style={styles.suggestionPoster}
                    contentFit="cover"
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggestionTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {result.title}
                  </Text>
                  <Text style={[styles.suggestionMeta, { color: colors.mutedForeground }]}>
                    {result.type === 'movie' ? 'Movie' : 'Show'}{result.year ? ` • ${result.year}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Selected TMDB preview */}
        {selectedTmdb && (
          <View style={[styles.tmdbSelected, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <Feather name="check-circle" size={14} color={colors.primary} />
            <Text style={[styles.tmdbSelectedText, { color: colors.primary }]}>
              Matched: {selectedTmdb.title} {selectedTmdb.year ? `(${selectedTmdb.year})` : ''}
            </Text>
          </View>
        )}

        {/* Type toggle */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>TYPE</Text>
        <View style={[styles.toggleRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          {(['movie', 'show'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { Haptics.selectionAsync(); setType(t); }}
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: type === t ? colors.primary : 'transparent',
                  borderRadius: colors.radius - 4,
                },
              ]}
            >
              <Feather name={t === 'movie' ? 'film' : 'tv'} size={14} color={type === t ? colors.primaryForeground : colors.mutedForeground} style={{ marginRight: 5 }} />
              <Text style={[styles.toggleText, { color: type === t ? colors.primaryForeground : colors.mutedForeground }]}>
                {t === 'movie' ? 'Movie' : 'Show'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Status */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>STATUS</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((s) => (
            <Pressable
              key={s.value}
              onPress={() => { Haptics.selectionAsync(); setStatus(s.value); }}
              style={[
                styles.statusBtn,
                {
                  backgroundColor: status === s.value ? colors.primary : colors.muted,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[styles.statusText, { color: status === s.value ? colors.primaryForeground : colors.mutedForeground }]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Rating */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>RATING</Text>
        <StarRating value={rating} onChange={setRating} size={28} />

        {/* Date watched */}
        {(status === 'completed' || status === 'watching') && (
          <>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {status === 'completed' ? 'DATE WATCHED' : 'DATE STARTED'}
            </Text>
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
          </>
        )}

        {/* Tags */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>TAGS (comma separated)</Text>
        <View style={[styles.inputRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="sci-fi, drama, favourite…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Manrope_400Regular' }]}
            autoCapitalize="none"
          />
        </View>

        {/* Notes */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES</Text>
        <View style={[styles.inputRow, styles.notesInput, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Your thoughts…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Manrope_400Regular', textAlignVertical: 'top' }]}
            multiline
            numberOfLines={4}
          />
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    marginHorizontal: 8,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notesInput: { alignItems: 'flex-start', minHeight: 100 },
  textInput: { flex: 1, fontSize: 15, padding: 0 },
  suggestions: {
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  suggestionPoster: { width: 32, height: 48, borderRadius: 4 },
  suggestionTitle: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  suggestionMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  tmdbSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  tmdbSelectedText: { fontSize: 12, fontFamily: 'Manrope_500Medium' },
  toggleRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  toggleText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  statusText: { fontSize: 13, fontFamily: 'Manrope_500Medium' },
});
