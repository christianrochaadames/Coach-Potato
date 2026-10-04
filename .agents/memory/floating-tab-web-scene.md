---
name: Floating tab web scene
description: Transparent scene and host sizing needed for a custom floating Expo tab bar on web.
---

When Expo Router uses a custom floating tab bar, the web tab scene can still paint its default opaque bottom area even when the custom bar and tabBarStyle are transparent. Configure the tab scene itself as transparent and keep the web tab host at 84px; use the native safe-area height on iOS and Android.

**Why:** React Navigation’s web tab host has its own default scene/host styling, so styling only the visible custom pill does not remove the full-width strip behind it.

**How to apply:** For future custom floating tab bars, set `sceneStyle.backgroundColor` to transparent, provide an explicitly transparent `tabBarBackground`, and keep the custom bar and `tabBarStyle` heights aligned (84px on web).