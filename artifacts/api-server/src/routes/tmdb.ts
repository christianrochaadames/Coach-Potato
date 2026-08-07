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

// ---------------------------------------------------------------------------
// Curated pools — Hollywood blockbusters + big-streamer TV only.
// The full pool is searched & cached once per day. Pages rotate a window of
// 10 from each pool so every refresh tab shows a different set.
// ---------------------------------------------------------------------------

const MOVIE_QUERIES = [
  "A Minecraft Movie",
  "Deadpool Wolverine",
  "Inside Out 2",
  "Dune Part Two",
  "Gladiator II",
  "Moana 2",
  "Sonic the Hedgehog 3",
  "Godzilla x Kong The New Empire",
  "Beetlejuice Beetlejuice",
  "Oppenheimer",
  "Barbie",
  "The Super Mario Bros Movie",
  "Avatar The Way of Water",
  "Top Gun Maverick",
  "Alien Romulus",
  "Twisters",
  "Mission Impossible Dead Reckoning Part One",
  "Bad Boys Ride or Die",
  "Despicable Me 4",
  "Captain America Brave New World",
  "Thunderbolts Marvel 2025",
  "Wonka",
  "Puss in Boots The Last Wish",
  "Fast X",
];

const SHOW_QUERIES = [
  "Severance",           // Apple TV+
  "The Last of Us",      // HBO
  "The White Lotus",     // HBO
  "Squid Game",          // Netflix
  "Wednesday",           // Netflix
  "Stranger Things",     // Netflix
  "Nobody Wants This",   // Netflix
  "Silo",                // Apple TV+
  "Succession",          // HBO
  "House of the Dragon", // HBO
  "Yellowstone",         // Paramount+
  "Tulsa King",          // Paramount+
  "The Morning Show",    // Apple TV+
  "Ted Lasso",           // Apple TV+
  "Shrinking",           // Apple TV+
  "Hacks",               // Max (HBO)
  "Ozark",               // Netflix
  "The Diplomat",        // Netflix
  "The Penguin",         // HBO
  "Landman",             // Paramount+
  "Adolescence",         // Netflix
  "Emily in Paris",      // Netflix
];

function rotateSlice<T>(arr: T[], page: number, count: number): T[] {
  if (arr.length === 0) return [];
  const offset = ((page - 1) * Math.floor(count / 2)) % arr.length;
  const result: T[] = [];
  for (let i = 0; i < Math.min(count, arr.length); i++) {
    result.push(arr[(offset + i) % arr.length]);
  }
  return result;
}

// GET /tmdb/popular?page=1
router.get("/tmdb/popular", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured. Add it as a Replit Secret." });
    return;
  }

  const page = Math.min(5, Math.max(1, parseInt((req.query.page as string) || "1", 10) || 1));
  const today = new Date().toISOString().slice(0, 10);
  const poolKey = `popular-pool-v2:${today}`;

  let pool = cacheGet<{ movies: TmdbResult[]; shows: TmdbResult[] }>(poolKey);

  if (!pool) {
    try {
      const [movieResults, showResults] = await Promise.all([
        Promise.all(
          MOVIE_QUERIES.map((q) =>
            fetch(`${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(q)}&language=en-US&page=1&include_adult=false`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => { const first = (d?.results ?? [])[0]; return first ? mapItem(first as Record<string, unknown>, "movie") : null; })
              .catch(() => null)
          )
        ),
        Promise.all(
          SHOW_QUERIES.map((q) =>
            fetch(`${TMDB_BASE}/search/tv?api_key=${apiKey}&query=${encodeURIComponent(q)}&language=en-US&page=1&include_adult=false`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => { const first = (d?.results ?? [])[0]; return first ? mapItem(first as Record<string, unknown>, "tv") : null; })
              .catch(() => null)
          )
        ),
      ]);

      pool = {
        movies: movieResults.filter(Boolean) as TmdbResult[],
        shows:  showResults.filter(Boolean) as TmdbResult[],
      };
      cacheSet(poolKey, pool, TTL_DAY);
    } catch (err) {
      req.log.error({ err }, "tmdb popular pool error");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  res.json({
    movies: rotateSlice(pool.movies, page, 10),
    shows:  rotateSlice(pool.shows,  page, 10),
  });
});

// GET /tmdb/top-rated — curated recent picks for onboarding (fixed, never changes)
router.get("/tmdb/top-rated", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured." });
    return;
  }

  const TTL_WEEK = 7 * 24 * 60 * 60 * 1000;
  const cached = cacheGet<{ items: TmdbResult[] }>("top-rated-v3");
  if (cached) { res.json(cached); return; }

  // Curated list — ordered by display preference, searched by name+type so
  // posters are always fresh and no hard-coded TMDB IDs can go stale.
  const PICKS: { query: string; type: "movie" | "tv" }[] = [
    { query: "Stranger Things",        type: "tv" },
    { query: "Wednesday",              type: "tv" },
    { query: "The White Lotus",        type: "tv" },
    { query: "Silo",                   type: "tv" },
    { query: "The Last of Us",         type: "tv" },
    { query: "Severance",              type: "tv" },
    { query: "Nobody Wants This",      type: "tv" },
    { query: "A Minecraft Movie",      type: "movie" },
    { query: "Jack Ryan",              type: "tv" },
    { query: "In the Land of Saints and Sinners", type: "movie" },
    { query: "Apex",                   type: "movie" },
    { query: "Toy Story 5",            type: "movie" },
    { query: "Mobland",                type: "tv" },
    { query: "The Devil Wears Prada 2", type: "movie" },
    { query: "Squid Game",              type: "tv" },
    { query: "Succession",              type: "tv" },
  ];

  try {
    const results = await Promise.all(
      PICKS.map(async ({ query, type }) => {
        const mediaType = type === "tv" ? "tv" : "movie";
        const url = `${TMDB_BASE}/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`;
        const r = await fetch(url).catch(() => null);
        if (!r || !r.ok) return null;
        const data = (await r.json()) as { results?: Record<string, unknown>[] };
        const first = (data.results ?? [])[0];
        if (!first) return null;
        return mapItem(first, type === "movie" ? "movie" : "tv");
      })
    );

    const items = results.filter(Boolean) as TmdbResult[];
    const payload = { items };
    cacheSet("top-rated-v2", payload, TTL_WEEK);
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "tmdb top-rated error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tmdb/show/:id — season count + season list with poster URLs
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
  const cached = cacheGet<{
    numberOfSeasons: number | null;
    name: string | null;
    seasons: { number: number; name: string; episodeCount: number; posterUrl: string | null; airYear: number | null }[];
  }>(cacheKey);
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
      seasons?: {
        season_number: number;
        name: string;
        episode_count: number;
        poster_path: string | null;
        air_date: string | null;
      }[];
    };
    const payload = {
      numberOfSeasons: data.number_of_seasons ?? null,
      name: data.name ?? null,
      seasons: (data.seasons ?? []).map((s) => ({
        number: s.season_number,
        name: s.name ?? `Season ${s.season_number}`,
        episodeCount: s.episode_count ?? 0,
        posterUrl: s.poster_path ? `${POSTER_BASE}${s.poster_path}` : null,
        airYear: s.air_date ? parseInt(s.air_date.split("-")[0], 10) || null : null,
      })),
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

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

// GET /tmdb/movie/:id/recommendations
router.get("/tmdb/movie/:id/recommendations", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) { res.status(503).json({ error: "TMDB_API_KEY not configured" }); return; }
  const tmdbId = Number(req.params.id);
  if (isNaN(tmdbId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const cacheKey = `movie-recs:${tmdbId}`;
  const cached = cacheGet<TmdbResult[]>(cacheKey);
  if (cached) { res.json({ results: cached }); return; }
  try {
    const resp = await fetch(`${TMDB_BASE}/movie/${tmdbId}/recommendations?api_key=${apiKey}&language=en-US`);
    if (!resp.ok) { res.status(502).json({ error: "TMDB error" }); return; }
    const data = await resp.json() as { results?: Record<string, unknown>[] };
    const results = (data.results ?? []).slice(0, 12).map((item) => mapItem(item, "movie"));
    cacheSet(cacheKey, results, TTL_HOUR);
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "tmdb movie recommendations error");
    res.status(502).json({ error: "TMDB request failed" });
  }
});

// GET /tmdb/tv/:id/recommendations
router.get("/tmdb/tv/:id/recommendations", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) { res.status(503).json({ error: "TMDB_API_KEY not configured" }); return; }
  const tmdbId = Number(req.params.id);
  if (isNaN(tmdbId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const cacheKey = `tv-recs:${tmdbId}`;
  const cached = cacheGet<TmdbResult[]>(cacheKey);
  if (cached) { res.json({ results: cached }); return; }
  try {
    const resp = await fetch(`${TMDB_BASE}/tv/${tmdbId}/recommendations?api_key=${apiKey}&language=en-US`);
    if (!resp.ok) { res.status(502).json({ error: "TMDB error" }); return; }
    const data = await resp.json() as { results?: Record<string, unknown>[] };
    const results = (data.results ?? []).slice(0, 12).map((item) => mapItem(item, "tv"));
    cacheSet(cacheKey, results, TTL_HOUR);
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "tmdb tv recommendations error");
    res.status(502).json({ error: "TMDB request failed" });
  }
});

// ---------------------------------------------------------------------------
// Season episodes
// ---------------------------------------------------------------------------

// GET /tmdb/tv/:id/season/:seasonNum
router.get("/tmdb/tv/:id/season/:seasonNum", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) { res.status(503).json({ error: "TMDB_API_KEY not configured" }); return; }
  const tmdbId = Number(req.params.id);
  const seasonNum = Number(req.params.seasonNum);
  if (isNaN(tmdbId) || isNaN(seasonNum)) { res.status(400).json({ error: "Invalid id" }); return; }
  const cacheKey = `tv-season:${tmdbId}:${seasonNum}`;
  const cached = cacheGet<object>(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const resp = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${seasonNum}?api_key=${apiKey}&language=en-US`);
    if (!resp.ok) { res.status(502).json({ error: "TMDB error" }); return; }
    const data = await resp.json() as { episodes?: Record<string, unknown>[] };
    const result = {
      seasonNumber: seasonNum,
      episodes: (data.episodes ?? []).map((ep) => ({
        episode_number: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        air_date: ep.air_date,
        runtime: ep.runtime ?? null,
        stillUrl: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
      })),
    };
    cacheSet(cacheKey, result, TTL_DAY);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "tmdb tv season error");
    res.status(502).json({ error: "TMDB request failed" });
  }
});

export default router;
