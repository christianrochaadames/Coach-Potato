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

// Reverse map: genre name → TMDB genre id (for Discover API calls)
const GENRE_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(GENRE_MAP).map(([id, name]) => [name, Number(id)])
);

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
    // Track original_language so we can filter non-matching content
    originalLanguage: (item.original_language as string | null) ?? null,
  };
}

type MappedRec = ReturnType<typeof mapRec>;
type TaggedRec = MappedRec & { recencyRank: number; seedRating: number | null };

// GET /api/recommendations
router.get("/recommendations", requireAuth, async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }

  try {
    // ── 1. Seeds: most recent + highest-rated entries, deduplicated by tmdb_id ──
    // 4-5★ entries are boosted to the front so the algo is anchored on loved content.
    const { rows: recentRows } = await pool.query<{
      tmdb_id: number;
      type: string;
      rating: number | null;
    }>(
      `WITH deduped AS (
         SELECT
           tmdb_id, type, rating,
           ROW_NUMBER() OVER (
             PARTITION BY tmdb_id
             ORDER BY COALESCE(date_watched, created_at) DESC
           ) AS rn,
           COALESCE(date_watched, created_at) AS watch_ts
         FROM entries
         WHERE status = 'completed'
           AND tmdb_id IS NOT NULL
           AND user_id = $1
       )
       SELECT tmdb_id, type, rating
       FROM deduped
       WHERE rn = 1
       ORDER BY
         CASE WHEN rating >= 4 THEN 0 ELSE 1 END,  -- loved titles first
         watch_ts DESC                               -- then by recency
       LIMIT 12`,
      [req.userId]
    );

    // ── 2. Full collection set (to exclude already-seen titles from results) ──
    const { rows: allRows } = await pool.query<{ tmdb_id: number }>(
      `SELECT tmdb_id FROM entries WHERE tmdb_id IS NOT NULL AND user_id = $1`,
      [req.userId]
    );
    const inCollection = new Set(allRows.map((r) => r.tmdb_id));

    // ── 3. Fetch /recommendations AND /similar for each seed in parallel ──
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
          if (inCollection.has(item.id as number)) continue;
          allRecs.push({ ...mapRec(item, mediaType), recencyRank: idx, seedRating: rating });
        }
      } catch { /* ignore per-seed failures */ }
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

    // ── 4. Build genre & language profile from seed results ──
    // This tells us what genres AND what languages the user's taste clusters around.
    const genreFreq = new Map<string, number>();
    const langFreq  = new Map<string, number>();

    for (const rec of allRecs) {
      for (const g of rec.genres) {
        genreFreq.set(g, (genreFreq.get(g) ?? 0) + 1);
      }
      if (rec.originalLanguage) {
        langFreq.set(rec.originalLanguage, (langFreq.get(rec.originalLanguage) ?? 0) + 1);
      }
    }

    // Top genres by frequency (used for scoring and fallback Discover calls)
    const topGenres = [...genreFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);

    // Preferred language: dominant language from seed results, defaulting to "en"
    const preferredLang = [...langFreq.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "en";

    // Allowed languages: user's preferred language + English (as a universal bridge)
    const allowedLangs = new Set([preferredLang, "en"]);

    // ── 5. Discover-based fallback when seed results are thin ──
    // Uses TMDB Discover filtered by the user's detected language + top genres.
    // Far better than raw trending which is dominated by random regional content.
    if (allRecs.length < 10) {
      const topGenreIds = topGenres
        .map((g) => GENRE_NAME_TO_ID[g])
        .filter(Boolean)
        .slice(0, 3)
        .join(",");

      const baseDiscover = `api_key=${apiKey}&language=en-US`
        + `&with_original_language=${preferredLang}`
        + `&sort_by=vote_average.desc`
        + `&vote_count.gte=300`
        + (topGenreIds ? `&with_genres=${topGenreIds}` : "");

      await Promise.all([
        (async () => {
          try {
            const r = await fetch(`${TMDB_BASE}/discover/movie?${baseDiscover}`);
            if (!r.ok) return;
            const d = (await r.json()) as { results?: Record<string, unknown>[] };
            for (const item of d.results ?? []) {
              if (!item.poster_path || inCollection.has(item.id as number)) continue;
              allRecs.push({ ...mapRec(item, "movie"), recencyRank: 50, seedRating: null });
            }
          } catch { /* ignore */ }
        })(),
        (async () => {
          try {
            const r = await fetch(`${TMDB_BASE}/discover/tv?${baseDiscover}`);
            if (!r.ok) return;
            const d = (await r.json()) as { results?: Record<string, unknown>[] };
            for (const item of d.results ?? []) {
              if (!item.poster_path || inCollection.has(item.id as number)) continue;
              allRecs.push({ ...mapRec(item, "tv"), recencyRank: 50, seedRating: null });
            }
          } catch { /* ignore */ }
        })(),
      ]);
    }

    // ── 6. Deduplicate, filter by language, then score ──

    // Rating multiplier: 5★ seed → 0.6 (strong signal), 1★ → 1.4 (weak), null → 1.0
    const ratingMult = (r: number | null) =>
      r === null ? 1.0 : Math.max(0.4, 1.6 - r * 0.2);

    // Genre overlap bonus: how many of this title's genres are in the user's top genres
    const genreBonus = (genres: string[]) =>
      genres.filter((g) => topGenres.includes(g)).length * 0.6;

    const dedupMap = new Map<
      number,
      { item: MappedRec; bestScore: number; count: number }
    >();

    for (const rec of allRecs) {
      // Skip titles in languages the user doesn't watch
      if (rec.originalLanguage && !allowedLangs.has(rec.originalLanguage)) continue;

      const score = rec.recencyRank * ratingMult(rec.seedRating) - genreBonus(rec.genres);
      const existing = dedupMap.get(rec.tmdbId);
      if (!existing) {
        const { recencyRank: _r, seedRating: _s, originalLanguage: _l, ...clean } = rec;
        dedupMap.set(rec.tmdbId, { item: clean, bestScore: score, count: 1 });
      } else {
        existing.count++;
        if (score < existing.bestScore) {
          existing.bestScore = score;
          const { recencyRank: _r, seedRating: _s, originalLanguage: _l, ...clean } = rec;
          existing.item = clean;
        }
      }
    }

    // ── 7. Final rank: multi-seed bonus, then shuffle top 24 → return 12 ──
    const scored = Array.from(dedupMap.values())
      .map(({ item, bestScore, count }) => ({
        item,
        score: bestScore - Math.log(count + 1) * 2,
      }))
      .sort((a, b) => a.score - b.score);

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
