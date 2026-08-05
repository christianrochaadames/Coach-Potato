import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

// ---------------------------------------------------------------------------
// Simple in-memory TTL cache
// Keys are strings; entries expire automatically after their TTL.
// The cache is intentionally not persisted across server restarts.
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const TTL_HOUR = 60 * 60 * 1000;        // 1 hour  — cast/detail/show
const TTL_HALF_HOUR = 30 * 60 * 1000;   // 30 min  — trending/popular
const TTL_DAY = 24 * 60 * 60 * 1000;    // 24 hours — watch providers, top-rated

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tmdbCache = new Map<string, CacheEntry<any>>();

function cacheGet<T>(key: string): T | null {
  const entry = tmdbCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tmdbCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  tmdbCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
// ---------------------------------------------------------------------------

function getApiKey(): string | undefined {
  return process.env.TMDB_API_KEY;
}

// TMDB genre ID → human-readable name (covers both movie & TV genres)
const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

interface TmdbResult {
  tmdbId: number;
  title: string;
  type: "movie" | "show";
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
}

function mapItem(item: Record<string, unknown>, mediaType: "movie" | "tv"): TmdbResult {
  const isMovie = mediaType === "movie";
  const rawTitle = isMovie ? (item.title as string) : (item.name as string);
  const rawDate = isMovie
    ? (item.release_date as string | undefined)
    : (item.first_air_date as string | undefined);
  const year = rawDate ? parseInt(rawDate.split("-")[0], 10) : null;
  const posterPath = item.poster_path as string | null;
  const genreIds = (item.genre_ids as number[] | undefined) ?? [];
  const genres = genreIds.map((id) => GENRE_MAP[id]).filter(Boolean) as string[];
  return {
    tmdbId: item.id as number,
    title: rawTitle ?? "Unknown",
    type: isMovie ? "movie" : "show",
    year: year && !isNaN(year) ? year : null,
    posterUrl: posterPath ? `${POSTER_BASE}${posterPath}` : null,
    overview: (item.overview as string) || null,
    genres,
  };
}

// GET /tmdb/search?q=...
router.get("/tmdb/search", requireAuth, async (req, res) => {
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
router.get("/tmdb/trending", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured. Add it as a Replit Secret." });
    return;
  }

  const cached = cacheGet<{ results: TmdbResult[] }>("trending");
  if (cached) { res.json(cached); return; }

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

    const payload = { results };
    cacheSet("trending", payload, TTL_HALF_HOUR);
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "tmdb trending error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tmdb/popular
router.get("/tmdb/popular", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured. Add it as a Replit Secret." });
    return;
  }

  const cached = cacheGet<{ movies: TmdbResult[]; shows: TmdbResult[] }>("popular");
  if (cached) { res.json(cached); return; }

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

    const payload = { movies, shows };
    cacheSet("popular", payload, TTL_HALF_HOUR);
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "tmdb popular error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tmdb/top-rated — hand-curated all-time iconic titles for onboarding picker
router.get("/tmdb/top-rated", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured." });
    return;
  }

  const cached = cacheGet<{ movies: TmdbResult[]; shows: TmdbResult[] }>("top-rated");
  if (cached) { res.json(cached); return; }

  try {
    // The most universally recognised movies and TV shows ever made
    const movieIds = [
      278,    // The Shawshank Redemption (1994)
      238,    // The Godfather (1972)
      155,    // The Dark Knight (2008)
      680,    // Pulp Fiction (1994)
      13,     // Forrest Gump (1994)
      27205,  // Inception (2010)
      597,    // Titanic (1997)
      329,    // Jurassic Park (1993)
      424,    // Schindler's List (1993)
      550,    // Fight Club (1999)
      157336, // Interstellar (2014)
      19404,  // Dilwale Dulhania Le Jayenge — swapped for Home Alone
    ];
    // Use Home Alone instead of that last one
    const finalMovieIds = [278, 238, 155, 680, 13, 27205, 597, 329, 424, 550, 157336, 771];

    const showIds = [
      1668,   // Friends
      1396,   // Breaking Bad
      1435,   // The Sopranos
      1399,   // Game of Thrones
      66732,  // Stranger Things
      2316,   // The Office (US)
      1400,   // Seinfeld
      1438,   // The Wire
      63351,  // Succession
      87108,  // Chernobyl
      4809,   // Lost
      1412,   // Grey's Anatomy
    ];

    const [movieResults, showResults] = await Promise.all([
      Promise.all(
        finalMovieIds.map((id) =>
          fetch(`${TMDB_BASE}/movie/${id}?api_key=${apiKey}&language=en-US`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => (d ? mapItem(d as Record<string, unknown>, "movie") : null))
            .catch(() => null)
        )
      ),
      Promise.all(
        showIds.map((id) =>
          fetch(`${TMDB_BASE}/tv/${id}?api_key=${apiKey}&language=en-US`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => (d ? mapItem(d as Record<string, unknown>, "tv") : null))
            .catch(() => null)
        )
      ),
    ]);

    const movies = movieResults.filter(Boolean) as TmdbResult[];
    const shows  = showResults.filter(Boolean) as TmdbResult[];
    const payload = { movies, shows };
    cacheSet("top-rated", payload, TTL_DAY);
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "tmdb top-rated error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tmdb/show/:id — season count for TV shows
router.get("/tmdb/show/:id", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }
  const tmdbId = Number(req.params.id);
  if (isNaN(tmdbId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const cacheKey = `show:${tmdbId}`;
  const cached = cacheGet<{ numberOfSeasons: number | null; name: string | null }>(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const url = `${TMDB_BASE}/tv/${tmdbId}?api_key=${apiKey}&language=en-US`;
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: "TMDB request failed" });
      return;
    }
    const data = (await response.json()) as {
      number_of_seasons?: number;
      name?: string;
    };
    const payload = {
      numberOfSeasons: data.number_of_seasons ?? null,
      name: data.name ?? null,
    };
    cacheSet(cacheKey, payload, TTL_HOUR);
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "tmdb show error");
    res.status(500).json({ error: "Internal server error" });
  }
});

interface CastMember {
  name: string;
  character: string;
  profileUrl: string | null;
  order: number;
}

interface CrewMember {
  name: string;
  job: string;
  profileUrl: string | null;
}

interface TmdbDetailResponse {
  title: string;
  overview: string | null;
  cast: CastMember[];
  directors: CrewMember[];
  runtime: number | null;
  releaseYear: number | null;
  voteAverage: number | null;
  genres: string[];
}

function mapCredits(credits: {
  cast?: Record<string, unknown>[];
  crew?: Record<string, unknown>[];
}): { cast: CastMember[]; directors: CrewMember[] } {
  const cast: CastMember[] = (credits.cast ?? [])
    .slice(0, 15)
    .map((m) => ({
      name: m.name as string,
      character: (m.character as string) ?? "",
      profileUrl: m.profile_path ? `https://image.tmdb.org/t/p/w185${m.profile_path}` : null,
      order: m.order as number ?? 99,
    }));

  const directors: CrewMember[] = (credits.crew ?? [])
    .filter((m) => m.job === "Director" || m.job === "Creator")
    .slice(0, 3)
    .map((m) => ({
      name: m.name as string,
      job: m.job as string,
      profileUrl: m.profile_path ? `https://image.tmdb.org/t/p/w185${m.profile_path}` : null,
    }));

  return { cast, directors };
}

// GET /tmdb/movie/:id — movie details with cast and director
router.get("/tmdb/movie/:id", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }
  const tmdbId = Number(req.params.id);
  if (isNaN(tmdbId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const cacheKey = `movie:${tmdbId}`;
  const cached = cacheGet<TmdbDetailResponse>(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}&language=en-US&append_to_response=credits`;
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: "TMDB request failed" });
      return;
    }
    const data = (await response.json()) as {
      title?: string;
      overview?: string;
      runtime?: number;
      release_date?: string;
      vote_average?: number;
      genres?: { id: number; name: string }[];
      credits?: {
        cast?: Record<string, unknown>[];
        crew?: Record<string, unknown>[];
      };
    };

    const { cast, directors } = mapCredits(data.credits ?? {});
    const year = data.release_date ? parseInt(data.release_date.split("-")[0], 10) : null;
    const genreNames = (data.genres ?? []).map((g) => g.name);

    const result: TmdbDetailResponse = {
      title: data.title ?? "",
      overview: data.overview ?? null,
      cast,
      directors,
      runtime: data.runtime ?? null,
      releaseYear: year && !isNaN(year) ? year : null,
      voteAverage: data.vote_average ?? null,
      genres: genreNames,
    };

    cacheSet(cacheKey, result, TTL_HOUR);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "tmdb movie detail error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tmdb/tv/:id — TV show details with cast and creator
router.get("/tmdb/tv/:id", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }
  const tmdbId = Number(req.params.id);
  if (isNaN(tmdbId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const cacheKey = `tv:${tmdbId}`;
  const cached = cacheGet<TmdbDetailResponse>(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const url = `${TMDB_BASE}/tv/${tmdbId}?api_key=${apiKey}&language=en-US&append_to_response=credits`;
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: "TMDB request failed" });
      return;
    }
    const data = (await response.json()) as {
      name?: string;
      overview?: string;
      number_of_seasons?: number;
      first_air_date?: string;
      vote_average?: number;
      genres?: { id: number; name: string }[];
      created_by?: { name: string; profile_path: string | null }[];
      credits?: {
        cast?: Record<string, unknown>[];
        crew?: Record<string, unknown>[];
      };
    };

    const { cast } = mapCredits(data.credits ?? {});

    // TV shows have created_by separate from credits crew
    const creators: CrewMember[] = (data.created_by ?? []).slice(0, 3).map((c) => ({
      name: c.name,
      job: "Creator",
      profileUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }));

    const year = data.first_air_date ? parseInt(data.first_air_date.split("-")[0], 10) : null;
    const genreNames = (data.genres ?? []).map((g) => g.name);

    const result: TmdbDetailResponse = {
      title: data.name ?? "",
      overview: data.overview ?? null,
      cast,
      directors: creators,
      runtime: null,
      releaseYear: year && !isNaN(year) ? year : null,
      voteAverage: data.vote_average ?? null,
      genres: genreNames,
    };

    cacheSet(cacheKey, result, TTL_HOUR);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "tmdb tv detail error");
    res.status(500).json({ error: "Internal server error" });
  }
});

interface WatchProvider {
  providerId: number;
  providerName: string;
  logoUrl: string;
  displayPriority: number;
}

interface WatchProvidersResponse {
  region: string;
  link: string | null;
  streaming: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

function mapProviders(
  raw: Record<string, unknown>[],
): WatchProvider[] {
  return (raw ?? []).map((p) => ({
    providerId: p.provider_id as number,
    providerName: p.provider_name as string,
    logoUrl: `https://image.tmdb.org/t/p/w92${p.logo_path as string}`,
    displayPriority: (p.display_priority as number) ?? 99,
  }));
}

async function fetchWatchProviders(
  mediaType: "movie" | "tv",
  tmdbId: number,
  region: string,
  apiKey: string,
): Promise<WatchProvidersResponse> {
  const url = `${TMDB_BASE}/${mediaType}/${tmdbId}/watch/providers?api_key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB watch/providers returned ${response.status}`);
  }
  const data = (await response.json()) as {
    results?: Record<string, {
      link?: string;
      flatrate?: Record<string, unknown>[];
      rent?: Record<string, unknown>[];
      buy?: Record<string, unknown>[];
    }>;
  };
  const regionData = data.results?.[region];
  return {
    region,
    link: regionData?.link ?? null,
    streaming: mapProviders(regionData?.flatrate ?? []),
    rent: mapProviders(regionData?.rent ?? []),
    buy: mapProviders(regionData?.buy ?? []),
  };
}

// GET /tmdb/movie/:id/providers?region=US
router.get("/tmdb/movie/:id/providers", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }
  const tmdbId = Number(req.params.id);
  if (isNaN(tmdbId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const region = ((req.query.region as string) || "US").toUpperCase().slice(0, 2);
  const cacheKey = `movie-providers:${tmdbId}:${region}`;
  const cached = cacheGet<WatchProvidersResponse>(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const result = await fetchWatchProviders("movie", tmdbId, region, apiKey);
    cacheSet(cacheKey, result, TTL_DAY);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "tmdb movie providers error");
    res.status(502).json({ error: "TMDB request failed" });
  }
});

// GET /tmdb/tv/:id/providers?region=US
router.get("/tmdb/tv/:id/providers", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }
  const tmdbId = Number(req.params.id);
  if (isNaN(tmdbId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const region = ((req.query.region as string) || "US").toUpperCase().slice(0, 2);
  const cacheKey = `tv-providers:${tmdbId}:${region}`;
  const cached = cacheGet<WatchProvidersResponse>(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const result = await fetchWatchProviders("tv", tmdbId, region, apiKey);
    cacheSet(cacheKey, result, TTL_DAY);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "tmdb tv providers error");
    res.status(502).json({ error: "TMDB request failed" });
  }
});

export default router;
