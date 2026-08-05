---
name: Spud brand system (formerly CouchPotato)
description: Complete brand tokens, typography, mascot, logo for the Spud app
---

## App name
- Public-facing name: **Spud** (renamed from Couch Potato — trademark conflict with existing App Store app)
- Backend/DB references can stay as CouchPotato/couch_potato — only the frontend UI name changed
- New logo: `/spud-logo.png` (PNG with black bg, use `mixBlendMode: 'multiply'` on cream backgrounds)
- Logo component: `artifacts/cinelog/src/components/couch-potato-logo.tsx` (still named CouchPotatoLogo for internal use)

## Colors (use hex directly, not CSS variables)
- potato-green: #116149 — primary buttons, nav, CTAs
- couch-blue: #9BD6FF — logo fill, secondary highlights
- warm-cream: #FFF3E8 — main background
- soft-beige: #EFE4D2 — card/secondary background
- warm-grey: #7E7A73 — secondary text
- ink-black: #111111 — primary text
- lemon-yellow: #FFD34D — RATINGS AND STARS ONLY
- hot-pink: #FF4BAE — FAB buttons, "new" badges ONLY
- mint: #BDECC8 — completed/success states ONLY
- Border color: #E2D9CE

## Typography
- Manrope (loaded via Google Fonts) — all text. Bold (700/800) for headlines, Regular (400/500) for body
- Baloo 2 — no longer used for wordmark (replaced by Spud image logo)

## Mascot
- Spud: SVG potato in SpudMascot component at artifacts/cinelog/src/components/spud-mascot.tsx
- 4 poses: relaxed, sleepy, celebrating, watching
- Logo: CouchPotatoLogo component at artifacts/cinelog/src/components/couch-potato-logo.tsx → uses /spud-logo.png

## UI patterns
- Pill buttons: border-radius 9999px (rounded-full)
- Cards: background #ffffff, border 1px solid #E2D9CE, border-radius 16px (rounded-2xl)
- FAB: #FF4BAE, fixed bottom-20 right-5

## Emoji rules
- Emojis ONLY in: stats page (TV/movie type icons), star ratings
- No emojis anywhere else in the app — buttons, labels, toasts, all text-only
- 🍅 was removed from RT display (user preference: text-only ratings)

## Ratings display
- Rotten Tomatoes: always shown as a card section (label "ROTTEN TOMATOES" + percentage below), no emoji
- User rating: star row below the RT section
- Both in a single white card above the status chips

## Streaming provider dedup
- `dedupeProviders()` helper in entry-detail.tsx normalizes names, strips "with ads" / "standard with ads" variants
- Prefers the shorter base name (e.g. "Netflix" over "Netflix standard with ads")
- Same logic applied inline in search.tsx quick-add sheet

**Why:** User confirmed rebrand to Spud due to existing "Couch Potato" app in App Store. Backend unchanged.
