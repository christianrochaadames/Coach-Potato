import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBlockedBuddies, useUnblockBuddy } from '@workspace/api-client-react';
import { BuddyAvatar, BuddyError, BuddySkeleton, buddyColors as c } from '@/components/BuddyUI';
import { buddyQueryKeys } from '@/utils/buddies';

export default function BlockedBuddiesScreen() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const queryKey = ['buddies', userId, 'blocked'];
  const blocked = useListBlockedBuddies({
    query: { queryKey, refetchOnMount: 'always' },
  });
  const [error, setError] = useState('');
  const unblock = useUnblockBuddy({
    mutation: {
      onSuccess: async () => {
        setError('');
        await queryClient.invalidateQueries({ queryKey });
        await queryClient.invalidateQueries({ queryKey: buddyQueryKeys.root(userId) });
      },
      onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not unblock this member.'),
    },
  });
  const confirmUnblock = (person: NonNullable<typeof blocked.data>['blocked'][number]) =>
    Alert.alert('Unblock this member?', 'They may appear in search again. Unblocking does not restore the buddy connection.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => unblock.mutate({ userId: person.userId }) },
    ]);

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={[
      styles.content,
      { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12), paddingBottom: insets.bottom + 40 },
    ]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to buddies">
        <Feather name="arrow-left" size={20} color={c.lime} />
      </TouchableOpacity>
      <Text style={styles.kicker}>ACCOUNT SAFETY</Text>
      <Text style={styles.title}>Blocked members</Text>
      <Text style={styles.intro}>Blocked members can’t find you in buddy search or send you buddy requests. Only you can see this list.</Text>
      {error ? <View style={styles.errorNotice}><Text style={styles.errorText}>{error}</Text></View> : null}
      {blocked.isPending ? <BuddySkeleton /> :
        blocked.isError ? <BuddyError message={blocked.error.message} retry={() => void blocked.refetch()} /> :
        blocked.data.blocked.length ? blocked.data.blocked.map(person => (
          <View key={person.userId} style={styles.row}>
            <BuddyAvatar person={{ ...person, firstName: person.firstName ?? '', username: person.username ?? '', status: 'none' }} size={48} />
            <View style={styles.personCopy}>
              <Text style={styles.name}>{[person.firstName, person.lastName].filter(Boolean).join(' ') || person.username}</Text>
              <Text style={styles.handle}>@{person.username}</Text>
            </View>
            <TouchableOpacity
              style={styles.unblock}
              onPress={() => confirmUnblock(person)}
              disabled={unblock.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${person.username}`}
              testID={`button-unblock-${person.userId}`}
            >
              <Text style={styles.unblockText}>{unblock.isPending ? 'Working…' : 'Unblock'}</Text>
            </TouchableOpacity>
          </View>
        )) : <View style={styles.empty}>
          <Feather name="shield" size={25} color={c.lime} />
          <Text style={styles.emptyTitle}>No blocked members</Text>
          <Text style={styles.emptyCopy}>People you block will appear here.</Text>
        </View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 20 },
  back: { alignSelf: 'flex-start', width: 36, height: 36, borderRadius: 18, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  kicker: { color: c.lime, fontFamily: 'Manrope_700Bold', fontSize: 12, letterSpacing: 0.5 },
  title: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 30, marginTop: 5 },
  intro: { color: c.muted, fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, backgroundColor: c.panel, borderRadius: 16, marginBottom: 8 },
  personCopy: { flex: 1, minWidth: 0 },
  name: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 14 },
  handle: { color: c.muted, fontFamily: 'Manrope_500Medium', fontSize: 12, marginTop: 3 },
  unblock: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: c.panelLight },
  unblockText: { color: c.lime, fontFamily: 'Manrope_700Bold', fontSize: 12 },
  empty: { alignItems: 'center', backgroundColor: c.panel, padding: 28, borderRadius: 18, gap: 8 },
  emptyTitle: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 16 },
  emptyCopy: { color: c.muted, fontFamily: 'Manrope_400Regular', fontSize: 12, textAlign: 'center' },
  errorNotice: { backgroundColor: c.panel, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { color: c.danger, fontFamily: 'Manrope_500Medium', fontSize: 12 },
});
