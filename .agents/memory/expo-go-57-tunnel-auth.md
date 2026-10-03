---
name: Expo Go 57 tunnel authentication
description: Environment constraints for authenticated physical-iOS Expo Go 57 tunnels on Replit.
---

Expo Go 57 physical-iOS previews require the Metro server to use the Replit-provided Expo session. Keep any unrelated Expo token out of both the session-login command and the Expo Go process. Use a short explicit tunnel subdomain because the temporary Replit Expo username can make Expo's generated ngrok DNS label exceed the 63-character limit. Run Expo headlessly on Replit so React Native does not try to launch its desktop DevTools shell.

**Why:** Session login refuses to run when an Expo token is present, while the temporary authenticated username is long enough that Expo's default random-project + username + port hostname can fail with `ERR_NGROK_396`. Without headless mode, React Native 0.86 tries to start a desktop GUI binary and can stall Metro while loading unavailable Linux desktop libraries.

**How to apply:** Preserve the guarded session login, unset the Expo token only for the login and preview process, set `EXPO_UNSTABLE_HEADLESS=1`, and pass a short project-specific `EXPO_TUNNEL_SUBDOMAIN` when starting the stock Expo Go tunnel.