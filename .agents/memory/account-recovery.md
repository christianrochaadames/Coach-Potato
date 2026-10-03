---
name: Cross-environment account recovery
description: Safe recovery when Clerk identities and user-scoped database rows become detached across development and production.
---

Never commit a user's profile, notes, ratings, watch history, or other private records into source code to move data between environments. Use a temporary private App Storage object, require an exact authenticated destination identity, merge in a database transaction, verify the expected final record count before commit, and delete the object only after success.

**Why:** Development and production Clerk stores can diverge while both databases retain valid user-scoped rows. A direct replacement can lose newer records or production-only records, while embedding a snapshot in code exposes private data and persists it in source history.

**How to apply:** Inventory every table scoped by user ID, compare datasets by stable external ID with a normalized-title fallback, treat the newest dataset as authoritative for shared records, preserve destination-only records, and make retries idempotent. Remove one-time recovery hooks after the user confirms the restored library.

When SQL results need binary or hex decoding inside CodeExecution, the durable scope may not provide `Buffer`, `atob`, or `TextDecoder`. Pass only the encoded strings into a minimal `"use impure"` helper and decode there with Node's `Buffer`.