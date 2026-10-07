import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// Simple in-memory cache (24h) to avoid hammering OMDB free tier
const cache = new Map<string, { data: OmdbRatings; expiresAt: number }>();
const TTL = 24 * 60 * 60 * 1000;

interface OmdbRatings {
  rtScore: string | null;
  imdbRating: string | null;
  imdbId: string | null;
}

function cacheGet(key: string): OmdbRatings | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

// GET /omdb/ratings?title=&year=
router.get("/omdb/ratings", requireAuth, async (req, res) => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    // Graceful degradation — no error, just no data
    res.json({ rtScore: null, imdbRating: null, imdbId: null });
    return;
  }

  const title = (req.query.title as string | undefined) ?? "";
  const year = (req.query.year as string | undefined) ?? "";

  if (!title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const cacheKey = `${title.toLowerCase()}:${year}`;
  const cached = cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("t", title);
    url.searchParams.set("r", "json");
    if (year) url.searchParams.set("y", year);

    const resp = await fetch(url.toString());
    if (!resp.ok) { res.json({ rtScore: null, imdbRating: null, imdbId: null }); return; }

    const data = await resp.json() as {
      Response: string;
      Ratings?: { Source: string; Value: string }[];
      imdbRating?: string;
      imdbID?: string;
    };

    if (data.Response === "False") {
      const result: OmdbRatings = { rtScore: null, imdbRating: null, imdbId: null };
      cache.set(cacheKey, { data: result, expiresAt: Date.now() + TTL });
      res.json(result);
      return;
    }

    const rtRating = (data.Ratings ?? []).find((r) => r.Source === "Rotten Tomatoes");
    const result: OmdbRatings = {
      rtScore: rtRating?.Value ?? null,
      imdbRating: data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null,
      imdbId: data.imdbID ?? null,
    };

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + TTL });
    res.json(result);
  } catch (err) {
    (req as any).log?.error?.({ err }, "omdb ratings error");
    res.json({ rtScore: null, imdbRating: null, imdbId: null });
  }
});

export default router;
