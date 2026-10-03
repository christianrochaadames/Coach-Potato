---
name: Managed Clerk secret refresh
description: Recovery path for an invalid Replit-managed Clerk server secret.
---

If a Replit-managed Clerk server secret returns a 401 “invalid secret key” response, refresh the provisioned Clerk environment values with the managed Clerk setup operation, then restart the API and mobile workflows. Verify the refreshed server key against Clerk before investigating user records.

**Why:** The mobile publishable key can continue working while a stale or invalid server secret prevents account inspection and server-side Clerk operations.

**How to apply:** Do not hand-edit or replace managed Clerk secrets. Use the managed setup flow, restart services so they receive the refreshed values, and keep all verification output limited to status/metadata rather than secret contents.