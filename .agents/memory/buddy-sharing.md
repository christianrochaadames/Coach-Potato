---
name: Buddy sharing boundary
description: Consent and visibility decisions for Spud's social connections.
---

Signed-in members can search each other's first name, last name, username, and avatar. Bio, favorite titles, and watching/watchlist/watched titles and posters require an accepted mutual buddy relationship. Ratings, notes, watched dates, email, and other entry metadata remain owner-only, even for buddies. Removing a buddy revokes access.

**Why:** The user wanted people to find and friend each other before launch, while the agreed privacy design keeps watch activity behind mutual acceptance. Sharing summaries must not turn existing private entries into readable cross-user records.

**How to apply:** Any new social feed, detail view, API, or cache must enforce the relationship on the server, return only explicitly allowed fields, and clear previously visible buddy content after removal or account change. Keep web and mobile privacy descriptions aligned with actual visibility.