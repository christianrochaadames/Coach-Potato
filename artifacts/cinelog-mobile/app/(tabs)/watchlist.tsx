import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, Platform, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useListEntries } from '@workspace/api-client-react';
import { QuickLogSheet, TmdbItem } from './search';

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const cardBottomGap = Platform.OS === 'web' ? 76 : 20;

  const { data, isLoading, refetch, isRefetching } = useListEntries({ status: 'plan_to_watch' } as any);
  const watchlist: any[] = (data as any[]) ?? [];
  const [selectedItem, setSelectedItem] = useState<TmdbItem | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [savedNoticeVisible, setSavedNoticeVisible] = useState(false);

  const openDetailSheet = (item: any) => {
    setSelectedItem({
      tmdbId: Number(item.tmdbId),
      title: item.title,
      type: item.type === 'movie' ? 'movie' : 'show',
      year: item.year ?? null,
      posterUrl: item.posterUrl ?? null,
      overview: item.synopsis ?? null,
    });
    setSelectedEntryId(Number(item.id));
    setSheetVisible(true);
  };

  const closeDetailSheet = () => {
    setSheetVisible(false);
    setTimeout(() => {
      setSelectedItem(null);
      setSelectedEntryId(null);
    }, 300);
  };

  const handleSaved = () => {
    setSavedNoticeVisible(true);
    closeDetailSheet();
    setTimeout(() => setSavedNoticeVisible(false), 2200);
  };

  return (
    <View style={styles.container}>
      {/* ── Inner purple card ── */}
      <View style={[styles.innerCard, { marginTop: insets.top + 12, marginBottom: cardBottomGap }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Watchlist</Text>
          <Text style={styles.subtitle}>Your carefully planned future couch time.</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6B46C1" size="large" />
        </View>
      ) : watchlist.length === 0 ? (
        <View style={styles.center}>
          <Image
            source={require('@/assets/images/spud-watchlist-phone.png')}
            style={styles.emptyMascot}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>
            Add TV shows or movies you want to{'\n'}
            watch, and they will appear here.
          </Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => router.push('/(tabs)/search')}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaText}>Browse TV shows &amp; movies</Text>
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
              onPress={() => { Haptics.selectionAsync(); openDetailSheet(item); }}
              activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Open details for ${item.title}`}
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
                    {item.year ?? (item.type === 'movie' ? 'Movie' : 'TV show')}
                  </Text>
              </View>

              <View style={styles.cardArrow} pointerEvents="none">
                <Feather name="chevron-right" size={19} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      </View>{/* end innerCard */}

      <QuickLogSheet
        item={selectedItem}
        visible={sheetVisible}
        onClose={closeDetailSheet}
        onSaved={handleSaved}
        insets={insets}
        initialStatus="plan_to_watch"
        entryId={selectedEntryId}
        canDelete
        onDeleted={() => { void refetch(); }}
      />
      {savedNoticeVisible ? (
        <View style={styles.savedToast} pointerEvents="none">
          <Text style={styles.savedToastText}>Saved</Text>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E4DFEF' },
  innerCard: {
    flex: 1,
    backgroundColor: '#C5B8FF',
    borderRadius: 24,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', color: '#3B3275' },
  subtitle: {
    fontSize: 15, lineHeight: 21,
    fontFamily: 'Manrope_400Regular', color: '#6B46C1', marginTop: 2,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: '#111111', textAlign: 'center' },
  emptyBody: {
    fontSize: 14, fontFamily: 'Manrope_400Regular', color: '#6B46C1',
    textAlign: 'center', lineHeight: 20,
  },
  emptyMascot: { width: 300, height: 300, marginBottom: 8 },
  cta: {
    backgroundColor: '#6B46C1', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 4,
  },
  ctaText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 16, marginBottom: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#6B46C1', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  poster: { width: 56, height: 80, borderRadius: 12 },
  posterPlaceholder: { backgroundColor: '#EFE4D2', alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginLeft: 12, marginRight: 4, gap: 4 },
  cardTitle: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: '#111111', lineHeight: 20 },
  cardMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  cardArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FF4BAE',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginLeft: 8,
  },
  savedToast: {
    position: 'absolute', top: '44%', alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 999, backgroundColor: '#FF4BAE',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 5,
  },
  savedToastText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
});
