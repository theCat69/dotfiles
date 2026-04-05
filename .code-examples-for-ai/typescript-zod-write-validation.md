# TypeScript — Zod safeParse at Write Boundary with Field Injection

Demonstrates validating user-supplied content against a Zod schema before writing to disk, with positional-arg injection (external path) and server-side field injection (local path). Returns typed `Result<T>` errors — no throws.

```typescript
// src/commands/write.ts

import { ExternalCacheFileSchema, LocalCacheFileSchema } from "../types/cache.js";
import { ErrorCode } from "../types/result.js";

// ── External path ────────────────────────────────────────────────────────────

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

// ── Local path ───────────────────────────────────────────────────────────────

// 1. Server-side timestamp injection: always overrides any agent-supplied value.
//    The local-context-gatherer subagent has no bash access and cannot produce
//    a real timestamp, so the server injects it to prevent stale/fabricated values.
const contentWithTimestamp = { ...args.content, timestamp: new Date().toISOString() };

// 2. Validate against LocalCacheFileSchema — same error surfacing pattern
const parsedLocal = LocalCacheFileSchema.safeParse(contentWithTimestamp);
if (!parsedLocal.success) {
  const message = parsedLocal.error.issues.map((i) => i.message).join("; ");
  return { ok: false, error: `Validation failed: ${message}`, code: ErrorCode.VALIDATION_ERROR };
}

// 3. Delegate to writeCache
const writeResultLocal = await writeCache(filePath, contentWithTimestamp);
if (!writeResultLocal.ok) return writeResultLocal;
return { ok: true, value: { file: filePath } };
```

Key points:
- **External**: mismatch guard prevents silent conflicts between positional args and JSON body; `subject` injection allows callers to omit the redundant field
- **Local**: `timestamp` is always overridden server-side — agents must not supply it; this prevents stale or fabricated timestamps from subagents without bash access
- `safeParse()` issues are joined into a single human-readable error string
- `writeCache()` merges updates onto the existing file — unknown agent fields are preserved
- Every error path returns `Result<T>` — no throws in normal operation
