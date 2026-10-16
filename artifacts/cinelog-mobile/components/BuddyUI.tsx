import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { resolveSpudAvatar } from '@/constants/avatars';
import type { BuddyEntry, BuddyPerson } from '@/utils/buddies';

export const buddyColors = {
  background: '#0F2D1C', panel: '#1A4A2A', panelLight: '#2A6040',
  lime: '#7EDC5A', cream: '#DAF4AA', muted: '#A8D4B0', text: '#F1F7E9',
  soft: '#D4F5A0', danger: '#FFC5B5',
};

export function BuddyAvatar({ person, size = 50 }: { person: BuddyPerson; size?: number }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const source = person.avatarUrl && person.avatarUrl !== failedPhoto
    ? { uri: person.avatarUrl }
    : resolveSpudAvatar(person.avatarId) ?? resolveSpudAvatar('8');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {source ? <Image source={source} style={styles.image}
        resizeMode={person.avatarUrl && person.avatarUrl !== failedPhoto ? 'cover' : 'contain'}
        onError={() => { if (person.avatarUrl) setFailedPhoto(person.avatarUrl); }} /> : null}
    </View>
  );
}

export function BuddyRow({ person, onPress, trailing }: {
  person: BuddyPerson; onPress: () => void; trailing?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.78}
      accessibilityRole="button" accessibilityLabel={`View ${person.firstName} ${person.lastName ?? ''}'s profile`}>
      <BuddyAvatar person={person} />
      <View style={styles.rowCopy}>
        <Text style={styles.name} numberOfLines={1}>{[person.firstName, person.lastName].filter(Boolean).join(' ') || person.username}</Text>
        <Text style={styles.handle} numberOfLines={1}>@{person.username}</Text>
      </View>
      {trailing ?? <Feather name="chevron-right" size={19} color={buddyColors.muted} />}
    </TouchableOpacity>
  );
}

export function Poster({ item, width = 92, onPress }: {
  item: { title: string; posterUrl: string | null } | BuddyEntry; width?: number; onPress?: () => void;
}) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={{ width }} {...(onPress ? { onPress, activeOpacity: 0.8, accessibilityRole: 'button', accessibilityLabel: `Open ${item.title}` } : {})}>
      <View style={[styles.poster, { width, height: Math.round(width * 1.48) }]}>
        {item.posterUrl ? <Image source={{ uri: item.posterUrl }} style={styles.image} resizeMode="cover" /> :
          <View style={styles.posterEmpty}><Feather name="film" size={23} color={buddyColors.muted} /></View>}
      </View>
      <Text numberOfLines={2} style={styles.posterTitle}>{item.title}</Text>
    </Wrapper>
  );
}

export function BuddyError({ message, retry }: { message: string; retry: () => void }) {
  return <View style={styles.error}>
    <Feather name="cloud-off" size={25} color={buddyColors.lime} />
    <Text style={styles.errorText}>{message}</Text>
    <TouchableOpacity onPress={retry} style={styles.retry} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
  </View>;
}

export function BuddySkeleton() {
  return <View style={styles.skeletonWrap}>
    {[0, 1, 2].map(i => <View key={i} style={styles.skeletonRow}><View style={styles.skeletonCircle} />
      <View style={{ gap: 9, flex: 1 }}><View style={[styles.skeletonLine, { width: '64%' }]} /><View style={[styles.skeletonLine, { width: '38%', height: 9 }]} /></View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  avatar: { overflow: 'hidden', backgroundColor: buddyColors.soft, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  initial: { color: buddyColors.background, fontFamily: 'Manrope_700Bold' },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: buddyColors.panel, borderRadius: 16, marginBottom: 8 },
  rowCopy: { flex: 1, gap: 3 },
  name: { color: buddyColors.text, fontSize: 15, fontFamily: 'Manrope_700Bold' },
  handle: { color: buddyColors.muted, fontSize: 12, fontFamily: 'Manrope_500Medium' },
  poster: { borderRadius: 10, overflow: 'hidden', backgroundColor: buddyColors.panelLight },
  posterEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  posterTitle: { color: buddyColors.text, fontSize: 11, lineHeight: 15, fontFamily: 'Manrope_600SemiBold', marginTop: 6 },
  error: { padding: 24, alignItems: 'center', gap: 10, backgroundColor: buddyColors.panel, borderRadius: 18 },
  errorText: { color: buddyColors.muted, fontSize: 13, textAlign: 'center', fontFamily: 'Manrope_500Medium', lineHeight: 20 },
  retry: { paddingHorizontal: 18, paddingVertical: 9, backgroundColor: buddyColors.lime, borderRadius: 30 },
  retryText: { color: buddyColors.background, fontFamily: 'Manrope_700Bold', fontSize: 12 },
  skeletonWrap: { gap: 8 },
  skeletonRow: { height: 73, backgroundColor: buddyColors.panel, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  skeletonCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: buddyColors.panelLight },
  skeletonLine: { height: 13, borderRadius: 7, backgroundColor: buddyColors.panelLight },
});