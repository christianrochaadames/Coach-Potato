import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, Platform, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListEntries, useUpdateEntry, useDeleteEntry,
  getListEntriesQueryKey, getListYearsQueryKey,
} from '@workspace/api-client-react';

const CUR_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 60 }, (_, i) => CUR_YEAR - i);

interface WatchedModalState { id: number; title: string; year: number; rating: number }

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [watchedModal, setWatchedModal] = useState<WatchedModalState | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  const { data, isLoading, refetch, isRefetching } = useListEntries({ status: 'plan_to_watch' } as any);
  const watchlist: any[] = (data as any[]) ?? [];

  const handleStart = async (id: number) => {
    setUpdatingId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateEntry.mutateAsync({ id, data: { status: 'watching' } as any });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
    } finally { setUpdatingId(null); }
  };

  const openWatchedModal = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWatchedModal({ id: item.id, title: item.title, year: item.year ?? CUR_YEAR, rating: 0 });
  };

  const handleRemove = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await deleteEntry.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally { setConfirmRemoveId(null); }
  };

  const confirmWatched = async () => {
    if (!watchedModal) return;
    const { id, year, rating } = watchedModal;
    setWatchedModal(null);
    setUpdatingId(id);
    try {
      await updateEntry.mutateAsync({
        id,
        data: {
          status: 'completed',
          dateWatched: `${year}-01-01`,
          rating: rating > 0 ? rating : undefined,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally { setUpdatingId(null); }
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Watchlist</Text>
          <Text style={styles.subtitle}>
            {watchlist.length > 0
              ? `${watchlist.length} title${watchlist.length !== 1 ? 's' : ''} saved`
              : 'Up next'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/log-entry'); }}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color="#6B46C1" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6B46C1" size="large" />
        </View>
      ) : watchlist.length === 0 ? (
        <View style={styles.center}>
          <Image
            source={require('@/assets/images/spud-watchlist.png')}
            style={{ width: 180, height: 180, marginBottom: 20 }}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>
            Add titles you want to watch and they'll appear here.
          </Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => router.push('/(tabs)/search')}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaText}>Browse &amp; add titles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={watchlist}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16, paddingBottom: insets.bottom + 100, paddingTop: 8,
          }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => { Haptics.selectionAsync(); router.push(('/entry/' + item.id) as any); }}
              activeOpacity={0.8}
            >
              {/* Poster */}
              {item.posterUrl ? (
                <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder]}>
                  <Feather name="film" size={20} color="#EFE4D2" />
                </View>
              )}

              {/* Body */}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.type === 'movie' ? 'Movie' : 'Show'}
                  {item.year ? ` · ${item.year}` : ''}
                </Text>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.pillStart}
                    onPress={() => handleStart(item.id)}
                    activeOpacity={0.8}
                    disabled={updatingId === item.id}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.pillStartText}>▶  Watch</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pillWatched}
                    onPress={() => openWatchedModal(item)}
                    activeOpacity={0.8}
                    disabled={updatingId === item.id}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.pillWatchedText}>✓  Watched</Text>
                    )}
                  </TouchableOpacity>
                  {confirmRemoveId === item.id ? (
                    <TouchableOpacity
                      style={styles.pillConfirmRemove}
                      onPress={() => handleRemove(item.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pillConfirmRemoveText}>Confirm?</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.pillRemove}
                      onPress={() => { Haptics.selectionAsync(); setConfirmRemoveId(item.id); }}
                      activeOpacity={0.8}
                      disabled={updatingId === item.id}
                    >
                      <Feather name="trash-2" size={13} color="#7E7A73" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Feather name="chevron-right" size={14} color="#C5B8FF" style={{ marginRight: 12 }} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Mark as Watched modal ── */}
      {watchedModal && (
        <Modal transparent visible animationType="slide" onRequestClose={() => setWatchedModal(null)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setWatchedModal(null)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle} numberOfLines={2}>{watchedModal.title}</Text>
            <Text style={styles.modalSubtitle}>When did you watch it?</Text>

            {/* Year picker */}
            <Text style={styles.pickerLabel}>YEAR WATCHED</Text>
            <View style={styles.yearRow}>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => { Haptics.selectionAsync(); setWatchedModal(m => m ? { ...m, year: Math.max(1950, m.year - 1) } : m); }}
              >
                <Feather name="minus" size={18} color="#111111" />
              </TouchableOpacity>
              <Text style={styles.yearValue}>{watchedModal.year}</Text>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => { Haptics.selectionAsync(); setWatchedModal(m => m ? { ...m, year: Math.min(CUR_YEAR, m.year + 1) } : m); }}
              >
                <Feather name="plus" size={18} color="#111111" />
              </TouchableOpacity>
            </View>

            {/* Rating */}
            <Text style={styles.pickerLabel}>YOUR RATING (optional)</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => { Haptics.selectionAsync(); setWatchedModal(m => m ? { ...m, rating: m.rating === star ? 0 : star } : m); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather
                    name="star"
                    size={32}
                    color={star <= watchedModal.rating ? '#116149' : '#D4C9BC'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setWatchedModal(null)} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmWatched} activeOpacity={0.8}>
                <Text style={styles.confirmBtnText}>Mark as Watched</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E4DFEF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', color: '#111111' },
  subtitle: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#6B46C1', marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#C5B8FF', alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: '#111111', textAlign: 'center' },
  emptyBody: {
    fontSize: 14, fontFamily: 'Manrope_400Regular', color: '#6B46C1',
    textAlign: 'center', lineHeight: 20,
  },
  cta: {
    backgroundColor: '#6B46C1', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 4,
  },
  ctaText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, marginBottom: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#6B46C1', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  poster: { width: 60, height: 106, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  posterPlaceholder: { backgroundColor: '#C5B8FF', alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  cardTitle: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: '#111111', lineHeight: 20 },
  cardMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pillStart: {
    backgroundColor: '#4A78FF', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pillStartText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#ffffff' },
  pillWatched: {
    backgroundColor: '#FF4BAE', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pillWatchedText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#ffffff' },
  pillRemove: {
    backgroundColor: '#F5F0EA', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center',
  },
  pillConfirmRemove: {
    backgroundColor: '#FFE4E4', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pillConfirmRemoveText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#C0392B' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#D4C9BC',
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18, fontFamily: 'Manrope_700Bold', color: '#111111', marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14, fontFamily: 'Manrope_400Regular', color: '#7E7A73', marginBottom: 20,
  },
  pickerLabel: {
    fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#7E7A73',
    letterSpacing: 0.8, marginBottom: 12,
  },
  yearRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, marginBottom: 24,
  },
  yearBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EFE4D2', alignItems: 'center', justifyContent: 'center',
  },
  yearValue: { fontSize: 32, fontFamily: 'Manrope_700Bold', color: '#111111', minWidth: 80, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  modalActions: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#D4C9BC',
    borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: '#7E7A73' },
  confirmBtn: {
    flex: 2, backgroundColor: '#116149',
    borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
});
