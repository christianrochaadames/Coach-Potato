---
name: TestFlight build numbering
description: How the mobile app's local build number interacts with EAS auto-increment.
---

The iOS app uses EAS production auto-increment, but the local `buildNumber` must not lag behind the latest uploaded build. If it does, EAS can generate a duplicate build number. Advance the local base to the latest uploaded number before starting the next build; EAS then creates the next unique number.

**Why:** A production build was generated with a number already used by an earlier upload because the checked-in local base was stale.

**How to apply:** Check recent iOS EAS build history before submitting. When the next number is needed, update the local iOS build number, commit and push it, then trigger the production build with auto-submit.