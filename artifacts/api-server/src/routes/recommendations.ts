import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

function mapRec(item: Record<string, unknown>, mediaType: "movie" | "tv") {
  const isMovie = mediaType === "movie";
  const rawTitle = isMovie ? (item.title as string) : (item.name as string);
  const rawDate = isMovie
    ? (item.release_date as string | undefined)
    : (item.first_air_date as string | undefined);
  const year = rawDate ? parseInt(rawDate.split("-")[0], 10) : null;
  const posterPath = item.poster_path as string | null;
  const genreIds = (item.genre_ids as number[] | undefined) ?? [];
  return {
    tmdbId: item.id as number,
    title: rawTitle ?? "Unknown",
    type: isMovie ? ("movie" as const) : ("show" as const),
    year: year && !isNaN(year) ? year : null,
    posterUrl: posterPath ? `${POSTER_BASE}${posterPath}` : null,
    overview: (item.overview as string) || null,
    genres: genreIds.map((id) => GENRE_MAP[id]).filter(Boolean) as string[],
  };
}

// GET /api/recommendations
// Fetches personalised TMDB recommendations based on the user's recently watched entries
router.get("/recommendations", async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }

  try {
    // 1. Grab up to 8 recently-watched entries that have a TMDB id
    const { rows: recentRows } = await pool.query<{ tmdb_id: number; type: string }>(
      `SELECT DISTINCT ON (tmdb_id) tmdb_id, type
       FROM entries
       WHERE status = 'completed' AND tmdb_id IS NOT NULL
       ORDER BY tmdb_id, date_watched DESC NULLS LAST, created_at DESC
       LIMIT 8`
    );

    // 2. Collect all tmdb_ids already in the collection so we can filter them out
    const { rows: allRows } = await pool.query<{ tmdb_id: number }>(
      `SELECT tmdb_id FROM entries WHERE tmdb_id IS NOT NULL`
    );
    const inCollection = new Set(allRows.map((r) => r.tmdb_id));

    // 3. Fetch TMDB recommendations for each seed entry in parallel.
    //    Tag each result with the recency rank of the seed that produced it
    //    (0 = most recently watched, higher = older) so we can weight results.
    type TaggedRec = ReturnType<typeof mapRec> & { recencyRank: number };
    const allRecs: TaggedRec[] = [];

    await Promise.all(
      recentRows.map(async (row, idx) => {
        const mediaType = row.type === "movie" ? "movie" : "tv";
        try {
          const url = `${TMDB_BASE}/${mediaType}/${row.tmdb_id}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
          const r = await fetch(url);
          if (!r.ok) return;
          const data = (await r.json()) as { results?: Record<string, unknown>[] };
          for (const item of data.results ?? []) {
            if (!item.poster_path) continue;
            const id = item.id as number;
            if (inCollection.has(id)) continue;
            allRecs.push({ ...mapRec(item, mediaType), recencyRank: idx });
          }
        } catch {
          // ignore individual failures
        }
      })
    );

    // 4. Deduplicate: for each tmdbId keep the entry sourced from the most recent
    //    seed (lowest recencyRank); also track how many seeds recommended it.
    const dedupMap = new Map<
      number,
      { item: ReturnType<typeof mapRec>; bestRank: number; count: number }
    >();
    for (const rec of allRecs) {
      const existing = dedupMap.get(rec.tmdbId);
      if (!existing) {
        const { recencyRank: _, ...clean } = rec;
        dedupMap.set(rec.tmdbId, { item: clean, bestRank: rec.recencyRank, count: 1 });
      } else {
        existing.count++;
        if (rec.recencyRank < existing.bestRank) {
          existing.bestRank = rec.recencyRank;
          const { recencyRank: _, ...clean } = rec;
          existing.item = clean;
        }
      }
    }

    // 5. Score: lower is better.
    //    Recent seeds (low bestRank) score well; appearing across multiple seeds
    //    gives a bonus (subtract log(count) * 2).
    const scored = Array.from(dedupMap.values())
      .map(({ item, bestRank, count }) => ({
        item,
        score: bestRank - Math.log(count) * 2,
      }))
      .sort((a, b) => a.score - b.score);

    res.json({ results: scored.slice(0, 12).map((s) => s.item) });
  } catch (err) {
    req.log.error({ err }, "recommendations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
