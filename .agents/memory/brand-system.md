---
name: CouchPotato brand system
description: Complete brand tokens, typography, mascot, logo for CouchPotato app
---

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
- Baloo 2 (loaded via Google Fonts) — ONLY for COUCH POTATO bubble wordmark logo

## Mascot
- Spud: SVG potato in SpudMascot component at artifacts/cinelog/src/components/spud-mascot.tsx
- 4 poses: relaxed, sleepy, celebrating, watching
- Logo: CouchPotatoLogo component at artifacts/cinelog/src/components/couch-potato-logo.tsx
- Uses Baloo 2 with WebkitTextStroke '#116149', textShadow '2px 3px 0px #116149', color '#9BD6FF'

## UI patterns
- Pill buttons: border-radius 9999px (rounded-full)
- Cards: background #ffffff, border 1px solid #E2D9CE, border-radius 16px (rounded-2xl)
- FAB: #FF4BAE, fixed bottom-20 right-5

**Why:** User provided full brand system with reference images. Keep this system disciplined — no rainbow of extra colors.
