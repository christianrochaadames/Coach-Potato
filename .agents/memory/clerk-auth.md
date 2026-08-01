---
name: Clerk Auth integration
description: How Clerk is wired into this project — proxy setup, userId pattern, data migration, DB tables
---

# Clerk Auth integration

## Key setup decisions

**Express middleware order (app.ts):**
`clerkProxyMiddleware` MUST come before body parsers (it streams raw bytes). Then `cors`, then `express.json`, then `clerkMiddleware`.

**requireAuth middleware** (`artifacts/api-server/src/middlewares/requireAuth.ts`):
- Uses `getAuth(req).userId` from `@clerk/express`
- Sets `req.userId` on the request
- Also fires a background `UPDATE entries SET user_id = $1 WHERE user_id = 'seed_data'` auto-claim (see migration below)

**Why:** The `clerkMiddleware` call must use `publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY)` so the same server handles any Clerk domain.

## Frontend wiring (App.tsx)

- `publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)` from `@clerk/react/internal` — **must use this exact pattern**
- `clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL` — empty in dev, auto-set in prod
- `WouterRouter` wraps `ClerkProviderWithRoutes` which uses `useLocation` for `routerPush`/`routerReplace`
- `stripBase(path)` strips the `BASE_URL` prefix before passing to `setLocation`
- `ClerkQueryClientCacheInvalidator` clears React Query cache on user change (placed inside ClerkProvider, inside QueryClientProvider)
- `@layer theme, base, clerk, components, utilities;` must come BEFORE `@import 'tailwindcss'` in index.css

## Data migration (seed_data auto-claim)

Existing entries had no userId. On `push-force`, they got `user_id = 'seed_data'` (column default). The `requireAuth` middleware fires a background UPDATE on every authenticated request: `UPDATE entries SET user_id = $1 WHERE user_id = 'seed_data'`. After the first sign-in, this is a permanent no-op. Only the first user to authenticate claims the data — subsequent users get an empty collection.

**Why:** This avoids a one-time migration script and requires zero user action. Safe because the UPDATE targets only the literal string 'seed_data', not real Clerk userIDs.

## profiles table

`lib/db/src/schema/profiles.ts` — `userId TEXT PK, username TEXT UNIQUE, bio TEXT, onboardingCompleted BOOLEAN DEFAULT FALSE, createdAt, updatedAt`. Managed via `GET /api/profile` + `PATCH /api/profile`.

## Onboarding flow

After sign-up, `fallbackRedirectUrl` points to `/onboarding`. The onboarding page fetches `/api/tmdb/popular`, shows 16 popular titles as selectable posters, then batch-creates entries + PATCHes `onboardingCompleted: true`. Skipping also marks onboarding complete so it never shows again.

## Route protection pattern

`<Show when="signed-in">` / `<Show when="signed-out">` from `@clerk/react`. All app routes use `ProtectedRoute` wrapper → redirects to `/sign-in` if unauthenticated. The base path `/` uses `HomeRoute` which shows `Landing` (guest) or `Home` (signed-in).

## Appearance config

CouchPotato brand: `colorPrimary: "#116149"`, `colorBackground: "#FFF3E8"`, `fontFamily: "Manrope, system-ui, sans-serif"`, `borderRadius: "14px"`. Logo served from `${basePath}/logo.svg`.
