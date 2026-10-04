---
name: Facebook discovery consent
description: Product scope and reason for optional browser-based Facebook friend discovery
---

Facebook discovery is optional and separate from sign-in. Facebook only supplies friends who authorised the same Meta app and granted friends access. Discovery must not imply access to everyone's Facebook friends, post to Facebook, automatically send buddy requests, or bypass accepted-only shelf visibility.

**Why:** The user requested finding Facebook friends already on Spud to help the app grow, explicitly not facial recognition. This is a consent-based discovery feature, not permission to broaden social sharing.

**How to apply:** Keep ordinary name/username search and invites usable without Facebook. Explain the mutual consent limitation. Public activation still requires the owner's Meta app setup and applicable approval.

Prefer server-side browser OAuth for this feature rather than a native Facebook SDK.

**Why:** This supports both web and mobile without adding Facebook tracking SDK configuration or retaining provider tokens on devices.

**How to apply:** Keep provider credentials on the server and treat native browser completion/device behaviour as a distinct verification requirement from backend tests.