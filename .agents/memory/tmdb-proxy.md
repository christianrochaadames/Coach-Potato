---
name: TMDB proxy routes
description: Server-side TMDB proxy endpoints in the API server
---

## Routes
- GET /api/tmdb/search?q=... → { results: TmdbResult[] }
- GET /api/tmdb/trending → { results: TmdbResult[] }
- GET /api/tmdb/popular → { movies: TmdbResult[], shows: TmdbResult[] }

## TmdbResult shape
{ tmdbId, title, type: 'movie'|'show', year: number|null, posterUrl: string|null, overview: string|null }

## API Key
- Requires TMDB_API_KEY env variable (Replit Secret)
- Returns 503 { error: "TMDB_API_KEY not configured..." } if missing
- Frontend shows yellow warning banner when 503 is received

## Frontend usage
- Search page calls these directly with fetch() (NOT through codegen hooks)
- API key stays server-side, never exposed to browser
- Poster URLs use https://image.tmdb.org/t/p/w500{poster_path}

**Why:** API key must stay server-side. Direct fetch from frontend is fine for these simple GET endpoints.
