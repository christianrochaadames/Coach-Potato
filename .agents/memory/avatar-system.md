---
name: Avatar system
description: How user avatars work — Spud variant picker and custom photo upload on the profile page.
---

# Avatar system

## The rule
Profiles have two optional avatar fields: `avatarId` (string "2"–"15", maps to `/spud-avatar-N.png`) and `avatarUrl` (base64 JPEG data URL from a custom photo upload). `avatarUrl` takes priority. Neither set → show initials.

**Why:** The user wanted Spud variants as selectable avatars plus a custom photo upload option, all stored in the DB without requiring object storage.

## How to apply
- Display: `avatarUrl ? <img cover> : avatarId ? <img contain /spud-avatar-{id}.png> : <initials span>`
- Spud images live in `artifacts/cinelog/public/spud-avatar-2.png` through `spud-avatar-15.png`
- Photo upload resizes to 400×400 JPEG (85% quality) via canvas before encoding as base64
- Profile page avatar picker: 5-column grid, 14 Spud circles + 1 Camera/photo upload cell
- Home page header: 56px circle in the profile button, same avatar priority logic
- Both `avatarId` and `avatarUrl` are saved via `PATCH /api/profile`

## Schema
`lib/db/src/schema/profiles.ts` — `avatarId text`, `avatarUrl text` (nullable)
Migration already applied (drizzle push confirmed).
