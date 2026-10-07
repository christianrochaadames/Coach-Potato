import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { seasonRatingsQuery, summariseSeasonRatings } from "./seasonCommunityRatings";
import { sql } from "drizzle-orm";

test("each season has its own independent average, count and five-star distribution", () => {
  const result = summariseSeasonRatings([
    { seasonNumber: 2, stars: 1, count: 1 }, { seasonNumber: 1, stars: 5, count: 2 },
    { seasonNumber: 1, stars: 2, count: 1 }, { seasonNumber: 2, stars: 3, count: 1 },
  ]);
  assert.deepEqual(result.seasons.map(s => [s.seasonNumber, s.average, s.count]), [[1, 4, 3], [2, 2, 2]]);
  assert.ok(result.seasons.every(s => s.distribution.length === 5));
  assert.deepEqual(Object.keys(result.seasons[0]).sort(), ["average", "count", "distribution", "seasonNumber"]);
});
test("unrated, invalid and non-season data does not produce fabricated scores", () => {
  assert.deepEqual(summariseSeasonRatings([
    { seasonNumber: 0, stars: 5, count: 10 }, { seasonNumber: 1, stars: 0, count: 10 },
    { seasonNumber: 2, stars: 3, count: 0 },
  ]), { seasons: [] });
});
test("season votes deduplicate before cleared ratings are removed, and match only TV identities", () => {
  const query = new PgDialect().sqlToQuery(seasonRatingsQuery(1396));
  assert.deepEqual(query.params, [1396]);
  assert.match(query.sql, /DISTINCT ON \(user_id, season_number\)/);
  assert.match(query.sql, /e\.type = 'show'/);
  assert.ok(query.sql.indexOf("DISTINCT ON") < query.sql.indexOf("current_ratings WHERE rating BETWEEN"));
  assert.match(query.sql, /updated_at DESC, id DESC, ordinality DESC/);
});

test("real PostgreSQL season aggregation handles rewatches, clears, duplicates and separate identities", async t => {
  if (!process.env.DATABASE_URL) { t.skip("Requires the existing workspace database; only fixture SELECTs are used."); return; }
  const { db, pool } = await import("@workspace/db");
  // CTE shadows the real entries table. No stored user data is read, inserted or changed.
  const fixtures = [
    ["member-a", 1396, "show", [{ number: 1, rating: 1 }, { number: 2, rating: 3 }], "2025-01-01", 1],
    ["member-a", 1396, "show", [{ number: 1, rating: 5 }], "2025-01-02", 2],
    ["member-b", 1396, "show", [{ number: 1, rating: 4 }, { number: 2, rating: 1 }], "2025-01-01", 3],
    ["member-c", 1396, "show", [{ number: 1, rating: 5 }, { number: 2, rating: 5 }], "2025-01-01", 4],
    ["member-c", 1396, "show", [{ number: 1, rating: null }], "2025-01-02", 5],
    ["movie-member", 1396, "movie", [{ number: 1, rating: 1 }], "2025-01-03", 6],
    ["other-show-member", 999, "show", [{ number: 1, rating: 1 }], "2025-01-03", 7],
    ["invalid-member", 1396, "show", [{ number: 0, rating: 5 }, { number: 1, rating: "5" }], "2025-01-03", 8],
    ["duplicate-member", 1396, "show", [{ number: 3, rating: 1 }, { number: 3, rating: 5 }], "2025-01-03", 9],
    ["overall-only-member", 1396, "show", [], "2025-01-03", 10],
  ] as const;
  try {
    const rows = fixtures.map(([user, tmdbId, type, seasons, updatedAt, id]) =>
      sql`(${user}::text, ${tmdbId}::int, ${type}::text, ${JSON.stringify(seasons)}::jsonb, ${updatedAt}::timestamp, ${id}::int)`);
    const result = await db.execute(sql`
      WITH entries(user_id, tmdb_id, type, seasons, updated_at, id) AS (VALUES ${sql.join(rows, sql`, `)})
      ${seasonRatingsQuery(1396)}`);
    const scores = summariseSeasonRatings(result.rows.map(row => ({
      seasonNumber: Number(row.seasonNumber), stars: Number(row.stars), count: Number(row.count),
    })));
    assert.deepEqual(scores.seasons.map(s => [s.seasonNumber, s.average, s.count]), [[1, 4.5, 2], [2, 3, 3], [3, 5, 1]]);
    assert.deepEqual(scores.seasons[1].distribution.map(b => b.count), [1, 0, 1, 0, 1]);
  } finally {
    await pool.end();
  }
});
