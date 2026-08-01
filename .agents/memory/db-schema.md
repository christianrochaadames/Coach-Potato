---
name: DB schema additions
description: New fields added to entries table beyond the original schema
---

## New columns (added via drizzle push-force)
- status: text enum ('watching' | 'plan_to_watch' | 'completed'), default 'completed'
- synopsis: text, nullable
- tmdbId: integer, nullable
- dateWatched: changed from NOT NULL to nullable (watchlist entries have no date)
- year: changed from NOT NULL to nullable (derived from dateWatched, null if no date)

## Usage patterns
- Watchlist tab → GET /api/entries?status=plan_to_watch
- My Shows Watching → GET /api/entries?status=watching
- My Shows Completed → GET /api/entries?status=completed
- Stats only counts entries where dateWatched IS NOT NULL
- Years only counts entries where year IS NOT NULL

**Why:** New app structure needs status-based filtering. Watchlist entries don't have watched dates yet.
**How to apply:** When creating entries from search/add flow, always pass status field. Existing entries all have status='completed' from the DB default.
