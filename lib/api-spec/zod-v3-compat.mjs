import { readFileSync, writeFileSync } from "node:fs";

// Orval 8 emits Zod 4 syntax; this workspace deliberately remains on Zod 3.
const generated = new URL("../api-zod/src/generated/api.ts", import.meta.url);
writeFileSync(generated, readFileSync(generated, "utf8")
  .replaceAll("zod.int()", "zod.number().int()")
  .replaceAll("zod.url()", "zod.string().url()"));

// Orval appends this wildcard even when a selective type barrel already exists.
// Keep the selective exports to avoid type/schema names colliding.
const barrel = new URL("../api-zod/src/index.ts", import.meta.url);
writeFileSync(barrel, readFileSync(barrel, "utf8")
  .replace(/^export\s+\*\s+from\s+['"]\.\/generated\/types['"];?\r?\n?/gm, ""));