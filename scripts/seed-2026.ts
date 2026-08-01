/**
 * Seed script: imports 63 titles from 2026 watchlist via TMDB search.
 * Run with: pnpm --filter @workspace/db exec tsx ../../scripts/seed-2026.ts
 *
 * Requires TMDB_API_KEY in environment.
 */
import { db, entriesTable } from "../lib/db/src/index.js";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

if (!TMDB_API_KEY) {
  console.error("❌ TMDB_API_KEY environment variable is required.");
  console.error("   Add it as a Replit Secret, then re-run this script.");
  process.exit(1);
}

interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
}

async function searchTmdb(query: string): Promise<TmdbSearchResult | null> {
  const url = `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { results?: TmdbSearchResult[] };
    const results = (data.results ?? []).filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
    return results[0] ?? null;
  } catch {
    return null;
  }
}

// 63 titles to seed, spread across Jan–Jul 2026
const TITLES_WITH_DATES: { title: string; date: string }[] = [
  // January 2026
  { title: "Awake Dead Man", date: "2026-01-04" },
  { title: "Run Away Harlan Coben", date: "2026-01-06" },
  { title: "His and Hers", date: "2026-01-09" },
  { title: "Stay Close Harlan Coben", date: "2026-01-12" },
  { title: "The Rip", date: "2026-01-15" },
  { title: "Seven Dials Mystery", date: "2026-01-18" },
  { title: "The Night Manager", date: "2026-01-22" },
  { title: "The Night Manager Season 2", date: "2026-01-26" },
  { title: "Unfamiliar", date: "2026-01-30" },
  // February 2026
  { title: "Il Falsario", date: "2026-02-02" },
  { title: "Steal", date: "2026-02-05" },
  { title: "The Night Agent", date: "2026-02-08" },
  { title: "Nuremberg", date: "2026-02-11" },
  { title: "Astronaut", date: "2026-02-14" },
  { title: "The Bold and the Beautiful Journey", date: "2026-02-17" },
  { title: "Murdoch Mysteries", date: "2026-02-20" },
  { title: "Goodbye June", date: "2026-02-23" },
  { title: "Vanished", date: "2026-02-26" },
  // March 2026
  { title: "Peaky Blinders", date: "2026-03-02" },
  { title: "Manosphere", date: "2026-03-05" },
  { title: "Joy", date: "2026-03-08" },
  { title: "Nobody 2", date: "2026-03-11" },
  { title: "Scarpetta", date: "2026-03-14" },
  { title: "The Predator of Seville", date: "2026-03-17" },
  { title: "The Truth and Tragedy of Moriah Wilson", date: "2026-03-20" },
  { title: "Crime 101", date: "2026-03-23" },
  { title: "Muzzle City of Wolves", date: "2026-03-26" },
  // April 2026
  { title: "Firebreak", date: "2026-04-02" },
  { title: "Better Man", date: "2026-04-05" },
  { title: "Greenland", date: "2026-04-08" },
  { title: "Greenland 2", date: "2026-04-11" },
  { title: "Eternity", date: "2026-04-14" },
  { title: "Big Mistakes", date: "2026-04-17" },
  { title: "Vladimir", date: "2026-04-20" },
  { title: "Something Very Bad Is Going to Happen", date: "2026-04-23" },
  { title: "Sentimental Value", date: "2026-04-26" },
  // May 2026
  { title: "Out of Love", date: "2026-05-02" },
  { title: "Scarpetta", date: "2026-05-05" },
  { title: "APEX", date: "2026-05-08" },
  { title: "Hamnet", date: "2026-05-11" },
  { title: "Mercy", date: "2026-05-14" },
  { title: "Legends", date: "2026-05-17" },
  { title: "The Crash", date: "2026-05-20" },
  { title: "Should I Marry a Murderer", date: "2026-05-23" },
  { title: "Kylie Jenner documentary", date: "2026-05-26" },
  // June 2026
  { title: "Mindcage", date: "2026-06-02" },
  { title: "Ladies First", date: "2026-06-05" },
  { title: "Detective Hole", date: "2026-06-08" },
  { title: "The Witness", date: "2026-06-11" },
  { title: "Michael Jackson documentary", date: "2026-06-14" },
  { title: "Office Romance", date: "2026-06-17" },
  { title: "Ripple", date: "2026-06-20" },
  { title: "I Will Find You", date: "2026-06-23" },
  { title: "The Better Sister", date: "2026-06-26" },
  // July 2026
  { title: "Tom Clancy Jack Ryan", date: "2026-07-02" },
  { title: "Enola Holmes 3", date: "2026-07-05" },
  { title: "No Tengo Miedo", date: "2026-07-08" },
  { title: "Mexico 86", date: "2026-07-11" },
  { title: "Costa Concordia disaster", date: "2026-07-14" },
  { title: "The Hustle", date: "2026-07-17" },
  { title: "A Toxic Love Story", date: "2026-07-20" },
  { title: "The House in the Prairie", date: "2026-07-23" },
  { title: "1883", date: "2026-07-26" },
];

async function main() {
  console.log(`🎬 Starting seed for ${TITLES_WITH_DATES.length} titles...\n`);

  let inserted = 0;
  let manualFallback = 0;

  for (const { title, date } of TITLES_WITH_DATES) {
    process.stdout.write(`  Searching: "${title}"... `);

    const result = await searchTmdb(title);

    let entry: {
      title: string;
      type: "movie" | "show";
      status: "completed";
      dateWatched: string;
      year: number;
      posterUrl: string | null;
      synopsis: string | null;
      tmdbId: number | null;
      tags: string[];
    };

    if (result) {
      const isMovie = result.media_type === "movie";
      const rawDate = isMovie ? result.release_date : result.first_air_date;
      const tmdbYear = rawDate ? parseInt(rawDate.split("-")[0], 10) : 2026;
      const resolvedTitle = isMovie ? (result.title ?? title) : (result.name ?? title);
      console.log(`✓ "${resolvedTitle}" (${isMovie ? "movie" : "show"}, ${tmdbYear})`);
      entry = {
        title: resolvedTitle,
        type: isMovie ? "movie" : "show",
        status: "completed",
        dateWatched: date,
        year: parseInt(date.split("-")[0], 10),
        posterUrl: result.poster_path ? `${POSTER_BASE}${result.poster_path}` : null,
        synopsis: result.overview ?? null,
        tmdbId: result.id,
        tags: [],
      };
    } else {
      console.log(`⚠  No TMDB match — creating manual entry`);
      manualFallback++;
      entry = {
        title,
        type: "movie",
        status: "completed",
        dateWatched: date,
        year: 2026,
        posterUrl: null,
        synopsis: null,
        tmdbId: null,
        tags: [],
      };
    }

    await db.insert(entriesTable).values(entry);
    inserted++;

    // Rate-limit: 40 req/s max on TMDB free tier
    await new Promise((r) => setTimeout(r, 260));
  }

  console.log(`\n✅ Done! Inserted ${inserted} entries (${manualFallback} manual fallbacks).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
