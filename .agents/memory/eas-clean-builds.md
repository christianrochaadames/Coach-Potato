---
name: EAS clean-build dependency isolation
description: Why Expo release builds must not rely on Babel packages available only transitively in the workspace.
---

Treat every EAS release as a clean, isolated pnpm install. Any Babel preset or plugin named by the mobile app's configuration must remain a direct dependency of that app, even if local development resolves it transitively.

**Why:** A local Expo export can appear healthy with an already-populated monorepo install while EAS fails during Xcode bundling because strict pnpm isolation omitted an undeclared preset. The resulting Metro `transformFile` error is secondary; inspect the earlier `MODULE_NOT_FOUND` message.

**How to apply:** Before launching a release, validate a clean/frozen dependency install and an iOS Expo export. When Metro reports `transformFile` during EAS, search the Xcode log for the first missing Babel module rather than changing Metro itself.