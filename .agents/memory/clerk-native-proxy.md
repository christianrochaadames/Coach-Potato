---
name: Native Clerk proxy
description: Production Expo authentication transport for Replit-managed Clerk
---

Production Expo binaries need the Replit-managed Clerk proxy URL passed to the native `ClerkProvider` in addition to the publishable key and secure token cache. The API still needs its normal bearer token authentication.

**Why:** Native clients do not have the browser cookie transport. Without the proxy configuration, a TestFlight app can render as signed in while authenticated API requests arrive at the production server as 401 Unauthorized.

**How to apply:** Keep development proxy-free, inject `EXPO_PUBLIC_CLERK_PROXY_URL` for production builds, and keep the API routes protected. Use static Expo configuration for Expo Launch; do not restore a dynamic `app.config.js`.