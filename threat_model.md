# Threat Model

## Project Overview

CineLog (branded "CouchPotato") is a multi-user personal movie and TV show tracker. Users log what they watch, browse their watch history in a poster grid, and view per-year stats. Built with React (Vite + Tailwind) for the frontend, Express 5 for the API server, PostgreSQL + Drizzle ORM for storage, and Clerk for authentication. Deployed publicly on Replit autoscale at `https://couch-potato.replit.app`.

## Assets

- **User watch history** — entries table (titles, ratings, dates, notes, tags, platform). Private to each user; exposure allows reading another user's viewing habits.
- **User profiles** — profile rows including name, bio, username, and custom avatar (stored as base64 data URL in Postgres). Contains PII.
- **TMDB API key** — stored as a Replit Secret (`TMDB_API_KEY`). Used server-side to query TMDB for search, metadata, trending, and recommendations. Exhaustion or abuse would degrade the product for all users.
- **Clerk credentials** — `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`. Compromise of the secret key would allow arbitrary session manipulation.
- **Database connection** — `DATABASE_URL` Postgres connection string. Full database access if leaked.
- **Clerk session tokens/cookies** — short-lived JWTs (`__session` cookie) representing authenticated user sessions.

## Trust Boundaries

- **Browser → API** — all requests from the React SPA cross this boundary. Every endpoint that touches user data must validate the Clerk session server-side via `requireAuth`.
- **API → PostgreSQL** — Drizzle ORM with parameterized queries; no raw string interpolation found. SQL injection risk is low.
- **API → TMDB** — server fetches TMDB data with the secret API key. Key is consumed server-side only; not exposed to the client.
- **API → Clerk Frontend API (proxy)** — `/api/__clerk` proxies Clerk's Frontend API in production. Forwarded credentials stay within the Clerk trust boundary.
- **Public / Authenticated surface** — `/api/tmdb/*` routes currently lack `requireAuth` and are reachable unauthenticated. All other data endpoints (`/api/entries`, `/api/stats`, `/api/years`, `/api/profile`, `/api/recommendations`) require a valid Clerk session.

## Scan Anchors

- Entry points: `artifacts/api-server/src/app.ts` (Express app), `artifacts/api-server/src/routes/` (all route files)
- Highest-risk areas: `artifacts/api-server/src/routes/tmdb.ts` (unauthenticated TMDB proxy), `artifacts/api-server/src/app.ts` (CORS config), `artifacts/api-server/src/middlewares/requireAuth.ts` (auth + seed-data claim)
- Public surface: `/api/tmdb/*` (7 unauthenticated routes), `/api/health`, `/api/__clerk`
- Authenticated surface: `/api/entries`, `/api/stats`, `/api/years`, `/api/profile`, `/api/recommendations`
- Dev-only: `scripts/seed-2026.ts` (seed script, not mounted as a route)
- Mockup sandbox: `artifacts/mockup-sandbox/` (design artifact, dev-only)

## Threat Categories

### Spoofing

Clerk handles authentication. `requireAuth` validates the Clerk JWT on every protected request and sets `req.userId`. The publishable key is resolved dynamically from the request host to support custom domains. Risk is low for authenticated endpoints. The seed-data auto-claim in `requireAuth` transfers all rows with `user_id = 'seed_data'` to the first authenticated user — this is a one-way migration that becomes a no-op once rows are claimed, but the first user to authenticate gets all legacy seed data.

### Tampering

All database writes on the entries and profile routes are scoped to `req.userId` (from the trusted Clerk session). Input validated via Zod schemas. No client-supplied `userId` or `ownerId` accepted. Low risk.

### Information Disclosure

- TMDB proxy routes expose movie/TV metadata (public TMDB data). No user PII is returned from these endpoints.
- `GET /api/entries` and other user-data endpoints are correctly scoped per user. No cross-user data exposure identified.
- The `avatarUrl` profile field stores base64 image data directly in Postgres (up to ~220 KB per user). This is an unbounded growth risk rather than a disclosure risk.

### Denial of Service

- No rate limiting on any endpoint (authenticated or unauthenticated).
- The 7 unauthenticated TMDB proxy endpoints can be called without a Clerk session, allowing any client to exhaust the TMDB API key quota.
- The `/api/tmdb/top-rated` endpoint issues 24 parallel upstream TMDB requests per call. Repeated calls by anonymous users could cause TMDB rate-limit errors affecting all users.
- `express.json({ limit: "5mb" })` sets a 5 MB body limit; profile `avatarUrl` Zod max is 300 KB. Authenticated users could repeatedly upload 300 KB avatars, inflating Postgres storage.

### Elevation of Privilege

- No admin role or privilege separation exists yet — all authenticated users have the same capabilities.
- CORS is configured with `origin: true` and `credentials: true`, reflecting any origin. If Clerk stores the session as an HTTP-only cookie, a malicious page could make credentialed cross-origin API requests, bypassing the CORS same-origin protection.
- Parameterized Drizzle queries prevent SQL injection. No command execution paths found.
