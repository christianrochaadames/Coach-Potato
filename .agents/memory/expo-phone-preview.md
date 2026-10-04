---
name: Expo phone preview
description: Durable setup constraints for testing the Spud Expo app from a physical phone through Replit.
---

The mobile workflow must use Expo tunnel mode for physical-device testing from the remote Replit workspace, because the phone is not on the workspace's local network. Port 8080 is occupied by the API server. The managed mobile service uses 8099 for a stable health response, while the Expo Go tunnel runs on a separate local port (currently 8098) and provides the `exp.direct` URL.

**Why:** LAN mode either depends on an unreachable workspace network or prompts to take the API server's port. Expo's web renderer can fail Replit's managed preview health check even while the native tunnel is healthy, so separating the health listener from Metro keeps the workflow alive.

**How to apply:** Keep the managed health listener on the injected `PORT`, run Expo with `--host tunnel` on a separate free port, and validate both the workflow's HTTP 200 health response and the native manifest's `exp.direct` host. When the Replit URL-bar QR produces an `.expo.kirk.replit.dev` `404`, use the current `exp.direct` URI from Expo's native manifest; that tunnel endpoint returns the correct Expo Go manifest. The tunnel URI changes after workflow restarts.

## Placeholder environment values

Reject unresolved `$...` values before passing `EXPO_PUBLIC_DOMAIN` to Metro;
prefer the actual `REPLIT_DEV_DOMAIN` when the configured value is a
placeholder.

**Why:** Expo can inline a literal `$REPLIT_DEV_DOMAIN` into the native bundle,
which turns API calls into an unreachable URL and appears as a generic network
failure.

**How to apply:** Inspect the served bundle for the real `.replit.dev` domain
and zero `$REPLIT_DEV_DOMAIN` placeholders after every tunnel restart.