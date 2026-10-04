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
      <View style={styles.heading}><Text style={styles.label}>{label}</Text>
        <View style={styles.countBadge}><Text style={styles.count} numberOfLines={1} adjustsFontSizeToFit>{people.length}</Text></View>
      </View>
      {people.length ? people.map(p => <BuddyRow key={p.userId} person={p} onPress={() => open(p)} />) :
        <Text style={styles.sectionEmpty}>{empty}</Text>}
    </View>
  );
  return <View style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12), paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={lists.isRefetching} onRefresh={() => { void lists.refetch(); if (searching) void search.refetch(); }} tintColor={c.lime} />}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to profile"><Feather name="arrow-left" size={20} color={c.lime} /></TouchableOpacity>
      <Image source={require('../../assets/images/spud-buddies.png')} style={styles.illustration}
        resizeMode="contain" accessible={false} />
      <Text style={styles.kicker}>In Good Company</Text>
      <Text style={styles.title}>Your Spud Buddies</Text>
      <Text style={styles.intro}>Find your people. See what they have been watching, what they have watched, and what they are planning to watch next.</Text>
      <View style={styles.searchBox}>
        <Feather name="search" size={19} color={c.muted} />
        <TextInput style={styles.input} placeholder="Search Name or Username" placeholderTextColor={c.muted}
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
          {section('Your Buddies', lists.data.accepted, 'No Buddies Yet')}
          {section('Wants to Connect', lists.data.incoming, 'No new requests right now.')}
          {section('Requests Sent', lists.data.outgoing, 'Nothing waiting on a reply.')}
        </>}
      {!searching && <FacebookDiscovery refreshSignal={lists.dataUpdatedAt} />}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 20 },
  back: { alignSelf: 'flex-start', width: 36, height: 36, borderRadius: 18, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' },
  illustration: { width: '100%', maxWidth: 280, aspectRatio: 1100 / 786, alignSelf: 'flex-start', marginBottom: 2 },
  kicker: { color: c.lime, fontSize: 13, fontFamily: 'Manrope_700Bold', marginBottom: 5 },
  title: { color: c.text, fontSize: 32, lineHeight: 40, fontFamily: 'Manrope_700Bold', letterSpacing: -1 },
  intro: { color: c.muted, fontSize: 14, lineHeight: 21, fontFamily: 'Manrope_400Regular', marginTop: 7, marginBottom: 18 },
  searchBox: { backgroundColor: c.panel, borderRadius: 15, height: 54, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: c.panelLight },
  input: { flex: 1, color: c.text, fontFamily: 'Manrope_500Medium', fontSize: 15, paddingVertical: 10 },
  hint: { color: c.muted, fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 10 },
  section: { marginTop: 30 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  label: { color: c.lime, fontFamily: 'Manrope_700Bold', fontSize: 12 },
  countBadge: { width: 24, height: 24, borderRadius: 12, flexShrink: 0, backgroundColor: c.cream, alignItems: 'center', justifyContent: 'center' },
  count: { color: c.background, fontSize: 11, lineHeight: 15, textAlign: 'center', fontFamily: 'Manrope_700Bold' },
  sectionEmpty: { color: c.muted, backgroundColor: c.panel, borderRadius: 16, overflow: 'hidden', padding: 19, lineHeight: 19, fontFamily: 'Manrope_400Regular', fontSize: 13 },
  empty: { alignItems: 'center', backgroundColor: c.panel, padding: 30, borderRadius: 18, gap: 7 },
  emptyTitle: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 16 },
  emptyCopy: { color: c.muted, fontFamily: 'Manrope_400Regular', fontSize: 12 },
});