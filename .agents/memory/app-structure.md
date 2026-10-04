---
name: App routing and structure
description: Page structure, routing, and nav for CouchPotato
---

## Navigation
- Bottom nav (4 tabs): Home (/), Search (/search), Watchlist (/watchlist), Stats (/stats)
- NO top navbar — BottomNav component replaces the old NavBar
- Profile accessible via Spud avatar in top-right of Home page (/profile)

## Routes
- / → Home (greeting + continue watching + recently watched grid)
- /my-shows → MyShows (3 status tabs: Completed, Watching, Plan to Watch)
- /search → Search (TMDB-powered, popular/trending fallback)
- /watchlist → Watchlist (plan_to_watch entries, quick-action buttons)
- /stats → Stats (donut chart + monthly bar + tag breakdown)
- /profile → Profile (Spud hero card + settings list)
- /entry/:id → EntryDetail (view/edit/delete)
- /add → AddEntry (supports TMDB prefill via URL params)

## Add from search URL params
/add?tmdbId=X&title=Y&type=Z&year=N&poster=URL&overview=TEXT

**Why:** Bottom nav is standard mobile UX. Search + Watchlist are first-class tabs per brand mockups.
