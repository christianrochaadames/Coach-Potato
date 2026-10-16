import { useCallback, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { openTitleSheet } from '@/utils/titleShare';
import { BuddyAvatar, BuddyError, BuddySkeleton, Poster, buddyColors as c } from '@/components/BuddyUI';
import { buddyQueryKeys, isBuddyAccessError, verifyBuddyFocus, useBuddyAction, useBuddyDetail, type BuddyStatus, type ShelfStatus } from '@/utils/buddies';

const shelfLabels: Record<ShelfStatus, string> = {
  watching: 'Watching now', plan_to_watch: 'On the watchlist', completed: 'Watched',
};
const messages: Record<string, string> = {
  request: 'Request sent. They’ll see it soon.', accept: 'You’re buddies now.',
  reject: 'Request declined.', cancel: 'Request cancelled.', remove: 'Buddy removed.',
};
export default function BuddyProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { userId: accountId } = useAuth();
  const queryClient = useQueryClient();
  const id = typeof userId === 'string' ? userId : '';
  const insets = useSafeAreaInsets();
  const detail = useBuddyDetail(id);
  const refetchRef = useRef(detail.refetch);
  refetchRef.current = detail.refetch;
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const accountKey = `${accountId ?? ''}:${id}`;
  const verifyRefetch = useCallback(() => {
    if (!accountId || !id) return;
    const queryKey = buddyQueryKeys.detail(accountId, id);
    const updateCount = queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0;
    void verifyBuddyFocus(
      refetchRef.current,
      () => focusedRef.current,
      () => setVerifiedFor(`${accountId}:${id}`),
      () => (queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0) > updateCount,
    );
  }, [accountId, id, queryClient]);
  useFocusEffect(useCallback(() => {
    setVerifiedFor(null);
    if (!accountId || !id) return;
    focusedRef.current = true;
    verifyRefetch();
    return () => { focusedRef.current = false; };
  }, [accountId, id, verifyRefetch]));
  const action = useBuddyAction(id);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const perform = async (kind: 'request' | 'accept' | 'reject' | 'cancel' | 'remove') => {
    setActionError('');
    try {
      await action.mutateAsync(kind);
      setFeedback(messages[kind]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update this connection.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  const confirm = (kind: 'reject' | 'cancel' | 'remove') =>
    Alert.alert(kind === 'remove' ? 'Remove buddy?' : kind === 'reject' ? 'Decline request?' : 'Cancel request?',
      kind === 'remove' ? 'You’ll no longer see each other’s shared shelves.' : 'You can connect again later.',
      [{ text: 'Keep', style: 'cancel' }, { text: kind === 'remove' ? 'Remove' : kind === 'reject' ? 'Decline' : 'Cancel request', style: 'destructive', onPress: () => void perform(kind) }]);
  const status: BuddyStatus = detail.data?.status ?? 'none';
  const person = detail.data?.person;
  const focusVerified = verifiedFor === accountKey && !isBuddyAccessError(detail.error);
  const navigateShelf = (shelf: ShelfStatus) => router.push({ pathname: '/buddies/[userId]/shelf', params: { userId: id, status: shelf } } as any);
  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 10), paddingBottom: insets.bottom + 54 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Back to buddies"><Feather name="arrow-left" size={22} color={c.lime} /></TouchableOpacity>
      {detail.isFetching || detail.isPending || (!focusVerified && !detail.isError) ? <BuddySkeleton /> :
        detail.isError ? <BuddyError message={detail.error.message} retry={verifyRefetch} /> :
        person ? <>
          <View style={styles.hero}>
            <BuddyAvatar person={person} size={86} />
            <Text style={styles.name}>{[person.firstName, person.lastName].filter(Boolean).join(' ') || person.username}</Text>
            <Text style={styles.handle}>@{person.username}</Text>
            {status === 'accepted' && !!person.bio && <Text style={styles.bio}>{person.bio}</Text>}
          </View>
          {feedback ? <View style={styles.notice}><Feather name="check-circle" size={16} color={c.lime} /><Text style={styles.noticeText}>{feedback}</Text></View> : null}
          {actionError ? <View style={styles.notice}><Feather name="alert-circle" size={16} color={c.danger} /><Text style={[styles.noticeText, { color: c.danger }]}>{actionError}</Text></View> : null}
          <View style={styles.actions}>
            {status === 'none' && <TouchableOpacity style={styles.primary} disabled={action.isPending} onPress={() => void perform('request')}><Feather name="user-plus" size={16} color={c.background} /><Text style={styles.primaryText}>{action.isPending ? 'Sending…' : 'Send buddy request'}</Text></TouchableOpacity>}
            {status === 'incoming' && <>
              <Text style={styles.context}>They’d like to be your buddy.</Text>
              <TouchableOpacity style={styles.primary} disabled={action.isPending} onPress={() => void perform('accept')}><Feather name="check" size={17} color={c.background} /><Text style={styles.primaryText}>Accept request</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondary} disabled={action.isPending} onPress={() => confirm('reject')}><Text style={styles.secondaryText}>Decline</Text></TouchableOpacity>
            </>}
            {status === 'outgoing' && <>
              <Text style={styles.context}>Waiting for their reply.</Text>
              <TouchableOpacity style={styles.secondary} disabled={action.isPending} onPress={() => confirm('cancel')}><Text style={styles.secondaryText}>Cancel request</Text></TouchableOpacity>
            </>}
            {status === 'accepted' && <TouchableOpacity style={styles.remove} disabled={action.isPending} onPress={() => confirm('remove')}><Feather name="user-minus" size={15} color={c.muted} /><Text style={styles.removeText}>Remove buddy</Text></TouchableOpacity>}
          </View>
          {status !== 'accepted' ? <View style={styles.locked}><Feather name="lock" size={21} color={c.lime} /><Text style={styles.lockedTitle}>{status === 'outgoing' ? 'Waiting for their reply.' : 'Become Spud Buddies.'}</Text><Text style={styles.lockedCopy}>Once you’re buddies, you can see what they have watched, what they’re watching, and what they’re planning to watch next.</Text></View> :
            <>
              {([
                ['tv', 'Their top 3 TV shows'],
                ['movies', 'Their top 3 movies'],
              ] as const).map(([key, label]) => <View style={styles.block} key={key}>
                <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
                {(detail.data.favorites?.[key] ?? []).length ?
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRow}>
                    {detail.data.favorites?.[key].slice(0, 3).map((item, index) => <Poster key={`${item.title}-${index}`} item={item} width={96} onPress={() => void openTitleSheet({ title: item.title, type: key === 'tv' ? 'show' : 'movie' }, path => router.push(path as any))} />)}
                  </ScrollView> : <Text style={styles.empty}>Nothing picked yet.</Text>}
              </View>)}
              <View style={styles.divider} />
              {(['watching', 'plan_to_watch', 'completed'] as const).map(shelf => {
                const data = detail.data.shelves?.[shelf];
                return <View key={shelf} style={styles.block}>
                  <View style={styles.shelfHeading}><Text style={styles.shelfTitle}>{shelfLabels[shelf]} <Text style={styles.shelfCount}>{data?.count ?? 0}</Text></Text>
                    {(data?.count ?? 0) > 0 && <TouchableOpacity onPress={() => navigateShelf(shelf)} accessibilityLabel={`See all ${shelfLabels[shelf]}`}><Text style={styles.seeAll}>See all <Feather name="arrow-up-right" size={13} color={c.lime} /></Text></TouchableOpacity>}
                  </View>
                  {data?.items?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRow}>
                    {data.items.slice(0, 6).map((item, index) => <Poster key={`${item.tmdbId}-${index}`} item={item} onPress={() => void openTitleSheet({ title: item.title, type: item.type, tmdbId: item.tmdbId }, path => router.push(path as any))} />)}
                  </ScrollView> : <Text style={styles.empty}>Nothing on this shelf yet.</Text>}
                </View>;
              })}
            </>}
        </> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, content: { paddingHorizontal: 20 },
  back: { alignSelf: 'flex-start', paddingVertical: 12, paddingRight: 20, marginBottom: 12 },
  hero: { alignItems: 'center', paddingTop: 10, paddingBottom: 23 },
  name: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 26, marginTop: 13, textAlign: 'center' },
  handle: { color: c.lime, fontFamily: 'Manrope_600SemiBold', fontSize: 13, marginTop: 2 },
  bio: { color: c.text, fontFamily: 'Manrope_400Regular', textAlign: 'center', fontSize: 14, lineHeight: 21, marginTop: 15, maxWidth: 320 },
  actions: { gap: 9, marginBottom: 23 },
  primary: { backgroundColor: c.lime, borderRadius: 100, minHeight: 49, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { color: c.background, fontFamily: 'Manrope_700Bold', fontSize: 14 },
  secondary: { borderRadius: 100, borderWidth: 1, borderColor: c.panelLight, minHeight: 45, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: c.muted, fontFamily: 'Manrope_600SemiBold', fontSize: 13 },
  remove: { alignSelf: 'center', flexDirection: 'row', gap: 7, padding: 10, alignItems: 'center' },
  removeText: { color: c.muted, fontFamily: 'Manrope_600SemiBold', fontSize: 12 },
  context: { color: c.muted, fontFamily: 'Manrope_500Medium', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  notice: { backgroundColor: c.panel, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 9, marginBottom: 12 },
  noticeText: { color: c.lime, fontFamily: 'Manrope_500Medium', fontSize: 12, flex: 1 },
  locked: { backgroundColor: c.panel, borderRadius: 18, padding: 23, gap: 10, alignItems: 'flex-start' },
  lockedTitle: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 17 },
  lockedCopy: { color: c.muted, fontFamily: 'Manrope_400Regular', lineHeight: 20, fontSize: 13 },
  block: { marginTop: 22 },
  sectionLabel: { color: c.lime, fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 1, marginBottom: 13 },
  posterRow: { gap: 11, paddingRight: 20 },
  empty: { color: c.muted, fontFamily: 'Manrope_400Regular', fontSize: 13, paddingVertical: 12 },
  divider: { height: 1, backgroundColor: c.panelLight, marginTop: 28 },
  shelfHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  shelfTitle: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 19 },
  shelfCount: { color: c.lime, fontSize: 14 },
  seeAll: { color: c.lime, fontFamily: 'Manrope_700Bold', fontSize: 12 },
});