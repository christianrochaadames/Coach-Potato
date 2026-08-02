import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

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
router.get("/recommendations", requireAuth, async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }

  try {
    // 1. Grab up to 8 recently-watched entries that have a TMDB id
    const { rows: recentRows } = await pool.query<{ tmdb_id: number; type: string; rating: number | null }>(
      `SELECT DISTINCT ON (tmdb_id) tmdb_id, type, rating
       FROM entries
       WHERE status = 'completed' AND tmdb_id IS NOT NULL AND user_id = $1
       ORDER BY tmdb_id, date_watched DESC NULLS LAST, created_at DESC
       LIMIT 8`,
      [req.userId]
    );

    // 2. Collect all tmdb_ids already in the collection so we can filter them out
    const { rows: allRows } = await pool.query<{ tmdb_id: number }>(
      `SELECT tmdb_id FROM entries WHERE tmdb_id IS NOT NULL AND user_id = $1`,
      [req.userId]
    );
    const inCollection = new Set(allRows.map((r) => r.tmdb_id));

    // 3. Fetch TMDB recommendations AND similar titles for each seed entry.
    //    Many niche/foreign titles return 0 results from /recommendations alone,
    //    so we also hit /similar and merge both pools together.
    type TaggedRec = ReturnType<typeof mapRec> & { recencyRank: number; seedRating: number | null };
    const allRecs: TaggedRec[] = [];

    const fetchEndpoint = async (
      mediaType: "movie" | "tv",
      tmdbId: number,
      endpoint: "recommendations" | "similar",
      idx: number,
      rating: number | null
    ) => {
      try {
        const url = `${TMDB_BASE}/${mediaType}/${tmdbId}/${endpoint}?api_key=${apiKey}&language=en-US&page=1`;
        const r = await fetch(url);
        if (!r.ok) return;
        const data = (await r.json()) as { results?: Record<string, unknown>[] };
        for (const item of data.results ?? []) {
          if (!item.poster_path) continue;
          const id = item.id as number;
          if (inCollection.has(id)) continue;
          allRecs.push({ ...mapRec(item, mediaType), recencyRank: idx, seedRating: rating });
        }
      } catch { /* ignore */ }
    };

    await Promise.all(
      recentRows.flatMap((row, idx) => {
        const mediaType = row.type === "movie" ? "movie" : "tv";
        return [
          fetchEndpoint(mediaType, row.tmdb_id, "recommendations", idx, row.rating),
          fetchEndpoint(mediaType, row.tmdb_id, "similar",         idx, row.rating),
        ];
      })
    );

    // 3b. If the pool is still very small, pad with trending titles the user
    //     hasn't seen yet so the section is never empty.
    if (allRecs.length < 6) {
      try {
        const trendUrl = `${TMDB_BASE}/trending/all/week?api_key=${apiKey}&language=en-US`;
        const tr = await fetch(trendUrl);
        if (tr.ok) {
          const tdata = (await tr.json()) as { results?: Record<string, unknown>[] };
          for (const item of tdata.results ?? []) {
            if (!item.poster_path) continue;
            const id = item.id as number;
            if (inCollection.has(id)) continue;
            const mt = (item.media_type as string) === "movie" ? "movie" : "tv";
            allRecs.push({ ...mapRec(item, mt), recencyRank: 99, seedRating: null });
          }
        }
      } catch { /* ignore */ }
    }

    // 4. Deduplicate: keep the entry sourced from the highest-quality seed
    //    (lowest effective score); track how many distinct seeds recommended it.
    const dedupMap = new Map<
      number,
      { item: ReturnType<typeof mapRec>; bestSeedScore: number; count: number }
    >();

    // Rating multiplier: 5★ → 0.6 (very strong signal), 1★ → 1.4 (weak signal)
    // Unrated entries use 1.0 (neutral).
    const ratingMultiplier = (r: number | null) => {
      if (r === null) return 1.0;
      return 1.6 - r * 0.2; // 5→0.6  4→0.8  3→1.0  2→1.2  1→1.4
    };

    for (const rec of allRecs) {
      const seedScore = rec.recencyRank * ratingMultiplier(rec.seedRating);
      const existing = dedupMap.get(rec.tmdbId);
      if (!existing) {
        const { recencyRank: _r, seedRating: _s, ...clean } = rec;
        dedupMap.set(rec.tmdbId, { item: clean, bestSeedScore: seedScore, count: 1 });
      } else {
        existing.count++;
        if (seedScore < existing.bestSeedScore) {
          existing.bestSeedScore = seedScore;
          const { recencyRank: _r, seedRating: _s, ...clean } = rec;
          existing.item = clean;
        }
      }
    }

    // 5. Final score: lower is better.
    //    bestSeedScore already encodes recency + rating quality.
    //    Subtract a bonus for items recommended by multiple seeds.
    const scored = Array.from(dedupMap.values())
      .map(({ item, bestSeedScore, count }) => ({
        item,
        score: bestSeedScore - Math.log(count) * 2,
      }))
      .sort((a, b) => a.score - b.score);

    // Take top 24 candidates by score, then shuffle them so every Refresh
    // call surfaces a different mix of well-matched titles.
    const candidates = scored.slice(0, 24);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    res.json({ results: candidates.slice(0, 12).map((s) => s.item) });
  } catch (err) {
    req.log.error({ err }, "recommendations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
