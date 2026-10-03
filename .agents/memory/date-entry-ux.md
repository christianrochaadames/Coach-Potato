---
name: Date entry UX
description: New watched saves collect year only; existing watched entries can edit month and year, while other add flows keep the year-only convention
---

# Date entry UX

## The rule
When a user adds a title, avoid asking for an exact day. The watched confirmation sheet collects the year only and stores `YYYY-01-01`. Existing watched entries can later be refined to a month and year, stored as the first day of that month (`YYYY-MM-01`).

**Why:** Adding a title should stay quick, while existing watched history benefits from an optional month for more useful stats.

## How to apply
- `add-entry.tsx`: `watchedYear` state (default current year) → year `<select>` → `dateWatched: \`${watchedYear}-01-01\``
- Search detail sheet watched confirmation: year control → `dateWatched: \`${year}-01-01\``
- Existing watched detail sheets: month/year steppers and rating stars autosave the watched metadata
- `home.tsx` rec quick-add: `recYear` state → year picker row in rec bottom sheet → same pattern
- `onboarding.tsx`: uses `\`${new Date().getFullYear()}-01-01\`` as a fixed placeholder (no picker — bulk select flow)
- Entry detail edit page: still allows editing to a full date for users who want precision
