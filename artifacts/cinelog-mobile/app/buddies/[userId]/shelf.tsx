import { useCallback, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openTitleSheet } from '@/utils/titleShare';
import { BuddyError, BuddySkeleton, Poster, buddyColors as c } from '@/components/BuddyUI';
import { buddyQueryKeys, isBuddyAccessError, verifyBuddyFocus, useBuddyEntries, type ShelfStatus } from '@/utils/buddies';

const labels: Record<ShelfStatus, string> = { watching: 'Watching now', plan_to_watch: 'On the watchlist', completed: 'Watched' };
export default function BuddyShelfScreen() {
  const params = useLocalSearchParams<{ userId: string; status: string }>();
  const { userId: accountId } = useAuth();
  const queryClient = useQueryClient();
  const id = typeof params.userId === 'string' ? params.userId : '';
  const status: ShelfStatus = params.status === 'watching' || params.status === 'completed' ? params.status : 'plan_to_watch';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const query = useBuddyEntries(id, status);
  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const accountKey = `${accountId ?? ''}:${id}:${status}`;
  const verifyRefetch = useCallback(() => {
    if (!accountId || !id) return;
    const queryKey = buddyQueryKeys.entries(accountId, id, status);
    const updateCount = queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0;
    void verifyBuddyFocus(
      refetchRef.current,
      () => focusedRef.current,
      () => setVerifiedFor(`${accountId}:${id}:${status}`),
      () => (queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0) > updateCount,
    );
  }, [accountId, id, queryClient, status]);
  useFocusEffect(useCallback(() => {
    setVerifiedFor(null);
    if (!accountId || !id) return;
    focusedRef.current = true;
    verifyRefetch();
    return () => { focusedRef.current = false; };
  }, [accountId, id, status, verifyRefetch]));
  const accessDenied = isBuddyAccessError(query.error);
  const ready = verifiedFor === accountKey && !query.isFetching && !accessDenied;
  const canShowEntries = ready && (!query.isError || (query.isFetchNextPageError && !accessDenied));
  const items = canShowEntries ? query.data?.pages.flatMap(page => page.items) ?? [] : [];
  const posterWidth = Math.floor((width - 40 - 24) / 3);
  return <View style={styles.screen}>
    <FlatList data={items} keyExtractor={(item, i) => `${item.tmdbId}-${i}`} numColumns={3}
      columnWrapperStyle={styles.columns} contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 10), paddingBottom: insets.bottom + 45 }]}
      renderItem={({ item }) => <Poster item={item} width={posterWidth} onPress={() => void openTitleSheet({ title: item.title, type: item.type, tmdbId: item.tmdbId }, path => router.push(path as any))} />}
       onEndReached={() => { if (ready && !query.isFetching && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }} onEndReachedThreshold={0.5}
      ListHeaderComponent={<View>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Back to buddy profile"><Feather name="arrow-left" size={22} color={c.lime} /></TouchableOpacity>
        <Text style={styles.kicker}>BUDDY’S SHELF</Text><Text style={styles.title}>{labels[status]}</Text>
        <Text style={styles.count}>{canShowEntries ? query.data?.pages[0]?.total ?? 0 : '—'} titles</Text>
        {(!ready && (!query.isError || query.isFetching)) || query.isPending ? <BuddySkeleton /> : null}
        {query.isError && !query.isFetching && (!query.isFetchNextPageError || accessDenied) && <BuddyError message={query.error.message} retry={verifyRefetch} />}
        {ready && !query.isPending && !query.isError && !items.length && <View style={styles.empty}><Feather name="film" size={24} color={c.lime} /><Text style={styles.emptyText}>Nothing on this shelf yet.</Text></View>}
      </View>}
      ListFooterComponent={query.isFetchingNextPage ? <BuddySkeleton /> :
         query.isFetchNextPageError ? <BuddyError message={accessDenied ? query.error.message : 'Could not load more titles.'} retry={() => {
           if (accessDenied) verifyRefetch();
           else if (ready && !query.isFetching) void query.fetchNextPage();
         }} /> : null}
    />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 20 },
  columns: { justifyContent: 'space-between', marginBottom: 17 },
  back: { alignSelf: 'flex-start', paddingVertical: 12, paddingRight: 20, marginBottom: 18 },
  kicker: { color: c.lime, fontSize: 10, letterSpacing: 1.3, fontFamily: 'Manrope_700Bold' },
  title: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 28, marginTop: 5 },
  count: { color: c.muted, fontFamily: 'Manrope_500Medium', fontSize: 13, marginTop: 5, marginBottom: 26 },
  empty: { backgroundColor: c.panel, borderRadius: 16, padding: 24, alignItems: 'center', gap: 10 },
  emptyText: { color: c.muted, fontFamily: 'Manrope_500Medium', fontSize: 13 },
});