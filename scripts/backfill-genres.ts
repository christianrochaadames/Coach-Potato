/**
 * Backfills TMDB genres as tags for all existing entries that have a tmdbId
 * but no tags (or an empty tags array).
 * Run with: pnpm --filter @workspace/db exec tsx ../../scripts/backfill-genres.ts
 */
import { pool } from "../lib/db/src/index.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

async function fetchGenres(tmdbId: number, type: string): Promise<string[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY not set");
  const endpoint =
    type === "movie"
      ? `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}&language=en-US`
      : `${TMDB_BASE}/tv/${tmdbId}?api_key=${apiKey}&language=en-US`;
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const data = (await res.json()) as { genres?: { id: number }[] };
  return (data.genres ?? []).map((g) => GENRE_MAP[g.id]).filter(Boolean) as string[];
}

async function main() {
  const { rows } = await pool.query<{ id: number; title: string; type: string; tmdb_id: number | null; tags: string[] | null }>(
    `SELECT id, title, type, tmdb_id, tags FROM entries WHERE tmdb_id IS NOT NULL`
  );

  const toUpdate = rows.filter((r) => !r.tags || r.tags.length === 0);
  console.log(`Found ${toUpdate.length} entries to backfill out of ${rows.length} with a tmdbId`);

  let updated = 0;
  for (const entry of toUpdate) {
    try {
      const genres = await fetchGenres(entry.tmdb_id!, entry.type);
      if (genres.length > 0) {
        await pool.query(
          `UPDATE entries SET tags = $1 WHERE id = $2`,
          [JSON.stringify(genres), entry.id]
        );
        console.log(`  ✓ ${entry.title}: ${genres.join(", ")}`);
        updated++;
      } else {
        console.log(`  — ${entry.title}: no genres found`);
      }
      // Gentle rate limiting — stay well within TMDB's 40 req/10s limit
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`  ✗ ${entry.title}:`, err);
    }
  }
  console.log(`\nDone. Updated ${updated}/${toUpdate.length} entries.`);
  await pool.end();
}

main().catch(console.error);
