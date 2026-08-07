import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUser, useClerk } from '@clerk/expo';
import { useListEntries } from '@workspace/api-client-react';
import { useFacebook, type FbFriend } from '@/hooks/useFacebook';

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { user } = useUser();
  const { signOut } = useClerk();

  const { data: entries, isLoading: entriesLoading } = useListEntries({});

  const allEntries = entries ?? [];
  const watchedCount = allEntries.filter((e) => e.status === 'completed').length;
  const watchingCount = allEntries.filter((e) => e.status === 'watching').length;
  const savedCount = allEntries.filter((e) => e.status === 'plan_to_watch').length;

  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const displayName = firstName || lastName ? `${firstName} ${lastName}`.trim() : email;

  let initials = '';
  if (firstName && lastName) {
    initials = (firstName[0] + lastName[0]).toUpperCase();
  } else if (firstName) {
    initials = firstName[0].toUpperCase();
  } else if (email) {
    initials = email[0].toUpperCase();
  }

  const fb = useFacebook(API_BASE);

  async function handleSignOut() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    router.replace('/(auth)/sign-in' as any);
  }

  async function handleFacebookConnect() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fb.connect();
  }

  async function handleFacebookDisconnect() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await fb.disconnect();
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
      </View>

      {/* User Card */}
      <View style={styles.section}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: '#ffffff' }]}>{initials}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
                {displayName}
              </Text>
              {email ? (
                <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.section}>
        <View style={styles.statsRow}>
          <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {entriesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.statNumber, { color: colors.primary }]}>{watchedCount}</Text>
            )}
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>WATCHED</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {entriesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.statNumber, { color: colors.primary }]}>{watchingCount}</Text>
            )}
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>WATCHING</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {entriesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.statNumber, { color: colors.primary }]}>{savedCount}</Text>
            )}
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>SAVED</Text>
          </View>
        </View>
      </View>

      {/* ── Facebook Social Section ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SOCIAL</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {!fb.isConfigured ? (
            /* Facebook not configured in this build */
            <View style={styles.fbRow}>
              <View style={[styles.fbIconBox, { backgroundColor: '#1877F2' }]}>
                <Text style={styles.fbIconText}>f</Text>
              </View>
              <View style={styles.fbInfo}>
                <Text style={[styles.fbTitle, { color: colors.foreground }]}>Facebook Friends</Text>
                <Text style={[styles.fbSub, { color: colors.mutedForeground }]}>
                  Coming soon
                </Text>
              </View>
            </View>
          ) : fb.isConnected ? (
            <>
              {/* Connected state */}
              <View style={[styles.fbRow, styles.fbRowBorder, { borderBottomColor: colors.border }]}>
                <View style={[styles.fbIconBox, { backgroundColor: '#1877F2' }]}>
                  <Text style={styles.fbIconText}>f</Text>
                </View>
                <View style={styles.fbInfo}>
                  <Text style={[styles.fbTitle, { color: colors.foreground }]}>Facebook connected</Text>
                  <Text style={[styles.fbSub, { color: colors.mutedForeground }]}>
                    {fb.friends.length > 0
                      ? `${fb.friends.length} friend${fb.friends.length !== 1 ? 's' : ''} on Spud`
                      : 'No friends on Spud yet'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleFacebookDisconnect}
                  disabled={fb.isLoading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Friends list */}
              {fb.isLoading ? (
                <View style={styles.fbLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : fb.friends.length > 0 ? (
                fb.friends.map((friend) => (
                  <FriendRow key={friend.userId} friend={friend} colors={colors} />
                ))
              ) : (
                <View style={styles.fbEmpty}>
                  <Text style={[styles.fbEmptyText, { color: colors.mutedForeground }]}>
                    None of your Facebook friends are on Spud yet. Invite them!
                  </Text>
                </View>
              )}
            </>
          ) : (
            /* Not connected */
            <TouchableOpacity
              style={styles.fbRow}
              onPress={handleFacebookConnect}
              disabled={fb.isLoading}
              activeOpacity={0.7}
            >
              <View style={[styles.fbIconBox, { backgroundColor: '#1877F2' }]}>
                {fb.isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.fbIconText}>f</Text>
                )}
              </View>
              <View style={styles.fbInfo}>
                <Text style={[styles.fbTitle, { color: colors.foreground }]}>Connect Facebook</Text>
                <Text style={[styles.fbSub, { color: colors.mutedForeground }]}>
                  See which friends are also on Spud
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          {fb.error ? (
            <Text style={[styles.fbError, { color: '#e53e3e' }]}>{fb.error}</Text>
          ) : null}
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.actionRow} onPress={handleSignOut} activeOpacity={0.7}>
            <Feather name="log-out" size={16} color="#e53e3e" />
            <Text style={styles.signOutLabel}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footerContainer, { marginBottom: insets.bottom + 12 }]}>
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>Spud v1.0.0</Text>
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL('https://spudapp.io/privacy')} activeOpacity={0.6}>
            <Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={[styles.legalDot, { color: colors.mutedForeground }]}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://spudapp.io/terms')} activeOpacity={0.6}>
            <Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Friend row sub-component ──────────────────────────────────────────────────

function FriendRow({ friend, colors }: { friend: FbFriend; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  const name = friend.fbName ?? [friend.firstName, friend.lastName].filter(Boolean).join(' ') ?? friend.username ?? 'Spud user';
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.friendRow, { borderTopColor: colors.border }]}>
      {friend.fbPicture ? (
        <Image source={{ uri: friend.fbPicture }} style={styles.friendAvatar} />
      ) : (
        <View style={[styles.friendAvatar, styles.friendAvatarFallback, { backgroundColor: colors.primary }]}>
          <Text style={[styles.friendInitials, { color: '#fff' }]}>{initials}</Text>
        </View>
      )}
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: colors.foreground }]} numberOfLines={1}>
          {name}
        </Text>
        {friend.username ? (
          <Text style={[styles.friendUsername, { color: colors.mutedForeground }]} numberOfLines={1}>
            @{friend.username}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: -0.5,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
  },
  email: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    minHeight: 72,
  },
  statNumber: {
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    marginTop: 4,
    textAlign: 'center',
  },

  // Facebook section
  fbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  fbRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fbIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fbIconText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    lineHeight: 22,
  },
  fbInfo: {
    flex: 1,
  },
  fbTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },
  fbSub: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    marginTop: 2,
  },
  fbLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  fbEmpty: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  fbEmptyText: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 19,
  },
  fbError: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  // Friend rows
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  friendAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitials: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },
  friendUsername: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    marginTop: 1,
  },

  // Account section
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  signOutLabel: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: '#e53e3e',
  },
  footerContainer: {
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  footer: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legalLink: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
  },
});
