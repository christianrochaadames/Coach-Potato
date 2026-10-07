import { Router } from "express";
import { pool as dbPool } from "@workspace/db";
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

const parsedDetailTtl = Number.parseInt(process.env.TMDB_CACHE_TTL_MS ?? "", 10);
const TTL_HOUR = Number.isFinite(parsedDetailTtl) && parsedDetailTtl > 0
  ? parsedDetailTtl
  : 60 * 60 * 1000;                     // configurable; default 1 hour — cast/detail/show
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
  popularity: number;
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
    popularity: typeof item.popularity === "number" ? item.popularity : 0,
  };
}

// GET /tmdb/search?q=...
// Strategy: search the full phrase plus its meaningful words across movie/TV
// endpoints, then search TMDB people and merge their movie/TV credits. This
// lets "big adventure" find titles even when TMDB does not match the phrase
// literally, and lets a name such as "James Cameron" find their credits.
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

  const query = q.trim();

  type SearchResp = { results?: Record<string, unknown>[] };
  type SearchCandidate = {
    item: Record<string, unknown>;
    source: "title" | "person";
  };

  async function fetchSearchResults(url: string): Promise<SearchResp> {
    try {
      const r = await fetch(url);
      if (!r.ok) return { results: [] };
      return r.json() as Promise<SearchResp>;
    } catch { return { results: [] }; }
  }

  async function runTitleSearch(term: string, pages = 1): Promise<SearchCandidate[]> {
    const enc = encodeURIComponent(term);
    const pageResults = await Promise.all(
      Array.from({ length: pages }, (_, index) => index + 1).map(page => {
        const base = `&language=en-US&page=${page}&include_adult=false`;
        return Promise.all([
          fetchSearchResults(`${TMDB_BASE}/search/multi?api_key=${apiKey}&query=${enc}${base}`),
          fetchSearchResults(`${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${enc}${base}`),
          fetchSearchResults(`${TMDB_BASE}/search/tv?api_key=${apiKey}&query=${enc}${base}`),
        ]);
      }),
    );

    // Keep raw items so relevance can be scored after all search terms merge.
    const seen = new Set<string>();
    const raw: SearchCandidate[] = [];

    for (const [multiRaw, movieRaw, tvRaw] of pageResults) {
      for (const item of (multiRaw.results ?? [])) {
        const mt = item.media_type as string;
        if (mt !== "movie" && mt !== "tv") continue;
        const key = `${mt}:${item.id}`;
        if (!seen.has(key)) { seen.add(key); raw.push({ item, source: "title" }); }
      }
      for (const item of (movieRaw.results ?? [])) {
        const key = `movie:${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          raw.push({ item: { ...item, media_type: "movie" }, source: "title" });
        }
      }
      for (const item of (tvRaw.results ?? [])) {
        const key = `tv:${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          raw.push({ item: { ...item, media_type: "tv" }, source: "title" });
        }
      }
    }

    return raw;
  }

  async function runPersonCredits(person: Record<string, unknown>): Promise<SearchCandidate[]> {
    const personId = person.id as number | undefined;
    if (!personId) return [];

    const credits = await fetchSearchResults(
      `${TMDB_BASE}/person/${personId}/combined_credits?api_key=${apiKey}&language=en-US`,
    );
    return (credits.results ?? [])
      .filter(item => item.media_type === "movie" || item.media_type === "tv")
      .map(item => ({ item, source: "person" as const }));
  }

  try {
    const ignoredWords = new Set(["the", "and", "for", "with", "from", "into", "that", "this"]);
    const words = query
      .split(/\s+/)
      .map(word => word.trim())
      .filter(word => word.length >= 3 && !ignoredWords.has(word.toLowerCase()));
    const searchTerms = Array.from(new Set([query, ...words])).slice(0, 4);

    const titleCandidates = (await Promise.all(
      searchTerms.map((term, index) => runTitleSearch(term, index === 0 ? 3 : 1)),
    )).flat();

    // TMDB's person search can find actors, directors, writers, and creators.
    // Pull only the most likely people so a common surname does not overwhelm
    // ordinary title matches.
    const people = await fetchSearchResults(
      `${TMDB_BASE}/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
    );
    const personCandidates = (await Promise.all(
      (people.results ?? []).slice(0, 3).map(runPersonCredits),
    )).flat();

    const candidates = [...titleCandidates, ...personCandidates];
    const unique = new Map<string, SearchCandidate>();
    for (const candidate of candidates) {
      const mediaType = candidate.item.media_type as string;
      const id = candidate.item.id as number | undefined;
      if ((mediaType !== "movie" && mediaType !== "tv") || !id) continue;
      const key = `${mediaType}:${id}`;
      const existing = unique.get(key);
      // Prefer a person credit for the same title so a person search keeps its
      // filmography ranking even when that title also matched by name.
      if (!existing || (existing.source === "title" && candidate.source === "person")) {
        unique.set(key, candidate);
      }
    }

    const normalizedQuery = query.toLowerCase().replace(/[^\w]+/g, " ").trim();
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
    const titleRelevance = (item: Record<string, unknown>): number => {
      const title = String(item.title ?? item.name ?? "")
        .toLowerCase()
        .replace(/[^\w]+/g, " ")
        .trim();
      if (!title) return 0;
      if (title === normalizedQuery) return 1000;
      if (title.startsWith(normalizedQuery)) return 850;
      if (queryWords.length > 1 && queryWords.every(word => title.includes(word))) return 750;
      if (queryWords.some(word => title.includes(word))) return 450;
      return 0;
    };

    const results = [...unique.values()]
      .sort((a, b) => {
        const aScore = titleRelevance(a.item) + (a.source === "person" ? 800 : 0);
        const bScore = titleRelevance(b.item) + (b.source === "person" ? 800 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return ((b.item.popularity as number) ?? 0) - ((a.item.popularity as number) ?? 0);
      })
      .slice(0, 50)
      .map(({ item }) => mapItem(item, item.media_type === "movie" ? "movie" : "tv"));

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
// Each pool holds at least 400 eligible titles per media type. A fresh request
// receives a non-overlapping 40-title buffer so saved titles can be replaced
// immediately without making people scroll through the same small set.
// ---------------------------------------------------------------------------

const POPULAR_POOL_SIZE = 400;
const POPULAR_BATCH_SIZE = 40;
const POPULAR_DISCOVERY_PAGES = 25;
const POPULAR_RECENCY_YEARS = 10;

function rotateSlice<T>(arr: T[], page: number, count: number): T[] {
  if (arr.length === 0) return [];
  const offset = ((page - 1) * count) % arr.length;
  const result: T[] = [];
  for (let i = 0; i < Math.min(count, arr.length); i++) {
    result.push(arr[(offset + i) % arr.length]);
  }
  return result;
}

async function buildPopularPool(
  apiKey: string,
  mediaType: "movie" | "tv",
  startPage = 1,
  pageCount = POPULAR_DISCOVERY_PAGES,
): Promise<TmdbResult[]> {
  const currentYear = new Date().getFullYear();
  const recencyParam = mediaType === "movie"
    ? `primary_release_date.gte=${currentYear - POPULAR_RECENCY_YEARS}-01-01`
    : `first_air_date.gte=${currentYear - POPULAR_RECENCY_YEARS}-01-01`;
  const endpoint = mediaType === "movie" ? "movie" : "tv";
  const commonParams = new URLSearchParams({
    api_key: apiKey,
    language: "en-US",
    sort_by: "popularity.desc",
    include_adult: "false",
    with_original_language: "en",
    without_genres: "16",
    "vote_count.gte": "200",
    "vote_average.gte": "5",
    [recencyParam.split("=")[0]]: recencyParam.split("=")[1],
  });

  let successfulPages = 0;
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => startPage + index).map(async page => {
      try {
        const params = new URLSearchParams(commonParams);
        params.set("page", String(page));
        const response = await fetch(`${TMDB_BASE}/discover/${endpoint}?${params.toString()}`, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) return [];
        const payload = await response.json() as { results?: Record<string, unknown>[] };
        successfulPages++;
        return payload.results ?? [];
      } catch {
        return [];
      }
    }),
  );
  if (!successfulPages) throw new Error("Popular title discovery is temporarily unavailable.");

  const seen = new Set<number>();
  return pages
    .flat()
    .map(item => mapItem(item, mediaType))
    .filter(item => {
      if (!item.posterUrl || item.genres.includes("Animation") || item.popularity < 10) return false;
      if (seen.has(item.tmdbId)) return false;
      seen.add(item.tmdbId);
      return true;
    })
    .slice(0, POPULAR_POOL_SIZE);
}

type PopularPool = { movies: TmdbResult[]; shows: TmdbResult[] };
const popularLoads = new Map<string, Promise<PopularPool>>();

// GET /tmdb/popular?page=1
router.get("/tmdb/popular", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured. Add it as a Replit Secret." });
    return;
  }

  const requestedPage = parseInt((req.query.page as string) || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const today = new Date().toISOString().slice(0, 10);
  const poolKey = `popular-pool-v4:${today}`;

  let pool = cacheGet<PopularPool>(poolKey);

  if (!pool) {
    try {
      let loading = popularLoads.get(poolKey);
      if (!loading) {
        // Serve the first four pages promptly; fill the full discovery pool
        // in the background instead of blocking first paint on 50 requests.
        const firstPages = 4;
        loading = Promise.all([
          buildPopularPool(apiKey, "movie", 1, firstPages),
          buildPopularPool(apiKey, "tv", 1, firstPages),
        ]).then(([movies, shows]) => {
          const initial = { movies, shows };
          cacheSet(poolKey, initial, TTL_DAY);
          void Promise.all([
            buildPopularPool(apiKey, "movie", firstPages + 1, POPULAR_DISCOVERY_PAGES - firstPages),
            buildPopularPool(apiKey, "tv", firstPages + 1, POPULAR_DISCOVERY_PAGES - firstPages),
          ]).then(([moreMovies, moreShows]) => {
            const merge = (first: TmdbResult[], more: TmdbResult[]) =>
              [...new Map([...first, ...more].map(item => [item.tmdbId, item])).values()].slice(0, POPULAR_POOL_SIZE);
            cacheSet(poolKey, { movies: merge(movies, moreMovies), shows: merge(shows, moreShows) }, TTL_DAY);
          }).catch(() => req.log.warn("Popular discovery background expansion failed"));
          return initial;
        }).finally(() => popularLoads.delete(poolKey));
        popularLoads.set(poolKey, loading);
      }
      pool = await loading;
    } catch (err) {
      req.log.error({ err }, "tmdb popular pool error");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  try {
    const { rows } = await dbPool.query<{ tmdb_id: number }>(
      `SELECT tmdb_id FROM entries WHERE user_id = $1 AND tmdb_id IS NOT NULL`,
      [req.userId],
    );
    const collectionIds = new Set(rows.map(row => row.tmdb_id));
    const movies = pool.movies.filter(item => !collectionIds.has(item.tmdbId));
    const shows = pool.shows.filter(item => !collectionIds.has(item.tmdbId));

    res.json({
      movies: rotateSlice(movies, page, POPULAR_BATCH_SIZE),
      shows: rotateSlice(shows, page, POPULAR_BATCH_SIZE),
    });
  } catch (err) {
    req.log.error({ err }, "tmdb popular collection filtering error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const ONBOARDING_POOL_SIZE = 320;
const ONBOARDING_POOL_PAGES = 10;
const ONBOARDING_COUNTRIES = "US|GB|FR|DE|ES|IT|IE|NL|BE|SE|DK|NO|FI|PL|AT|CH|PT|GR|CZ";
const INITIAL_ONBOARDING_PICKS: { query: string; type: "movie" | "tv" }[] = [
  { query: "Stranger Things", type: "tv" },
  { query: "Wednesday", type: "tv" },
  { query: "The White Lotus", type: "tv" },
  { query: "Silo", type: "tv" },
  { query: "The Last of Us", type: "tv" },
  { query: "Severance", type: "tv" },
  { query: "Nobody Wants This", type: "tv" },
  { query: "A Minecraft Movie", type: "movie" },
  { query: "Jack Ryan", type: "tv" },
  { query: "In the Land of Saints and Sinners", type: "movie" },
  { query: "Apex", type: "movie" },
  { query: "Toy Story 5", type: "movie" },
  { query: "MobLand", type: "tv" },
  { query: "The Devil Wears Prada 2", type: "movie" },
  { query: "House of the Dragon", type: "tv" },
  { query: "Succession", type: "tv" },
];

async function getOnboardingPool(apiKey: string): Promise<TmdbResult[]> {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `onboarding-popular-v2:${today}`;
  const cached = cacheGet<TmdbResult[]>(cacheKey);
  if (cached) return cached;

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const startDate = threeYearsAgo.toISOString().slice(0, 10);

  const fetchDiscoverPages = async (mediaType: "movie" | "tv"): Promise<TmdbResult[]> => {
    const dateFilter = mediaType === "movie"
      ? `primary_release_date.gte=${startDate}&primary_release_date.lte=${today}`
      : `first_air_date.gte=${startDate}&first_air_date.lte=${today}`;
    const pages = await Promise.all(
      Array.from({ length: ONBOARDING_POOL_PAGES }, (_, index) => index + 1).map(async page => {
        const url = `${TMDB_BASE}/discover/${mediaType}?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&vote_count.gte=100&vote_average.gte=6&with_origin_country=${ONBOARDING_COUNTRIES}&without_genres=16&${dateFilter}&page=${page}`;
        const response = await fetch(url).catch(() => null);
        if (!response || !response.ok) return [];
        const data = (await response.json()) as { results?: Record<string, unknown>[] };
        return (data.results ?? []).map(item => mapItem(item, mediaType));
      }),
    );
    return pages.flat();
  };

  const [movies, shows] = await Promise.all([
    fetchDiscoverPages("movie"),
    fetchDiscoverPages("tv"),
  ]);
  const dedupe = (items: TmdbResult[]) => {
    const seen = new Set<string>();
    return items
      .filter(item => item.posterUrl)
      .filter(item => {
        const key = `${item.type}-${item.tmdbId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.popularity - a.popularity);
  };
  const rankedMovies = dedupe(movies);
  const rankedShows = dedupe(shows);
  const pool: TmdbResult[] = [];
  let movieIndex = 0;
  let showIndex = 0;
  while (
    pool.length < ONBOARDING_POOL_SIZE &&
    (movieIndex < rankedMovies.length || showIndex < rankedShows.length)
  ) {
    if (movieIndex < rankedMovies.length) pool.push(rankedMovies[movieIndex++]);
    if (showIndex < rankedShows.length && pool.length < ONBOARDING_POOL_SIZE) {
      pool.push(rankedShows[showIndex++]);
    }
  }

  cacheSet(cacheKey, pool, TTL_DAY);
  return pool;
}

async function getInitialOnboardingPicks(apiKey: string): Promise<TmdbResult[]> {
  const cacheKey = "onboarding-initial-v1";
  const cached = cacheGet<TmdbResult[]>(cacheKey);
  if (cached) return cached;

  const results = await Promise.all(
    INITIAL_ONBOARDING_PICKS.map(async ({ query, type }) => {
      const mediaType = type === "tv" ? "tv" : "movie";
      const url = `${TMDB_BASE}/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`;
      const response = await fetch(url).catch(() => null);
      if (!response || !response.ok) return null;
      const data = (await response.json()) as { results?: Record<string, unknown>[] };
      const first = (data.results ?? [])[0];
      return first ? mapItem(first, type) : null;
    }),
  );
  const items = results.filter(Boolean) as TmdbResult[];
  cacheSet(cacheKey, items, TTL_DAY);
  return items;
}

// GET /tmdb/onboarding-pool — recent, mainstream discovery pool for onboarding
router.get("/tmdb/onboarding-pool", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured." });
    return;
  }

  try {
    res.json({ items: await getOnboardingPool(apiKey) });
  } catch (err) {
    req.log.error({ err }, "tmdb onboarding pool error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /tmdb/top-rated — the fixed curated first screen for onboarding
router.get("/tmdb/top-rated", requireAuth, async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured." });
    return;
  }

  const TTL_WEEK = 7 * 24 * 60 * 60 * 1000;
  const cached = cacheGet<{ items: TmdbResult[] }>("top-rated-v5");
  if (cached) { res.json(cached); return; }

  try {
    const items = (await getInitialOnboardingPicks(apiKey)).slice(0, 16);
    const payload = { items };
    cacheSet("top-rated-v5", payload, TTL_WEEK);
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
  personId: number;
  order: number;
}

interface CrewMember {
  name: string;
  job: string;
  profileUrl: string | null;
  personId: number;
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
      personId: m.id as number,
      order: m.order as number ?? 99,
    }));

  const directors: CrewMember[] = (credits.crew ?? [])
    .filter((m) => m.job === "Director" || m.job === "Creator")
    .slice(0, 3)
    .map((m) => ({
      name: m.name as string,
      job: m.job as string,
      profileUrl: m.profile_path ? `https://image.tmdb.org/t/p/w185${m.profile_path}` : null,
      personId: m.id as number,
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
  const bypass = req.query.refresh === "1";

  if (!bypass) {
    const cached = cacheGet<TmdbDetailResponse>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
  }
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
    res.setHeader("X-Cache", "MISS");
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
  const bypass = req.query.refresh === "1";

  if (!bypass) {
    const cached = cacheGet<TmdbDetailResponse>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
  }
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
      personId: (c as { id?: number }).id as number,
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
    res.setHeader("X-Cache", "MISS");
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
