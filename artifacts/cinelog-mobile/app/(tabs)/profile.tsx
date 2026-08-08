import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Platform, TouchableOpacity,
  ActivityIndicator, ScrollView, Image, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUser, useClerk, useAuth } from '@clerk/expo';
import { useListEntries } from '@workspace/api-client-react';

const SPUD_AVATARS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const AVATAR_MAP: Record<number, any> = {
  2:  require('@/assets/images/spud-avatar-2.png'),
  3:  require('@/assets/images/spud-avatar-3.png'),
  4:  require('@/assets/images/spud-avatar-4.png'),
  5:  require('@/assets/images/spud-avatar-5.png'),
  6:  require('@/assets/images/spud-avatar-6.png'),
  7:  require('@/assets/images/spud-avatar-7.png'),
  8:  require('@/assets/images/spud-avatar-8.png'),
  9:  require('@/assets/images/spud-avatar-9.png'),
  10: require('@/assets/images/spud-avatar-10.png'),
  11: require('@/assets/images/spud-avatar-11.png'),
  12: require('@/assets/images/spud-avatar-12.png'),
  13: require('@/assets/images/spud-avatar-13.png'),
  14: require('@/assets/images/spud-avatar-14.png'),
  15: require('@/assets/images/spud-avatar-15.png'),
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [profile, setProfile]       = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [pickingAvatar, setPickingAvatar]   = useState(false);
  const [savingAvatar, setSavingAvatar]     = useState(false);

  const { data: entries } = useListEntries({});
  const allEntries = (entries as any[]) ?? [];
  const watchedCount  = allEntries.filter(e => e.status === 'completed').length;
  const watchingCount = allEntries.filter(e => e.status === 'watching').length;
  const savedCount    = allEntries.filter(e => e.status === 'plan_to_watch').length;

  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';

  const loadProfile = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`https://${domain}/api/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setProfile(await res.json());
    } catch {} finally { setProfileLoading(false); }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSignOut = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/(auth)/sign-in' as any); },
      },
    ]);
  };

  const handleSelectAvatar = async (avatarId: number) => {
    setSavingAvatar(true);
    try {
      const token = await getToken();
      await fetch(`https://${domain}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ avatarId: String(avatarId), avatarUrl: null }),
      });
      setProfile((p: any) => ({ ...p, avatarId: String(avatarId), avatarUrl: null }));
      setPickingAvatar(false);
    } catch {} finally { setSavingAvatar(false); }
  };

  // Derive displayed avatar
  const avatarUrl  = profile?.avatarUrl ?? null;
  const avatarId   = profile?.avatarId  ?? null;
  const firstName  = profile?.firstName ?? user?.firstName ?? '';
  const lastName   = profile?.lastName  ?? user?.lastName  ?? '';
  const email      = user?.primaryEmailAddress?.emailAddress ?? '';
  const displayName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : email;

  let initials = '';
  if (firstName && lastName) initials = (firstName[0] + lastName[0]).toUpperCase();
  else if (firstName) initials = firstName[0].toUpperCase();
  else if (email) initials = email[0].toUpperCase();

  const avatarSource: any =
    avatarUrl ? { uri: avatarUrl }
    : avatarId ? AVATAR_MAP[parseInt(avatarId, 10)]
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F2D1C' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* ── Avatar section ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => setPickingAvatar(true)}
            activeOpacity={0.85}
          >
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <View style={[styles.avatarImg, styles.avatarInitials]}>
                <Text style={styles.initialsText}>{initials || '?'}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Feather name="camera" size={14} color="#0F2D1C" />
            </View>
          </TouchableOpacity>

          <Text style={styles.displayName}>{displayName}</Text>
          {email ? <Text style={styles.emailText}>{email}</Text> : null}

          <TouchableOpacity
            style={styles.changeAvatarBtn}
            onPress={() => setPickingAvatar(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.changeAvatarText}>Change avatar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{watchedCount}</Text>
            <Text style={styles.statLabel}>Watched</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{watchingCount}</Text>
            <Text style={styles.statLabel}>Watching</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{savedCount}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>

        {/* ── Account section ── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => Linking.openURL('https://couch-potato.replit.app/privacy')}
              activeOpacity={0.7}
            >
              <Feather name="shield" size={16} color="#A8D4B0" />
              <Text style={styles.menuText}>Privacy Policy</Text>
              <Feather name="chevron-right" size={14} color="#A8D4B0" />
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => Linking.openURL('https://couch-potato.replit.app/terms')}
              activeOpacity={0.7}
            >
              <Feather name="file-text" size={16} color="#A8D4B0" />
              <Text style={styles.menuText}>Terms of Service</Text>
              <Feather name="chevron-right" size={14} color="#A8D4B0" />
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuRow} onPress={handleSignOut} activeOpacity={0.7}>
              <Feather name="log-out" size={16} color="#FF6B6B" />
              <Text style={[styles.menuText, { color: '#FF6B6B' }]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>Spud v1.0.0</Text>
      </ScrollView>

      {/* ── Avatar picker modal ── */}
      {pickingAvatar && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose your Spud</Text>
              <TouchableOpacity onPress={() => setPickingAvatar(false)} activeOpacity={0.7}>
                <Feather name="x" size={20} color="#111111" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.pickerGrid} showsVerticalScrollIndicator={false}>
              {SPUD_AVATARS.map(id => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.pickerItem,
                    avatarId === String(id) && styles.pickerItemActive,
                  ]}
                  onPress={() => handleSelectAvatar(id)}
                  activeOpacity={0.8}
                  disabled={savingAvatar}
                >
                  <Image source={AVATAR_MAP[id]} style={styles.pickerImg} resizeMode="contain" />
                  {avatarId === String(id) && (
                    <View style={styles.pickerCheck}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  avatarSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarImg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A4A2A' },
  avatarInitials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 36, fontFamily: 'Manrope_700Bold', color: '#7EDC5A' },
  editBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#7EDC5A',
    alignItems: 'center', justifyContent: 'center',
  },
  displayName: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#ffffff', textAlign: 'center' },
  emailText: {
    fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#A8D4B0',
    textAlign: 'center', marginTop: 4,
  },
  changeAvatarBtn: {
    marginTop: 12, backgroundColor: '#1A4A2A', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  changeAvatarText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: '#7EDC5A' },

  statsRow: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 20, marginBottom: 28,
  },
  statCard: {
    flex: 1, backgroundColor: '#1A4A2A', borderRadius: 16,
    alignItems: 'center', paddingVertical: 16,
  },
  statNum: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: '#7EDC5A' },
  statLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#A8D4B0', marginTop: 4 },

  sectionWrap: { marginHorizontal: 20, marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#A8D4B0',
    letterSpacing: 0.8, marginBottom: 8, marginLeft: 4,
  },
  menuCard: { backgroundColor: '#1A4A2A', borderRadius: 16, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  menuText: { flex: 1, fontSize: 14, fontFamily: 'Manrope_500Medium', color: '#ffffff' },
  menuDivider: { height: 1, backgroundColor: '#0F2D1C', marginHorizontal: 16 },

  version: {
    textAlign: 'center', fontSize: 12,
    fontFamily: 'Manrope_400Regular', color: '#A8D4B0',
  },

  // Avatar picker
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 20, paddingHorizontal: 20, maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  pickerTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: '#111111' },
  pickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingBottom: 40, justifyContent: 'space-between',
  },
  pickerItem: {
    width: '22%', aspectRatio: 1, borderRadius: 16,
    backgroundColor: '#EFE4D2', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  pickerItemActive: { backgroundColor: '#116149' },
  pickerImg: { width: '85%', height: '85%' },
  pickerCheck: {
    position: 'absolute', bottom: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#116149', alignItems: 'center', justifyContent: 'center',
  },
});
