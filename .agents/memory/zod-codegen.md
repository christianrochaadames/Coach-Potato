---
name: Zod codegen quirk
description: Two recurring issues after running orval codegen
---

## Issue 1: zod.int() (Zod v4 syntax)
Orval v8 generates `zod.int()` but workspace pins Zod v3 which doesn't have it.

**Fix:** After every codegen run, immediately run:
```
sed -i 's/zod\.int()/zod.number().int()/g' lib/api-zod/src/generated/api.ts
```

## Issue 2: Name collision in api-zod index
When OpenAPI has schemas that generate TypeScript interfaces AND zod schemas with the same name (e.g. TmdbPopularResponse, TmdbSearchResponse), the default `export * from "./generated/types"` in lib/api-zod/src/index.ts causes TS2308 errors.

**Fix:** Change lib/api-zod/src/index.ts to use named exports from types/ instead of `export *`, listing only types that DON'T conflict with api.ts exports.

**Why:** These two issues appear every time the OpenAPI spec adds new schemas. Must be fixed before typecheck:libs passes.
**How to apply:** Run both fixes right after `pnpm --filter @workspace/api-spec run codegen` and before any typecheck step.
