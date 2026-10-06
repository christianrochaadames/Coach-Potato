import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetPublicTitleQueryKey, useGetPublicTitle } from '@workspace/api-client-react';
import { QuickLogSheet, type TmdbItem } from '@/app/(tabs)/search';
import { savePendingTitle } from '@/utils/pendingTitle';

/** Public shared-title destination: opens the standard title sheet, never someone's private entry. */
export default function SharedTitleScreen() {
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const type = params.type === 'movie' || params.type === 'show' ? params.type : null;
  const tmdbId = Number(params.id);
  const valid = !!type && Number.isInteger(tmdbId) && tmdbId > 0;
  const path = valid ? `/title/${type}/${tmdbId}` : null;

  useEffect(() => {
    if (isLoaded && !isSignedIn && path) void savePendingTitle(path);
  }, [isLoaded, isSignedIn, path]);

  const q = useGetPublicTitle(type ?? 'movie', valid ? tmdbId : 0, {
    query: { enabled: valid && !!isSignedIn, queryKey: getGetPublicTitleQueryKey(type ?? 'movie', valid ? tmdbId : 0) },
  });

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any));

  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/landing" />;

  const t = q.data;
  const item: TmdbItem | null = t ? {
    tmdbId: t.tmdbId, title: t.title, type: t.type as 'movie' | 'show',
    year: t.year ?? null, posterUrl: t.posterUrl ?? null, overview: t.synopsis ?? null,
  } : null;

  return (
    <View style={styles.root}>
      {!valid ? <Msg title="That link looks off" copy="This title link is not valid." onBack={leave} />
        : q.isError ? <Msg title="Could not open this title" copy="We could not load it. Check your connection and try again." onRetry={() => void q.refetch()} onBack={leave} />
        : !item ? <View style={styles.center}><ActivityIndicator size="large" color="#5B3FA5" /></View>
        : <QuickLogSheet item={item} visible onClose={leave} onSaved={() => {}} insets={{ bottom: insets.bottom, top: insets.top }} source="search" />}
    </View>
  );
}

function Msg({ title, copy, onRetry, onBack }: { title: string; copy: string; onRetry?: () => void; onBack: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.copy}>{copy}</Text>
      {onRetry && <TouchableOpacity style={styles.btn} onPress={onRetry} accessibilityRole="button"><Text style={styles.btnText}>Try again</Text></TouchableOpacity>}
      <TouchableOpacity onPress={onBack} accessibilityRole="button"><Text style={styles.link}>Go back</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFBC4D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#2B2430' },
  copy: { fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_500Medium', color: '#4A3B1F', textAlign: 'center' },
  btn: { backgroundColor: '#5B3FA5', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 30 },
  btnText: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 14 },
  link: { color: '#5B3FA5', fontFamily: 'Manrope_700Bold', fontSize: 14, marginTop: 4 },
});
