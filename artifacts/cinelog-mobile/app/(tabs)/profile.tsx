import { View, Text, StyleSheet, Platform, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUser, useClerk } from '@clerk/expo';
import { useListEntries } from '@workspace/api-client-react';

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

  async function handleSignOut() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    router.replace('/(auth)/sign-in' as any);
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
      <Text style={[styles.footer, { color: colors.mutedForeground, marginBottom: insets.bottom + 12 }]}>
        CouchPotato v1.0.0
      </Text>
    </ScrollView>
  );
}

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
  footer: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
});
