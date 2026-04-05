# TypeScript — Zod safeParse at Write Boundary with Field Injection

Demonstrates validating user-supplied content against a Zod schema before writing to disk, with positional-arg injection and mismatch guard. Returns typed `Result<T>` errors — no throws.

```typescript
// src/commands/write.ts

import { ExternalCacheFileSchema } from "../types/cache.js";
import { ErrorCode } from "../types/result.js";

// 1. Mismatch guard: content.subject must equal the positional subject arg
if (args.content["subject"] !== undefined && args.content["subject"] !== args.subject) {
  return {
    ok: false,
    error: `content.subject "${String(args.content["subject"])}" does not match subject argument "${args.subject}"`,
    code: ErrorCode.VALIDATION_ERROR,
  };
}

// 2. Field injection: insert positional arg into content when absent
const contentWithSubject = { ...args.content, subject: args.subject };

// 3. Validate against Zod schema — errors surfaced as VALIDATION_ERROR, never thrown
const parsed = ExternalCacheFileSchema.safeParse(contentWithSubject);
if (!parsed.success) {
  const message = parsed.error.issues.map((i) => i.message).join("; ");
  return { ok: false, error: `Validation failed: ${message}`, code: ErrorCode.VALIDATION_ERROR };
}

// 4. Delegate to writeCache for atomic write-with-merge
const writeResult = await writeCache(filePath, contentWithSubject);
if (!writeResult.ok) return writeResult;
return { ok: true, value: { file: filePath } };
```

Key points:
- Mismatch guard prevents silent conflicts between positional args and JSON body
- Field injection allows callers to omit redundant fields — the canonical value always wins
- `safeParse()` issues are joined into a single human-readable error string
- `writeCache()` merges updates onto the existing file — unknown agent fields are preserved
- Every error path returns `Result<T>` — no throws in normal operation
