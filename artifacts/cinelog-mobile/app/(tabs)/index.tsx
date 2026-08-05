import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useListEntries } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

interface EntryItem {
  id: number;
  title: string;
  type: string;
  status: string;
  year?: number | null;
  posterUrl?: string | null;
  rating?: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Watched',
  watching: 'Watching',
  plan_to_watch: 'Watchlist',
};

const STATUS_COLOR: Record<string, string> = {
  completed: '#116149',
  watching: '#9BD6FF',
  plan_to_watch: '#EFE4D2',
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data, isLoading, refetch, isRefetching } = useListEntries({});
  const entries: EntryItem[] = (data as EntryItem[]) ?? [];

  const handleLogPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/log-entry');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={[styles.brand, { color: colors.primary }]}>CouchPotato</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your watch history
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.push('/log-entry')}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Feather name="film" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No entries yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Tap the button below to log your first title.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: bottomPad + 100,
            paddingTop: 8,
          }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => <EntryCard item={item} colors={colors} />}
        />
      )}

      {/* FAB — one tap to log */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#BDECC8', bottom: bottomPad + 80 }]}
        onPress={handleLogPress}
        activeOpacity={0.85}
        testID="log-fab"
      >
        <Feather name="plus" size={26} color="#111111" />
      </TouchableOpacity>
    </View>
  );
}

function EntryCard({ item, colors }: { item: EntryItem; colors: ReturnType<typeof useColors> }) {
  const statusColor = STATUS_COLOR[item.status] ?? colors.muted;
  const label = STATUS_LABEL[item.status] ?? item.status;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => { Haptics.selectionAsync(); router.push(('/entry/' + item.id) as any); }}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {item.posterUrl ? (
        <Image
          source={{ uri: item.posterUrl }}
          style={styles.poster}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.posterPlaceholder, { backgroundColor: colors.muted }]}>
          <Feather name="film" size={22} color={colors.mutedForeground} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text
          style={[styles.cardTitle, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardType, { color: colors.mutedForeground }]}>
            {item.type === 'movie' ? 'Movie' : 'Show'}
            {item.year ? ` · ${item.year}` : ''}
          </Text>
        </View>
        {item.rating != null && (
          <Text style={[styles.rating, { color: colors.primary }]}>
            {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: statusColor,
            borderColor: statusColor === colors.muted ? colors.border : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            {
              color: item.status === 'watching' ? colors.foreground : item.status === 'plan_to_watch' ? colors.mutedForeground : colors.primaryForeground,
            },
          ]}
        >
          {label}
        </Text>
      </View>
      <Feather name="chevron-right" size={14} color={colors.border} style={{ marginRight: 10 }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brand: {
    fontSize: 26,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    marginTop: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  poster: { width: 60, height: 90 },
  posterPlaceholder: {
    width: 60,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    lineHeight: 20,
  },
  cardMeta: { flexDirection: 'row', gap: 6 },
  cardType: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
  rating: { fontSize: 12, letterSpacing: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold' },
});
