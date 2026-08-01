---
name: Date entry UX — year-only
description: All quick-add flows use year-only (YYYY-01-01) not a full date; full add-entry page shows year picker not a date input
---

# Date entry UX — year-only

## The rule
When a user adds a title (quick-add sheet in Search, Recs, or Onboarding, or full Add Entry page), store the year only — never ask for the exact date up front. The API receives `dateWatched: "${year}-01-01"` as a placeholder.

**Why:** Users can't easily remember the exact date they watched something. The year is enough for stats and grouping. The full date can be edited later from the entry detail page.

## How to apply
- `add-entry.tsx`: `watchedYear` state (default current year) → year `<select>` → `dateWatched: \`${watchedYear}-01-01\``
- `search.tsx` quick-add: `quickAddYear` state → year picker row in bottom sheet → same pattern
- `home.tsx` rec quick-add: `recYear` state → year picker row in rec bottom sheet → same pattern
- `onboarding.tsx`: uses `\`${new Date().getFullYear()}-01-01\`` as a fixed placeholder (no picker — bulk select flow)
- Entry detail edit page: still allows editing to a full date for users who want precision
