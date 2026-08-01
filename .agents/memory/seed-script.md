---
name: 2026 watch list seed script
description: Script to import 63 titles from the user's 2026 watch list via TMDB
---

## Location
scripts/seed-2026.ts

## Run command
```
TMDB_API_KEY=xxx pnpm --filter @workspace/db exec tsx ../../scripts/seed-2026.ts
```
OR just run it in the workspace shell after the secret is set.

## What it does
1. Loops through 63 titles with spread dates across Jan–Jul 2026
2. Searches each via TMDB /search/multi
3. Inserts the best match (or a manual entry if no match) with status='completed'
4. Rate-limits to ~260ms between requests (TMDB free tier: 40 req/s)
5. Reports insert count and manual fallback count

## Requires
- TMDB_API_KEY set as Replit Secret
- API server can be stopped during seed (script writes directly to DB via drizzle)

**Why:** User provided 63 specific titles to pre-populate the 2026 collection. Script handles typos/fuzzy matches via TMDB fuzzy search.
