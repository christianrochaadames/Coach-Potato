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
    originalLanguage: (item.original_language as string | null) ?? null,
    // For mainstream + recency filtering
    voteCount:  (item.vote_count  as number | null) ?? 0,
    popularity: (item.popularity  as number | null) ?? 0,
  };
}

type MappedRec = ReturnType<typeof mapRec>;
type TaggedRec = MappedRec & {
  recencyRank: number;
  seedRating: number | null;
  seedStatus: string;
};

const MAINSTREAM_POOL_TTL = 30 * 60 * 1000;
const MAINSTREAM_POOL_PAGES = 15;
const mainstreamPoolCache = new Map<string, { expiresAt: number; items: MappedRec[] }>();

async function getMainstreamDiscoveryPool(apiKey: string, currentYear: number): Promise<MappedRec[]> {
  const cacheKey = `english-mainstream-${currentYear}`;
  const cached = mainstreamPoolCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const startYear = currentYear - 10;
  const mediaTypes: Array<"movie" | "tv"> = ["movie", "tv"];
  const requests = mediaTypes.flatMap(mediaType =>
    Array.from({ length: MAINSTREAM_POOL_PAGES }, (_, index) => index + 1).map(async page => {
      const params = new URLSearchParams({
        api_key: apiKey,
        language: "en-US",
        sort_by: "popularity.desc",
        include_adult: "false",
        with_original_language: "en",
        without_genres: "16",
        "vote_count.gte": "200",
        "vote_average.gte": "5",
        page: String(page),
      });
      params.set(
        mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte",
        `${startYear}-01-01`,
      );
      try {
        const response = await fetch(`${TMDB_BASE}/discover/${mediaType}?${params.toString()}`);
        if (!response.ok) return [] as MappedRec[];
        const payload = await response.json() as { results?: Record<string, unknown>[] };
        return (payload.results ?? [])
          .map(item => mapRec(item, mediaType))
          .filter(item =>
            Boolean(item.posterUrl)
            && item.originalLanguage === "en"
            && !item.genres.includes("Animation")
            && item.voteCount >= 200
            && item.popularity >= 10,
          );
      } catch {
        return [] as MappedRec[];
      }
    }),
  );

  const seen = new Set<number>();
  const items = (await Promise.all(requests))
    .flat()
    .filter(item => {
      if (seen.has(item.tmdbId)) return false;
      seen.add(item.tmdbId);
      return true;
    });
  mainstreamPoolCache.set(cacheKey, { expiresAt: Date.now() + MAINSTREAM_POOL_TTL, items });
  return items;
}

// DELETE /api/recommendations/history — clear the current user's seen history so they get fresh picks
router.delete("/recommendations/history", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM recommendation_history WHERE user_id = $1`,
      [req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "deleteRecommendationHistory error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/recommendations/feedback — record like or skip signal
router.post("/recommendations/feedback", requireAuth, async (req, res) => {
  const { tmdbId, signal } = req.body as { tmdbId: unknown; signal: unknown };
  if (!tmdbId || (signal !== "like" && signal !== "skip")) {
    res.status(400).json({ error: "tmdbId and signal ('like'|'skip') required" });
    return;
  }
  try {
    // Upsert: if the user already gave feedback on this title, update the signal
    await pool.query(
      `INSERT INTO recommendation_feedback (user_id, tmdb_id, signal)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, tmdb_id) DO UPDATE SET signal = EXCLUDED.signal`,
      [req.userId, Number(tmdbId), signal]
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "feedback write error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/recommendations
router.get("/recommendations", requireAuth, async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }

  // Current year (for the recency filter)
  const CURRENT_YEAR = new Date().getFullYear();
  const RECENCY_CUTOFF = CURRENT_YEAR - 5; // e.g. 2021 when running in 2026

  try {
    // ── 1. Seeds: most recent + highest-rated entries, deduplicated by tmdb_id ──
    // 4-5★ entries are boosted to the front so the algo is anchored on loved content.
    const { rows: recentRows } = await pool.query<{
      tmdb_id: number;
      type: string;
      rating: number | null;
      status: string;
    }>(
      `WITH deduped AS (
         SELECT
            tmdb_id, type, rating, status,
           ROW_NUMBER() OVER (
             PARTITION BY tmdb_id
             ORDER BY COALESCE(date_watched, created_at) DESC
           ) AS rn,
           COALESCE(date_watched, created_at) AS watch_ts
         FROM entries
          WHERE tmdb_id IS NOT NULL
           AND user_id = $1
       )
        SELECT tmdb_id, type, rating, status
       FROM deduped
       WHERE rn = 1
       ORDER BY
          CASE status
            WHEN 'watching' THEN 0
            WHEN 'plan_to_watch' THEN 1
            ELSE CASE WHEN rating >= 4 THEN 2 ELSE 3 END
          END,
         watch_ts DESC                               -- then by recency
       LIMIT 12`,
      [req.userId]
    );

    // ── 1b. Detect if this user is a vintage watcher ──
    // If the median year of their completed library is older than RECENCY_CUTOFF,
    // they clearly enjoy older content → skip the recency filter for them.
    const { rows: yearRows } = await pool.query<{ median_year: number | null }>(
      `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY year) AS median_year
       FROM entries
       WHERE status = 'completed' AND year IS NOT NULL AND user_id = $1`,
      [req.userId]
    );
    const medianYear = yearRows[0]?.median_year ?? CURRENT_YEAR;
    // Vintage fan = more than half their library is older than the cutoff
    const isVintageFan = medianYear < RECENCY_CUTOFF;

    // ── 2. Build exclusion sets ──
    // 2a. Everything already in the user's collection (watched / watchlist / watching)
    const { rows: allRows } = await pool.query<{ tmdb_id: number }>(
      `SELECT tmdb_id FROM entries WHERE tmdb_id IS NOT NULL AND user_id = $1`,
      [req.userId]
    );
    const inCollection = new Set(allRows.map((r) => r.tmdb_id));

    // 2b. Everything already shown as a recommendation in any previous session/refresh.
    //     We track these so the user never sees the same suggestion twice.
    const { rows: histRows } = await pool.query<{ tmdb_id: number }>(
      `SELECT tmdb_id FROM recommendation_history WHERE user_id = $1`,
      [req.userId]
    );
    const alreadyShown = new Set(histRows.map((r) => r.tmdb_id));

    // 2c. User feedback: skipped titles are permanently excluded; liked titles
    //     are used to amplify genre scoring toward content they signalled interest in.
    const { rows: feedbackRows } = await pool.query<{ tmdb_id: number; signal: string }>(
      `SELECT tmdb_id, signal FROM recommendation_feedback WHERE user_id = $1`,
      [req.userId]
    );
    const skippedIds = new Set(feedbackRows.filter(r => r.signal === "skip").map(r => r.tmdb_id));
    const likedIds   = new Set(feedbackRows.filter(r => r.signal === "like").map(r => r.tmdb_id));

    // ── 3. Fetch /recommendations AND /similar for each seed in parallel ──
    const allRecs: TaggedRec[] = [];

    const fetchEndpoint = async (
      mediaType: "movie" | "tv",
      tmdbId: number,
      endpoint: "recommendations" | "similar",
      idx: number,
      rating: number | null,
      status: string,
    ) => {
      try {
        const url = `${TMDB_BASE}/${mediaType}/${tmdbId}/${endpoint}?api_key=${apiKey}&language=en-US&page=1`;
        const r = await fetch(url);
        if (!r.ok) return;
        const data = (await r.json()) as { results?: Record<string, unknown>[] };
        for (const item of data.results ?? []) {
          if (!item.poster_path) continue;
          if (inCollection.has(item.id as number)) continue;
           allRecs.push({
             ...mapRec(item, mediaType),
             recencyRank: idx,
             seedRating: rating,
             seedStatus: status,
           });
        }
      } catch { /* ignore per-seed failures */ }
    };

    await Promise.all(
      recentRows.flatMap((row, idx) => {
        const mediaType = row.type === "movie" ? "movie" : "tv";
        return [
           fetchEndpoint(mediaType, row.tmdb_id, "recommendations", idx, row.rating, row.status),
           fetchEndpoint(mediaType, row.tmdb_id, "similar",         idx, row.rating, row.status),
        ];
      })
    );

    // ── 4. Build a taste profile, then add a large mainstream fallback pool ──
    const genreFreq = new Map<string, number>();

    for (const rec of allRecs) {
      for (const g of rec.genres) {
        genreFreq.set(g, (genreFreq.get(g) ?? 0) + 1);
      }
    }

    // Top genres by frequency (used for scoring and fallback Discover calls)
    const topGenres = [...genreFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);

    // Home recommendations remain personalised through the genre and seed
    // scoring below, while the shared pool gives every user hundreds of recent
    // blockbuster options before a title can repeat.
    const allowedLangs = new Set(["en"]);
    const mainstreamPool = await getMainstreamDiscoveryPool(apiKey, CURRENT_YEAR);
    for (const item of mainstreamPool) {
      if (inCollection.has(item.tmdbId)) continue;
      allRecs.push({
        ...item,
        recencyRank: 75,
        seedRating: null,
        seedStatus: "mainstream",
      });
    }

    // ── 6. Deduplicate, filter by language, then score ──

    // Collect genres of liked titles from allRecs so we can boost similar content.
    // likedGenres is built from any rec whose tmdbId was explicitly liked.
    const likedGenreFreq = new Map<string, number>();
    for (const rec of allRecs) {
      if (likedIds.has(rec.tmdbId)) {
        for (const g of rec.genres) {
          likedGenreFreq.set(g, (likedGenreFreq.get(g) ?? 0) + 1);
        }
      }
    }

    // Rating multiplier: 5★ seed → 0.6 (strong signal), 1★ → 1.4 (weak), null → 1.0
     const seedMultiplier = (r: number | null, status: string) => {
       if (status === "watching") return 0.55;
       if (status === "plan_to_watch") return 0.65;
       return r === null ? 1.0 : Math.max(0.4, 1.6 - r * 0.2);
     };

    // Genre overlap bonus: how many of this title's genres are in the user's top genres
    const genreBonus = (genres: string[]) =>
      genres.filter((g) => topGenres.includes(g)).length * 0.6;

    // Liked-genre bonus: extra boost for genres explicitly signalled via "like" feedback.
    // Capped at 2.0 so it doesn't totally overshadow the seed-based scoring.
    const likedGenreBonus = (genres: string[]) =>
      Math.min(genres.reduce((sum, g) => sum + (likedGenreFreq.get(g) ?? 0), 0) * 0.4, 2.0);

    // Popularity bonus: mainstream/popular titles score up to 2 extra points lower (better).
    // Capped at popularity=300 (blockbuster level) to prevent one mega-hit dominating.
    const popularityBonus = (pop: number) => Math.min(pop / 300, 1) * 2.0;

    const dedupMap = new Map<
      number,
      { item: MappedRec; bestScore: number; count: number }
    >();

    for (const rec of allRecs) {
      // ── Hard filters ──

      // 0a. Already shown in a previous session or refresh → skip
      if (alreadyShown.has(rec.tmdbId)) continue;

      // 0b. User explicitly skipped this title → never show again
      if (skippedIds.has(rec.tmdbId)) continue;

      // 1. Language: skip content the user doesn't watch
      if (rec.originalLanguage && !allowedLangs.has(rec.originalLanguage)) continue;

      // 2. Recency: skip titles older than 5 years unless the user is a vintage fan.
      //    Year-unknown titles pass through (don't penalise missing metadata).
      if (!isVintageFan && rec.year !== null && rec.year < RECENCY_CUTOFF) continue;

      // 3. Mainstream floor: skip very low-profile titles (indie / festival / obscure).
      //    vote_count < 150  →  not enough audience to be considered mainstream.
      //    popularity  < 5   →  TMDB's own signal that the title has negligible reach.
      if (rec.voteCount < 150 || rec.popularity < 5) continue;

      const score =
        rec.recencyRank * seedMultiplier(rec.seedRating, rec.seedStatus)
        - genreBonus(rec.genres)
        - likedGenreBonus(rec.genres)   // extra pull toward genres the user liked
        - popularityBonus(rec.popularity);
      const existing = dedupMap.get(rec.tmdbId);
      if (!existing) {
        const { recencyRank: _r, seedRating: _s, seedStatus: _ss, ...clean } = rec;
        dedupMap.set(rec.tmdbId, { item: clean, bestScore: score, count: 1 });
      } else {
        existing.count++;
        if (score < existing.bestScore) {
          existing.bestScore = score;
          const { recencyRank: _r, seedRating: _s, seedStatus: _ss, ...clean } = rec;
          existing.item = clean;
        }
      }
    }

    // ── 7. Final rank: multi-seed bonus, then shuffle top 24 → return 12 ──
    let scored = Array.from(dedupMap.values())
      .map(({ item, bestScore, count }) => ({
        item,
        score: bestScore - Math.log(count + 1) * 2,
      }))
      .sort((a, b) => a.score - b.score);

    // ── 7b. Pool exhaustion guard ──
    // If history has grown so large that fewer than 6 fresh results remain,
    // clear the history for this user and rebuild the scored list without
    // the "already shown" filter so they get a fresh cycle.
    if (scored.length < 6 && alreadyShown.size > 0) {
      await pool.query(
        `DELETE FROM recommendation_history WHERE user_id = $1`,
        [req.userId]
      );
      alreadyShown.clear();
      // Re-score the full dedupMap (which was built before the alreadyShown filter,
      // so we rebuild it without that filter applied — dedupMap still has everything)
      // Actually dedupMap was built AFTER the alreadyShown filter, so re-run from allRecs:
      dedupMap.clear();
      for (const rec of allRecs) {
        if (skippedIds.has(rec.tmdbId)) continue; // still respect skip signals after reset
        if (rec.originalLanguage && !allowedLangs.has(rec.originalLanguage)) continue;
        if (!isVintageFan && rec.year !== null && rec.year < RECENCY_CUTOFF) continue;
        if (rec.voteCount < 150 || rec.popularity < 5) continue;
        const score =
         rec.recencyRank * seedMultiplier(rec.seedRating, rec.seedStatus)
          - genreBonus(rec.genres)
          - likedGenreBonus(rec.genres)
          - popularityBonus(rec.popularity);
        const existing = dedupMap.get(rec.tmdbId);
        if (!existing) {
           const { recencyRank: _r, seedRating: _s, seedStatus: _ss, ...clean } = rec;
          dedupMap.set(rec.tmdbId, { item: clean, bestScore: score, count: 1 });
        } else {
          existing.count++;
          if (score < existing.bestScore) {
            existing.bestScore = score;
             const { recencyRank: _r, seedRating: _s, seedStatus: _ss, ...clean } = rec;
            existing.item = clean;
          }
        }
      }
      scored = Array.from(dedupMap.values())
        .map(({ item, bestScore, count }) => ({
          item,
          score: bestScore - Math.log(count + 1) * 2,
        }))
        .sort((a, b) => a.score - b.score);
    }

    const candidates = scored.slice(0, 24);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const toReturn = candidates.slice(0, 12).map((s) => s.item);

    // ── 8. Record shown IDs so they're never surfaced again ──
    // Fire-and-forget (don't block the response). Uses ON CONFLICT DO NOTHING
    // so duplicate inserts from concurrent requests are safe.
    if (toReturn.length > 0) {
      const values = toReturn
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ");
      pool.query(
        `INSERT INTO recommendation_history (user_id, tmdb_id) VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [req.userId, ...toReturn.map((r) => r.tmdbId)]
      ).catch(() => { /* non-critical — ignore write failures */ });
    }

    res.json({ results: toReturn });
  } catch (err) {
    req.log.error({ err }, "recommendations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
