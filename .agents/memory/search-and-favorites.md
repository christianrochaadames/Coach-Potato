---
name: Search and favorites behavior
description: Product rules for collection filtering in discovery/search and the simplified Profile favorite detail presentation.
---

Popular TV and movie discovery rails exclude titles already in the user's collection, while Search results show all matching titles regardless of collection membership. Search, Home, and Watchlist open the same detail sheet with the same Watch, Watching, and Watchlist actions; selecting Watched requires year/rating confirmation and then shows a centered Saved notice. Watchlist adds a trash action in the sheet header.

Profile top-three TV/movie sections are intentionally simple: favorite detail sheets do not include recommendation rails, and favorite rows show the title without numbered rank badges.

**Why:** Discovery is for finding something new, while Search is for locating any title—including one already saved. Profile favorites should prioritize the chosen titles and avoid extra ranking/recommendation clutter.

**How to apply:** Keep filtering at the popular-list rendering boundary only. Reuse the Search detail sheet for both popular and query results, and keep Profile favorite detail content focused on the selected title.

**Current UI rules:** Do not add share actions to entry detail sheets or entry detail pages. Changing a saved status updates the existing entry so it moves between collection sections instead of creating a duplicate. Reuse the shared detail sheet for Home, Search, Watchlist, and Stats Top Rated. Existing watched TV shows may show editable season ratings below the season panel; Stats Top Rated uses overall five-star ratings only.

**API constraint:** New non-watched entries must omit date/rating fields rather than send `null`; updates may use `null` to clear watched metadata. Invalidate the entries query without params so all status-filtered lists refresh.

**Why:** The create schema treats watched date and rating as optional non-null values, while the update schema allows nulls for clearing them.

**How to apply:** Build status-aware create/update payloads in shared quick-save flows and invalidate the `/api/entries` query prefix after mutations.