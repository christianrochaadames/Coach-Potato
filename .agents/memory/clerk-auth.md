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
- Must not auto-claim legacy `seed_data` rows for the first authenticated user

**Why:** The `clerkMiddleware` call must use `publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY)` so the same server handles any Clerk domain.

## Frontend wiring (App.tsx)

- `publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)` from `@clerk/react/internal` — **must use this exact pattern**
- `clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL` — empty in dev, auto-set in prod
- `WouterRouter` wraps `ClerkProviderWithRoutes` which uses `useLocation` for `routerPush`/`routerReplace`
- `stripBase(path)` strips the `BASE_URL` prefix before passing to `setLocation`
- `ClerkQueryClientCacheInvalidator` clears React Query cache on user change (placed inside ClerkProvider, inside QueryClientProvider)
- `@layer theme, base, clerk, components, utilities;` must come BEFORE `@import 'tailwindcss'` in index.css

## User-scoped data and native account switching

Every protected API query must use the Clerk `auth.userId` directly. The API must not auto-claim legacy `seed_data` rows for the first authenticated user: that behavior can assign a shared library to whichever account signs in first.

On native, clear the shared TanStack Query client when `useAuth().userId` changes, and make direct profile/recommendation fetches depend on that user ID. Native screens can stay mounted across logout/login, so clearing only from a sign-out button is insufficient.

**Why:** A shared query client and stale native screen state can make one account’s library appear under another account even when the database rows remain correctly owned.

**How to apply:** Treat Clerk user ID changes as a data-boundary event: invalidate cached queries and refetch all direct user-scoped requests before showing the next account’s content.

## Native token timing

Keep the module-level native token getter stable through a `useRef`; do not
replace it from an effect whose dependency is Clerk's `getToken` function.
Critical raw requests may also pass the current token explicitly.

**Why:** Clerk can recreate `getToken` between renders, and the effect cleanup
can briefly clear the shared getter. Native requests made during that window
arrive at the API as 401 even though the UI still appears signed in.

**How to apply:** Register one stable getter for the provider lifetime, gate
initial requests on `isLoaded`/`isSignedIn`/`userId`, and use the current token
for direct mobile requests such as profile and TMDB calls.

## profiles table

`lib/db/src/schema/profiles.ts` — `userId TEXT PK, username TEXT UNIQUE, bio TEXT, onboardingCompleted BOOLEAN DEFAULT FALSE, createdAt, updatedAt`. Managed via `GET /api/profile` + `PATCH /api/profile`.

## Onboarding flow

After sign-up, `fallbackRedirectUrl` points to `/onboarding`. The onboarding page fetches `/api/tmdb/popular`, shows 16 popular titles as selectable posters, then batch-creates entries + PATCHes `onboardingCompleted: true`. Skipping also marks onboarding complete so it never shows again.

## Route protection pattern

`<Show when="signed-in">` / `<Show when="signed-out">` from `@clerk/react`. All app routes use `ProtectedRoute` wrapper → redirects to `/sign-in` if unauthenticated. The base path `/` uses `HomeRoute` which shows `Landing` (guest) or `Home` (signed-in).

## Appearance config

CouchPotato brand: `colorPrimary: "#116149"`, `colorBackground: "#FFF3E8"`, `fontFamily: "Manrope, system-ui, sans-serif"`, `borderRadius: "14px"`. Logo served from `${basePath}/logo.svg`.
