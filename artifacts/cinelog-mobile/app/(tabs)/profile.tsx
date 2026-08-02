import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const deepLinks = [
    {
      label: 'Open Log Entry via deep link',
      url: 'cinelog-mobile://log-entry',
      icon: 'link' as const,
    },
    {
      label: 'Open Watchlist via deep link',
      url: 'cinelog-mobile://watchlist',
      icon: 'bookmark' as const,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          DEEP LINKS
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {deepLinks.map((item, idx) => (
            <View key={item.url}>
              {idx > 0 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
                  <Feather name={item.icon} size={16} color={colors.primary} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                    {item.url}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Use these URLs in Shortcuts or Focus filters to open CineLog directly.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          QUICK ACTIONS
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
              <Feather name="layers" size={16} color={colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                Log Entry
              </Text>
              <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                Long-press the app icon → "Log Entry"
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Quick actions are available in native builds (not Expo Go).
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', letterSpacing: -0.5 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  rowValue: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  divider: { height: 1, marginLeft: 60 },
  hint: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 18,
    marginTop: 8,
    marginLeft: 4,
  },
});
