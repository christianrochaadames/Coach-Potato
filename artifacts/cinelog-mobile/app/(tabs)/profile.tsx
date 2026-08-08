/**
 * Profile screen — accessible via avatar button on the Home tab.
 * Dark green page; always-visible Spud avatar grid + photo picker;
 * inline-editable NAME and BIO cards; sign-out pill at bottom.
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, TextInput, ActivityIndicator, Linking, Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useUser, useClerk, useAuth } from '@clerk/expo';

// ── Constants ─────────────────────────────────────────────────────────────────
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
const API = `https://${DOMAIN}`;

const SPUD_IDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Inline editing
  const [editingField, setEditingField] = useState<'name' | 'bio' | null>(null);
  const [nameVal, setNameVal]     = useState('');
  const [bioVal,  setBioVal]      = useState('');

  const nameRef = useRef<TextInput>(null);
  const bioRef  = useRef<TextInput>(null);

  // Derive avatar
  const avatarUrl = profile?.avatarUrl ?? null;
  const avatarId  = profile?.avatarId  ?? null;
  const firstName = profile?.firstName ?? user?.firstName ?? '';
  const lastName  = profile?.lastName  ?? user?.lastName  ?? '';
  const email     = user?.primaryEmailAddress?.emailAddress ?? '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || email;

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  let initials = '';
  if (firstName && lastName) initials = (firstName[0] + lastName[0]).toUpperCase();
  else if (firstName)        initials = firstName[0].toUpperCase();
  else if (email)            initials = email[0].toUpperCase();

  const avatarSource: any =
    avatarUrl ? { uri: avatarUrl }
    : avatarId ? AVATAR_MAP[parseInt(avatarId, 10)]
    : null;

  // ── Load profile ──────────────────────────────────────────────────────────
  const loadProfile = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const p = await res.json();
        setProfile(p);
        setNameVal([p.firstName, p.lastName].filter(Boolean).join(' '));
        setBioVal(p.bio ?? '');
      }
    } catch {}
  };

  useEffect(() => { loadProfile(); }, []);

  // ── Save profile field ────────────────────────────────────────────────────
  const saveField = async (payload: Record<string, any>) => {
    setSaving(true);
    try {
      const token = await getToken();
      await fetch(`${API}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      setProfile((p: any) => ({ ...p, ...payload }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setSaving(false); }
  };

  const saveName = () => {
    const parts = nameVal.trim().split(/\s+/);
    const newFirst = parts[0] ?? '';
    const newLast  = parts.slice(1).join(' ') || null;
    saveField({ firstName: newFirst, lastName: newLast });
    setEditingField(null);
  };

  const saveBio = () => {
    saveField({ bio: bioVal.trim() || null });
    setEditingField(null);
  };

  // ── Avatar selection ──────────────────────────────────────────────────────
  const selectAvatar = async (id: number) => {
    Haptics.selectionAsync();
    await saveField({ avatarId: String(id), avatarUrl: null });
  };

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
    await saveField({ avatarUrl: dataUrl, avatarId: null });
    // Also sync to Clerk profile photo
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      await user?.setProfileImage({ file });
    } catch {}
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/landing' as any);
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#0F2D1C' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={20} color="#7EDC5A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Avatar circle */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            {avatarSource ? (
              <Image
                source={avatarSource}
                style={StyleSheet.absoluteFill}
                resizeMode={avatarUrl ? 'cover' : 'contain'}
              />
            ) : (
              <Text style={styles.initialsText}>{initials || '?'}</Text>
            )}
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          {email ? <Text style={styles.emailText}>{email}</Text> : null}
          {memberSince ? (
            <Text style={styles.memberText}>Member since {memberSince}</Text>
          ) : null}
        </View>

        {/* ── Avatar grid card ── */}
        <View style={styles.gridCard}>
          <Text style={styles.gridLabel}>CHOOSE YOUR SPUD OR UPLOAD YOUR PICTURE.</Text>
          <View style={styles.grid}>
            {SPUD_IDS.map(id => (
              <TouchableOpacity
                key={id}
                style={[
                  styles.gridItem,
                  avatarId === String(id) && !avatarUrl && styles.gridItemActive,
                ]}
                onPress={() => selectAvatar(id)}
                activeOpacity={0.8}
              >
                <Image source={AVATAR_MAP[id]} style={styles.gridImg} resizeMode="contain" />
                {avatarId === String(id) && !avatarUrl && (
                  <View style={styles.gridCheck}>
                    <Feather name="check" size={10} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
            {/* Photo button */}
            <TouchableOpacity style={styles.photoBtn} onPress={handlePhoto} activeOpacity={0.8}>
              <Feather name="camera" size={22} color="#0F2D1C" />
              <Text style={styles.photoBtnText}>Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── NAME card ── */}
        <View style={styles.fieldCard}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>NAME</Text>
            {editingField === 'name' ? (
              <View style={styles.fieldActions}>
                <TouchableOpacity onPress={() => setEditingField(null)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveName} disabled={saving} activeOpacity={0.7}>
                  {saving ? <ActivityIndicator size="small" color="#7EDC5A" /> : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setNameVal([profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || displayName);
                  setEditingField('name');
                  setTimeout(() => nameRef.current?.focus(), 100);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="edit-2" size={16} color="#A8D4B0" />
              </TouchableOpacity>
            )}
          </View>
          {editingField === 'name' ? (
            <TextInput
              ref={nameRef}
              style={styles.fieldInput}
              value={nameVal}
              onChangeText={setNameVal}
              placeholder="Your name"
              placeholderTextColor="#4A7A5A"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
          ) : (
            <Text style={styles.fieldValue}>{displayName || '—'}</Text>
          )}
        </View>

        {/* ── BIO card ── */}
        <View style={styles.fieldCard}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>BIO</Text>
            {editingField === 'bio' ? (
              <View style={styles.fieldActions}>
                <TouchableOpacity onPress={() => setEditingField(null)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveBio} disabled={saving} activeOpacity={0.7}>
                  {saving ? <ActivityIndicator size="small" color="#7EDC5A" /> : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setBioVal(profile?.bio ?? '');
                  setEditingField('bio');
                  setTimeout(() => bioRef.current?.focus(), 100);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="edit-2" size={16} color="#A8D4B0" />
              </TouchableOpacity>
            )}
          </View>
          {editingField === 'bio' ? (
            <TextInput
              ref={bioRef}
              style={[styles.fieldInput, { minHeight: 80 }]}
              value={bioVal}
              onChangeText={v => setBioVal(v.slice(0, 200))}
              placeholder="Tell Spud a bit about yourself…"
              placeholderTextColor="#4A7A5A"
              multiline
              maxLength={200}
            />
          ) : (
            <Text style={[styles.fieldValue, !profile?.bio && { color: '#4A7A5A', fontStyle: 'italic' }]}>
              {profile?.bio || 'Tap the pencil to add a bio'}
            </Text>
          )}
        </View>

        {/* ── Legal links ── */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL(`${API}/privacy`)} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`${API}/terms`)} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Feather name="log-out" size={16} color="#0F2D1C" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A4A2A', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  // Avatar section
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#1A4A2A', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  initialsText: { fontSize: 38, fontFamily: 'Manrope_700Bold', color: '#7EDC5A' },
  displayName: {
    fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#ffffff', marginBottom: 4,
  },
  emailText: {
    fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#A8D4B0', marginBottom: 4,
  },
  memberText: {
    fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#7EDC5A',
  },

  // Avatar grid card
  gridCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: '#2A6040', borderRadius: 20, padding: 16,
  },
  gridLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', color: '#0F2D1C',
    letterSpacing: 0.5, marginBottom: 14,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  gridItem: {
    width: '21%', aspectRatio: 1, borderRadius: 100,
    backgroundColor: '#D4F5A0', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  gridItemActive: { backgroundColor: '#116149' },
  gridImg: { width: '85%', height: '85%' },
  gridCheck: {
    position: 'absolute', bottom: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#7EDC5A', alignItems: 'center', justifyContent: 'center',
  },
  photoBtn: {
    width: '21%', aspectRatio: 1, borderRadius: 100,
    backgroundColor: '#116149', alignItems: 'center', justifyContent: 'center',
    gap: 2,
  },
  photoBtnText: { fontSize: 9, fontFamily: 'Manrope_700Bold', color: '#D4F5A0' },

  // Editable field cards
  fieldCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#1A4A2A', borderRadius: 16, padding: 16,
  },
  fieldHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', color: '#A8D4B0', letterSpacing: 0.8,
  },
  fieldActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cancelText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: '#A8D4B0' },
  saveText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#7EDC5A' },
  fieldValue: {
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#ffffff', lineHeight: 22,
  },
  fieldInput: {
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#3A6A4A',
    paddingBottom: 6, lineHeight: 22,
  },

  // Legal
  legalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginBottom: 16, marginTop: 8,
  },
  legalLink: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#A8D4B0' },
  legalDot: { fontSize: 12, color: '#4A7A5A' },

  // Sign out
  signOutBtn: {
    marginHorizontal: 16, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7EDC5A', borderRadius: 32, paddingVertical: 16,
  },
  signOutText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#0F2D1C' },
});
