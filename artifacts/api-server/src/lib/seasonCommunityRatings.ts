import { sql } from "drizzle-orm";
import { summariseRatings } from "./communityRatings";

/** Only catalogue identity and aggregate votes leave the server; never season notes or history. */
export function seasonRatingsQuery(tmdbId: number) {
  return sql`
    SELECT season_number AS "seasonNumber", rating AS stars, count(*)::int AS count FROM (
      SELECT DISTINCT ON (user_id, season_number) season_number, rating FROM (
        SELECT e.user_id, e.updated_at, e.id, s.ordinality,
          CASE WHEN jsonb_typeof(s.value->'number') = 'number'
                 AND s.value->>'number' ~ '^[1-9][0-9]{0,8}$'
            THEN (s.value->>'number')::int END AS season_number,
          CASE WHEN jsonb_typeof(s.value->'rating') = 'number'
                 AND s.value->>'rating' ~ '^[1-5]$'
            THEN (s.value->>'rating')::int END AS rating
        FROM entries e
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(e.seasons) = 'array' THEN e.seasons ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS s(value, ordinality)
        WHERE e.tmdb_id = ${tmdbId} AND e.type = 'show'
      ) season_votes WHERE season_number IS NOT NULL
      ORDER BY user_id, season_number, updated_at DESC, id DESC, ordinality DESC
    ) current_ratings WHERE rating BETWEEN 1 AND 5
    GROUP BY season_number, rating ORDER BY season_number, rating DESC`;
}

export function summariseSeasonRatings(buckets: Array<{ seasonNumber: number; stars: number; count: number }>) {
  const seasons = new Map<number, Array<{ stars: number; count: number }>>();
  for (const bucket of buckets) {
    if (!Number.isInteger(bucket.seasonNumber) || bucket.seasonNumber < 1 ||
        !Number.isInteger(bucket.stars) || bucket.stars < 1 || bucket.stars > 5 ||
        !Number.isInteger(bucket.count) || bucket.count <= 0) continue;
    const votes = seasons.get(bucket.seasonNumber) ?? [];
    votes.push({ stars: bucket.stars, count: bucket.count });
    seasons.set(bucket.seasonNumber, votes);
  }
  return {
    seasons: [...seasons].sort(([a], [b]) => a - b)
      .map(([seasonNumber, votes]) => ({ seasonNumber, ...summariseRatings(votes) })),
  };
}
