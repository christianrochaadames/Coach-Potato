import { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuddyError, BuddyRow, BuddySkeleton, buddyColors as c } from '@/components/BuddyUI';
import { FacebookDiscovery } from '@/components/FacebookDiscovery';
import { useBuddyLists, useBuddySearch, type BuddyPerson } from '@/utils/buddies';

export default function BuddiesScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const lists = useBuddyLists();
  const search = useBuddySearch(query);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 280);
    return () => clearTimeout(timer);
  }, [input]);
  const searching = input.trim().length >= 2;
  const open = (person: BuddyPerson) => router.push({ pathname: '/buddies/[userId]', params: { userId: person.userId } } as any);
  const section = (label: string, people: BuddyPerson[], empty: string) => (
    <View style={styles.section}>
      <View style={styles.heading}><Text style={styles.label}>{label}</Text><Text style={styles.count}>{people.length}</Text></View>
      {people.length ? people.map(p => <BuddyRow key={p.userId} person={p} onPress={() => open(p)} />) :
        <Text style={styles.sectionEmpty}>{empty}</Text>}
    </View>
  );
  return <View style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12), paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={lists.isRefetching} onRefresh={() => { void lists.refetch(); if (searching) void search.refetch(); }} tintColor={c.lime} />}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Back to profile"><Feather name="arrow-left" size={22} color={c.lime} /></TouchableOpacity>
      <Image source={require('../../assets/images/spud-buddies.png')} style={styles.illustration}
        resizeMode="contain" accessible={false} />
      <Text style={styles.kicker}>In good company</Text>
      <Text style={styles.title}>Your Spud Buddies</Text>
      <Text style={styles.intro}>Find your people. See what’s on the screen, and what has been on the screen.</Text>
      <View style={styles.searchBox}>
        <Feather name="search" size={19} color={c.muted} />
        <TextInput style={styles.input} placeholder="Name or username" placeholderTextColor={c.muted}
          value={input} onChangeText={setInput} autoCapitalize="none" autoCorrect={false}
          returnKeyType="search" accessibilityLabel="Search buddies by name or username" testID="buddy-search" />
        {!!input && <TouchableOpacity onPress={() => { setInput(''); setQuery(''); }} accessibilityLabel="Clear search"><Feather name="x" size={18} color={c.muted} /></TouchableOpacity>}
      </View>
      {input.trim().length === 1 && <Text style={styles.hint}>Type at least 2 characters to search.</Text>}
      {searching ? <View style={styles.section}>
        <Text style={styles.label}>SEARCH RESULTS</Text>
        {query !== input.trim() || search.isPending ? <BuddySkeleton /> :
          search.isError ? <BuddyError message={search.error.message} retry={() => void search.refetch()} /> :
          search.data?.results.length ? search.data.results.map(p => <BuddyRow key={p.userId} person={p} onPress={() => open(p)} />) :
          <View style={styles.empty}><Feather name="search" size={25} color={c.lime} /><Text style={styles.emptyTitle}>No potatoes found</Text><Text style={styles.emptyCopy}>Try another name or username.</Text></View>}
      </View> : lists.isPending ? <BuddySkeleton /> :
        lists.isError ? <BuddyError message={lists.error.message} retry={() => void lists.refetch()} /> :
        <>
          {section('YOUR BUDDIES', lists.data.accepted, 'No buddies yet. Find someone to watch along with.')}
          {section('WANTS TO CONNECT', lists.data.incoming, 'No new requests right now.')}
          {section('REQUESTS SENT', lists.data.outgoing, 'Nothing waiting on a reply.')}
        </>}
      {!searching && <FacebookDiscovery refreshSignal={lists.dataUpdatedAt} />}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 20 },
  back: { alignSelf: 'flex-start', minWidth: 44, minHeight: 44, justifyContent: 'center', paddingVertical: 12, paddingRight: 20, marginBottom: 8 },
  illustration: { width: '100%', maxWidth: 280, aspectRatio: 1100 / 786, alignSelf: 'center', marginBottom: 24 },
  kicker: { color: c.lime, fontSize: 13, fontFamily: 'Manrope_700Bold', marginBottom: 5 },
  title: { color: c.text, fontSize: 32, lineHeight: 40, fontFamily: 'Manrope_700Bold', letterSpacing: -1 },
  intro: { color: c.muted, fontSize: 14, lineHeight: 21, fontFamily: 'Manrope_400Regular', marginTop: 7, marginBottom: 25 },
  searchBox: { backgroundColor: c.panel, borderRadius: 15, height: 54, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: c.panelLight },
  input: { flex: 1, color: c.text, fontFamily: 'Manrope_500Medium', fontSize: 15, paddingVertical: 10 },
  hint: { color: c.muted, fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 10 },
  section: { marginTop: 30 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  label: { color: c.lime, fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 1.2, marginBottom: 12 },
  count: { color: c.background, backgroundColor: c.cream, overflow: 'hidden', borderRadius: 15, paddingHorizontal: 7, paddingVertical: 2, fontSize: 10, fontFamily: 'Manrope_700Bold', marginBottom: 12 },
  sectionEmpty: { color: c.muted, backgroundColor: c.panel, borderRadius: 16, overflow: 'hidden', padding: 19, lineHeight: 19, fontFamily: 'Manrope_400Regular', fontSize: 13 },
  empty: { alignItems: 'center', backgroundColor: c.panel, padding: 30, borderRadius: 18, gap: 7 },
  emptyTitle: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 16 },
  emptyCopy: { color: c.muted, fontFamily: 'Manrope_400Regular', fontSize: 12 },
});