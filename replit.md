# CineLog

A personal movie and TV show tracker — log everything you watch, browse your year in a cinematic poster grid, and celebrate your viewing stats.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/cinelog run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, Recharts, Framer Motion, wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod v3, `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/entries.ts` — entries table schema
- `artifacts/api-server/src/routes/entries.ts` — CRUD routes
- `artifacts/api-server/src/routes/stats.ts` — year stats route
- `artifacts/api-server/src/routes/years.ts` — available years route
- `artifacts/cinelog/src/` — frontend React app

## Architecture decisions

- Single-user personal tracker — no auth/login, no multi-user isolation
- Tags stored as JSONB array in Postgres (flexible, no normalization needed)
- Year is denormalized column (derived from dateWatched) for fast filtering
- Poster URL is optional — frontend generates gradient placeholder from title hash
- After codegen, patch `lib/api-zod/src/generated/api.ts`: `sed -i 's/zod\.int()/zod.number().int()/g'` (Orval generates Zod v4 syntax but workspace uses v3)

## Product

- **Home / Year View** (`/`) — poster grid of everything watched in selected year, live search, filter by type/rating, year switcher
- **Log Entry** (`/add`) — form to log a movie or show with 5-star rating picker, tags, optional poster URL
- **Stats** (`/stats`) — per-year dashboard: total count, movies vs shows, avg rating, monthly bar chart, tag breakdown
- **Detail / Edit** (`/entry/:id`) — full entry view with inline edit and delete

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run codegen then `sed -i 's/zod\.int()/zod.number().int()/g' lib/api-zod/src/generated/api.ts` before running `typecheck:libs`
- `zod/v4` subpath import not available in `artifacts/api-server` — use `import { z } from "zod"` and `z.number().int()` syntax there
- Tags are stored as JSONB (`string[]`) in the DB — always cast when reading

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
