# TypeScript — Zod safeParse at I/O Boundaries

Demonstrates using `ExternalCacheFileSchema.safeParse()` instead of unsafe `as` type assertions when reading JSON from disk. Malformed files are skipped gracefully rather than corrupting the type system.

```typescript
// src/commands/list.ts

import { ExternalCacheFileSchema } from "../types/cache.js";

for (const filePath of filesResult.value) {
  const readResult = await readCache(filePath);
  if (!readResult.ok) continue;

  const parseResult = ExternalCacheFileSchema.safeParse(readResult.value);
  if (!parseResult.success) {
    process.stderr.write(`[cache-ctrl] Warning: skipping malformed external cache file: ${filePath}\n`);
    continue;
  }
  // parseResult.data is fully typed — no `as` assertion needed
  const data = parseResult.data;
  const subject = data.subject ?? getFileStem(filePath);
  // ...
}
```

Key points:
- Schema is defined with `z.looseObject()` so extra fields from disk are preserved in the inferred type
- `safeParse()` never throws — failures are handled inline
- Malformed files are logged to stderr and skipped, keeping the loop resilient
- `parseResult.data` is strongly typed — no `as Partial<T>` or `as T` casts
