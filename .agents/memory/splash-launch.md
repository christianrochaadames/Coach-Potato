---
name: Animated launch splash
description: How Spud's native launch screen and runtime motion-logo splash work together.
---

The native iOS/Android launch screen cannot play motion content. It uses a solid color as a static handoff, then the React Native app immediately overlays the centered motion-logo video for at most 2.2 seconds while Clerk initializes underneath. The same runtime splash also runs after a signed-in user logs out.

The runtime asset is a directly-played H.264/AAC MP4 with a solid background, not a transparent video or an animated WebP. It is a 16:9 landscape video inside a portrait screen, so contained playback exposes the app surface above and below the video canvas. On-device iOS capture renders the MP4 background as `#D3C5F8`; use that exact value for the runtime splash surface and native handoff so its letterbox edges disappear. The raw decoded source corner is `#D2C3F7`, but that is not the same as the displayed iOS color.

**Why:** Waiting for Clerk before starting a five-second animation made cold launches feel significantly longer. Starting it immediately provides visual feedback while auth initializes. Transparent ProRes MOV was unreliable in Expo Go, and H.264 color conversion on iOS shifts the displayed lavender relative to raw RGB decoding.

**How to apply:** Start the runtime splash as soon as the app tree mounts; do not wait for Clerk. Keep the gate near 2.2 seconds, the `#D3C5F8` surface, 16:9 contained layout, and muted non-looping video. If the source changes, verify the surface color from an on-device screenshot; raw RGB sampling alone is insufficient.
