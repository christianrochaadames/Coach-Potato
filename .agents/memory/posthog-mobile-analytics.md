---
name: PostHog mobile analytics
description: Privacy and environment-handling decisions for anonymous PostHog events in the native Spud app.
---

Mobile analytics is deliberately manual and anonymous: no automatic touch or screen capture, lifecycle events, session replay, surveys, remote config, feature flags, geo-IP, identify, alias, or group calls. Keep event properties allow-listed and free of personal data, title content, media/account IDs, search text, notes, and URLs.

**Why:** The product policy is operational-only and the user explicitly chose privacy-safe product analytics without marketing tracking or content collection.

**How to apply:** Store the PostHog project key as a Replit Secret. The secure environment form may return the host as a region label such as “US Cloud” or “EU Cloud” rather than a URL; normalize those labels to the corresponding PostHog ingestion endpoint before SDK initialization.