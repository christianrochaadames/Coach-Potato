---
name: TestFlight build numbering
description: How the mobile app's local build number interacts with EAS auto-increment.
---

The iOS app uses EAS production auto-increment, but the local `buildNumber` must not lag behind the latest uploaded build. If it does, EAS can generate a duplicate build number. Advance the local base to the latest uploaded number before starting the next build; EAS then creates the next unique number.

**Why:** A production build was generated with a number already used by an earlier upload because the checked-in local base was stale.

**How to apply:** Check recent iOS build history through the read-only Expo integration before release. Keep the local base at least at the latest uploaded number; production auto-increment generates the next number. Hand off building/uploading through Replit's user-initiated iOS publishing flow, not manual EAS CLI commands.

EAS non-interactive automatic submission requires an App Store Connect API key. When that is not configured, a completed production build can still be submitted separately with the existing Apple ID/app-specific-password setup; the upload can succeed while Apple processing remains pending.

**Why:** The build and signing credentials are independent from App Store Connect API submission credentials, and EAS reports upload completion before Apple finishes processing the binary.

**How to apply:** Treat a finished EAS submission as “uploaded to Apple,” not necessarily “ready in TestFlight.” Check App Store Connect for processing and tester assignment when no ASC API key is available.

Expo submission configuration must use exactly one Apple submission credential method: an App Store Connect API key or an Apple app-specific password. If both are configured, the submission request is rejected before upload.

**Why:** The Expo submission API treats these credential fields as mutually exclusive, even when both credentials are valid independently.

**How to apply:** When a submission reports an exclusive-peer credential conflict, remove or disable one credential method in the Expo/App Store Connect configuration before retrying; do not assume the build was uploaded.