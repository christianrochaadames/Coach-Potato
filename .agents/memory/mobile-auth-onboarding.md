---
name: Mobile auth and onboarding routing
description: Native Expo routing must gate authenticated screens on both Clerk readiness and the server profile completion flag.
---

Authenticated mobile routes must wait for Clerk to finish loading, then use the server profile's onboarding completion state as the source of truth. Keep interrupted onboarding stage and poster selections locally, but clear that draft only after the server marks onboarding complete.

**Why:** Native deep links and mounted Expo Router layouts can otherwise briefly expose the wrong screen, loop back into onboarding, or lose an incomplete signup flow.

**How to apply:** Protect the onboarding route itself, gate the tab layout on `/api/profile`, refresh the gate when the tab shell regains focus, and replace the authenticated stack after logout.

Any locally pending signup profile must belong to the verified signup account, not to whichever account signs in next. Keep it until the matching account successfully saves it.

**Why:** An abandoned email-verification attempt was found able to overwrite an existing account's profile during release review. Deleting the pending record on a failed save also loses the new member's chosen identity.

**How to apply:** Bind pending profile data to the verified Clerk user identity, reject legacy unbound or mismatched records, and cancel account-specific sync work when identity changes.