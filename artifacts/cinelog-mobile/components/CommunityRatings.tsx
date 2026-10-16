import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useGetCommunityRatings, useGetShowSeasonCommunityRatings, getGetShowSeasonCommunityRatingsQueryKey } from '@workspace/api-client-react';

type Tone = 'light' | 'dark';
const palettes = {
  light: { label: '#7E7A73', text: '#2B2430', muted: '#7E7A73', track: '#EFE4D2', fill: '#FFC83A', panel: '#FBF5EA', accent: '#5B3FA5' },
  dark: { label: '#A8D4B0', text: '#F1F7E9', muted: '#A8D4B0', track: '#2A6040', fill: '#7EDC5A', panel: '#1A4A2A', accent: '#7EDC5A' },
};

function Body({ type, tmdbId, refreshKey, p }: {
  type: 'movie' | 'show'; tmdbId: number; refreshKey?: string | number | null; p: typeof palettes.light;
}) {
  const q = useGetCommunityRatings(type, tmdbId);
  const refetchRef = useRef(q.refetch);
  refetchRef.current = q.refetch;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    void refetchRef.current();
  }, [refreshKey]);

  if (q.isPending) {
    return <View style={[styles.card, { backgroundColor: p.panel }]}>
      <View style={[styles.skel, { width: 90, height: 34, backgroundColor: p.track }]} />
      {[0, 1, 2, 3, 4].map(i => <View key={i} style={[styles.skel, { height: 10, marginTop: 10, backgroundColor: p.track }]} />)}
    </View>;
  }
  if (q.isError || !q.data) {
    return <View style={[styles.card, styles.center, { backgroundColor: p.panel }]}>
      <Feather name="cloud-off" size={20} color={p.accent} />
      <Text style={[styles.note, { color: p.muted }]}>Community ratings did not load.</Text>
      <TouchableOpacity onPress={() => void q.refetch()} style={[styles.retry, { backgroundColor: p.accent }]} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>;
  }
  const { average, count, distribution } = q.data;
  const rows = [5, 4, 3, 2, 1].map(stars => distribution.find(d => d.stars === stars) ?? { stars, count: 0, percentage: 0 });
  return (
    <View style={[styles.card, { backgroundColor: p.panel }]}>
      <View style={styles.top}>
        <Text style={[styles.avg, { color: p.text }]}>{average != null && count > 0 ? average.toFixed(1) : '--'}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(s => <FontAwesome key={s} name="star" size={14} color={average != null && s <= Math.round(average) ? p.fill : p.track} />)}
          </View>
          <Text style={[styles.count, { color: p.muted }]}>
            {count === 0 ? 'No ratings yet' : `${count} ${count === 1 ? 'rating' : 'ratings'} from Spud members`}
          </Text>
        </View>
      </View>
      {rows.map(r => (
        <View key={r.stars} style={styles.row} accessibilityLabel={`${r.stars} stars, ${r.count} ratings`}>
          <Text style={[styles.rowLabel, { color: p.muted }]}>{r.stars}</Text>
          <FontAwesome name="star" size={10} color={p.fill} />
          <View style={[styles.track, { backgroundColor: p.track }]}>
            <View style={{ width: `${Math.max(0, Math.min(100, r.percentage))}%`, height: '100%', borderRadius: 4, backgroundColor: p.fill }} />
          </View>
          <Text style={[styles.rowCount, { color: p.muted }]}>{r.count}</Text>
        </View>
      ))}
      {count === 0 && <Text style={[styles.note, { color: p.muted, marginTop: 10 }]}>Be the first to rate it. Ratings are anonymous.</Text>}
    </View>
  );
}

/** Anonymous aggregate of every Spud member's 1-5 rating. No names, no notes. */
export function CommunityRatings({ type, tmdbId, resolving = false, refreshKey, tone = 'light', label }: {
  type: 'movie' | 'show' | string; tmdbId: number | null | undefined; resolving?: boolean;
  refreshKey?: string | number | null; tone?: Tone; label?: string;
}) {
  const p = palettes[tone];
  const heading = label ?? (type === 'movie' ? 'SPUD COMMUNITY RATING' : 'Spud Community Rating — Entire Series (All Seasons)');
  return (
    <View style={styles.wrap} testID="community-ratings">
      <Text style={[styles.label, { color: p.label }]}>{heading}</Text>
      {tmdbId ? <Body type={type === 'movie' ? 'movie' : 'show'} tmdbId={tmdbId} refreshKey={refreshKey} p={p} /> :
        resolving ? <View style={[styles.card, { backgroundColor: p.panel }]}><View style={[styles.skel, { height: 60, backgroundColor: p.track }]} /></View> :
        <View style={[styles.card, { backgroundColor: p.panel }]}>
          <Text style={[styles.note, { color: p.muted }]}>
            We have not matched this title to the movie database yet, so there is no community rating to show. Anonymous averages appear once a match is found.
          </Text>
        </View>}
      <Text style={[styles.foot, { color: p.muted }]}>Averages combine all Spud members anonymously. Individual ratings and notes are never shown.</Text>
    </View>
  );
}

/** One cached request for every season of a show; invalidated after any season rating change. */
function useSeasonAgg(tmdbId: number | null | undefined, seasonNumber: number) {
  const q = useGetShowSeasonCommunityRatings(tmdbId ?? 0, { query: { enabled: !!tmdbId && seasonNumber >= 1, queryKey: getGetShowSeasonCommunityRatingsQueryKey(tmdbId ?? 0) } });
  const agg = q.data?.seasons.find(s => s.seasonNumber === seasonNumber) ?? null;
  return { q, agg };
}

/** Collapsed-row summary: season community average and count, never mixed with the overall score. */
export function SeasonCommunitySummary({ tmdbId, seasonNumber, tone = 'light' }: { tmdbId: number | null | undefined; seasonNumber: number; tone?: Tone }) {
  const p = palettes[tone];
  const { q, agg } = useSeasonAgg(tmdbId, seasonNumber);
  if (!tmdbId || seasonNumber < 1) return null;
  let text = 'Season rating loading';
  if (q.isError) text = 'Season rating unavailable';
  else if (!q.isPending) text = agg && agg.count > 0 && agg.average != null
    ? `${agg.average.toFixed(1)} · ${agg.count} ${agg.count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet';
  return (
    <View style={styles.seasonSum}>
      <FontAwesome name="star" size={10} color={agg && agg.count ? p.fill : p.track} />
      <Text style={[styles.seasonSumText, { color: p.muted }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/** Full 5-star distribution for one open season. */
export function SeasonCommunityChart({ tmdbId, seasonNumber, tone = 'light' }: { tmdbId: number | null | undefined; seasonNumber: number; tone?: Tone }) {
  const p = palettes[tone];
  const { q, agg } = useSeasonAgg(tmdbId, seasonNumber);
  if (!tmdbId || seasonNumber < 1) return null;
  const name = seasonNumber === 0 ? 'SPECIALS' : `SEASON ${seasonNumber}`;
  const rows = [5, 4, 3, 2, 1].map(stars => agg?.distribution.find(d => d.stars === stars) ?? { stars, count: 0, percentage: 0 });
  return (
    <View style={[styles.card, { backgroundColor: p.panel, marginBottom: 12 }]} testID="season-community">
      <Text style={[styles.label, { color: p.label, marginBottom: 6 }]}>{`SPUD COMMUNITY RATING · ${name}`}</Text>
      {q.isPending ? <View style={[styles.skel, { height: 60, backgroundColor: p.track }]} /> :
       q.isError ? <View style={styles.center}>
          <Text style={[styles.note, { color: p.muted }]}>Season ratings did not load.</Text>
          <TouchableOpacity onPress={() => void q.refetch()} style={[styles.retry, { backgroundColor: p.accent }]} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
        </View> : <>
        <View style={styles.top}>
          <Text style={[styles.avg, { color: p.text, fontSize: 30, lineHeight: 36 }]}>{agg && agg.count > 0 && agg.average != null ? agg.average.toFixed(1) : '--'}</Text>
          <Text style={[styles.count, { color: p.muted, flex: 1 }]}>{!agg || agg.count === 0 ? 'No season ratings yet' : `${agg.count} ${agg.count === 1 ? 'rating' : 'ratings'} for this season`}</Text>
        </View>
        {rows.map(r => (
          <View key={r.stars} style={styles.row} accessibilityLabel={`${r.stars} stars, ${r.count} ratings`}>
            <Text style={[styles.rowLabel, { color: p.muted }]}>{r.stars}</Text>
            <FontAwesome name="star" size={10} color={p.fill} />
            <View style={[styles.track, { backgroundColor: p.track }]}><View style={{ width: `${Math.max(0, Math.min(100, r.percentage))}%`, height: '100%', borderRadius: 4, backgroundColor: p.fill }} /></View>
            <Text style={[styles.rowCount, { color: p.muted }]}>{r.count}</Text>
          </View>
        ))}
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  seasonSum: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seasonSumText: { fontSize: 11, fontFamily: 'Manrope_500Medium', flexShrink: 1 },
  wrap: { marginTop: 22 },
  label: { fontSize: 11, letterSpacing: 1.2, fontFamily: 'Manrope_700Bold', marginBottom: 10 },
  card: { borderRadius: 16, padding: 16 },
  center: { alignItems: 'center', gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  avg: { fontSize: 38, lineHeight: 44, fontFamily: 'Manrope_700Bold', letterSpacing: -1, minWidth: 64 },
  stars: { flexDirection: 'row', gap: 3, marginBottom: 4 },
  count: { fontSize: 12, fontFamily: 'Manrope_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  rowLabel: { width: 10, fontSize: 12, fontFamily: 'Manrope_700Bold', textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  rowCount: { width: 30, fontSize: 11, fontFamily: 'Manrope_500Medium', textAlign: 'right' },
  note: { fontSize: 13, lineHeight: 19, fontFamily: 'Manrope_500Medium', textAlign: 'center' },
  foot: { fontSize: 11, lineHeight: 16, fontFamily: 'Manrope_400Regular', marginTop: 8 },
  skel: { borderRadius: 8 },
  retry: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 30 },
  retryText: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 12 },
});
