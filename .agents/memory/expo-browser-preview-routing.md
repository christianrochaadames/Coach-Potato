---
name: Expo browser preview routing
description: Why browser screenshots can show the web client instead of the Expo source
---

Browser screenshot and browser-testing requests aimed at the mobile artifact can resolve to the separate web client on this workspace. The visual clue was a Home “Refresh” button present in the web app but absent from the Expo source.

**Why:** The browser-facing preview route is not a reliable representation of the native Expo bundle here, so it can produce false UI test failures for mobile-only changes.

**How to apply:** Use the Expo Go tunnel for mobile interaction validation. Treat browser preview checks as bundle/route health checks unless the rendered UI is first confirmed to match the Expo source.
