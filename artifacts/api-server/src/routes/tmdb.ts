import { Router } from "express";

const router = Router();
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

function getApiKey(): string | undefined {
  return process.env.TMDB_API_KEY;
}

interface TmdbResult {
  tmdbId: number;
  title: string;
  type: "movie" | "show";
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
}

function mapItem(item: Record<string, unknown>, mediaType: "movie" | "tv"): TmdbResult {
  const isMovie = mediaType === "movie";
  const rawTitle = isMovie ? (item.title as string) : (item.name as string);
  const rawDate = isMovie
    ? (item.release_date as string | undefined)
    : (item.first_air_date as string | undefined);
  const year = rawDate ? parseInt(rawDate.split("-")[0], 10) : null;
  const posterPath = item.poster_path as string | null;
  return {
    tmdbId: item.id as number,
    title: rawTitle ?? "Unknown",
    type: isMovie ? "movie" : "show",
    year: year && !isNaN(year) ? year : null,
    posterUrl: posterPath ? `${POSTER_BASE}${posterPath}` : null,
    overview: (item.overview as string) || null,
  };
}

// GET /tmdb/search?q=...
router.get("/tmdb/search", async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured. Add it as a Replit Secret." });
    return;
  }
  const q = req.query.q as string | undefined;
  if (!q || q.trim().length === 0) {
    res.status(400).json({ error: "q parameter is required" });
    return;
  }

  try {
    const url = `${TMDB_BASE}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(q)}&language=en-US&page=1&include_adult=false`;
    const response = await fetch(url);
    if (!response.ok) {
      req.log.error({ status: response.status }, "TMDB search upstream error");
      res.status(502).json({ error: "TMDB search failed" });
      return;
    }
    const data = (await response.json()) as { results?: Record<string, unknown>[] };
    const results: TmdbResult[] = (data.results ?? [])
      .filter(
        (item) =>
          (item.media_type as string) === "movie" || (item.media_type as string) === "tv"
      )
      .slice(0, 12)
      .map((item) => mapItem(item, (item.media_type as string) === "movie" ? "movie" : "tv"));

    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "tmdb search error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tmdb/trending
router.get("/tmdb/trending", async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured. Add it as a Replit Secret." });
    return;
  }

  try {
    const url = `${TMDB_BASE}/trending/all/week?api_key=${apiKey}&language=en-US`;
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: "TMDB trending failed" });
      return;
    }
    const data = (await response.json()) as { results?: Record<string, unknown>[] };
    const results: TmdbResult[] = (data.results ?? [])
      .filter(
        (item) =>
          (item.media_type as string) === "movie" || (item.media_type as string) === "tv"
      )
      .slice(0, 10)
      .map((item) => mapItem(item, (item.media_type as string) === "movie" ? "movie" : "tv"));

    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "tmdb trending error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tmdb/popular
router.get("/tmdb/popular", async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured. Add it as a Replit Secret." });
    return;
  }

  try {
    const [moviesRes, showsRes] = await Promise.all([
      fetch(`${TMDB_BASE}/movie/popular?api_key=${apiKey}&language=en-US&page=1`),
      fetch(`${TMDB_BASE}/tv/popular?api_key=${apiKey}&language=en-US&page=1`),
    ]);

    const [moviesData, showsData] = await Promise.all([
      moviesRes.json() as Promise<{ results?: Record<string, unknown>[] }>,
      showsRes.json() as Promise<{ results?: Record<string, unknown>[] }>,
    ]);

    const movies: TmdbResult[] = (moviesData.results ?? [])
      .slice(0, 8)
      .map((item) => mapItem(item, "movie"));
    const shows: TmdbResult[] = (showsData.results ?? [])
      .slice(0, 8)
      .map((item) => mapItem(item, "tv"));

    res.json({ movies, shows });
  } catch (err) {
    req.log.error({ err }, "tmdb popular error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
