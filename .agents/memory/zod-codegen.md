---
name: Zod codegen quirk
description: Orval emits incompatible Zod syntax and appends conflicting wildcard type exports
---

## Zod version compatibility
Keep generated schemas compatible with the workspace's Zod major version. Orval 8 emits Zod 4 shorthand for integers and URI formats even when the runtime remains on Zod 3. Correct both, rather than upgrading the app's validation library as a side effect of adding an endpoint.

**Why:** Adding a URI-formatted field revealed another shorthand failure after the existing integer compatibility fix.
**How to apply:** Use the workspace's codegen command, which applies compatibility processing before checking libraries; extend that processing if another unsupported shorthand appears.

## Issue 2: Name collision in api-zod index
When OpenAPI has schemas that generate TypeScript interfaces AND zod schemas with the same name (e.g. TmdbPopularResponse, TmdbSearchResponse), the default `export * from "./generated/types"` in lib/api-zod/src/index.ts causes TS2308 errors.

Use selective type exports for names that do not collide with generated validation schemas. Orval can append a wildcard type export again even when the selective barrel already exists.

**Why:** Manually removing the wildcard once is not durable: a later regeneration can reintroduce name collisions.
**How to apply:** Preserve selective exports and remove the appended wildcard automatically as part of codegen, before library checking.
