# TypeScript: Input Validation Guard with Result Pattern

Demonstrates creating a **reusable input validation helper** in `src/utils/validate.ts` that:
- Guards against path traversal via untrusted string inputs
- Returns a typed `Result<void>` (no value on success, structured error on failure)
- Uses a pre-compiled regex constant for performance

## Pattern

```typescript
// src/utils/validate.ts
import { ErrorCode, type Result } from "../types/result.js";

/** Regex for safe cache subject names — no path traversal, no special characters. */
const SUBJECT_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function validateSubject(subject: string): Result<void> {
  if (!SUBJECT_PATTERN.test(subject)) {
    return {
      ok: false,
      error: `Invalid subject "${subject}": must match /^[a-zA-Z0-9._-]+$/`,
      code: ErrorCode.INVALID_ARGS,
    };
  }
  return { ok: true, value: undefined };
}
```

## Call site (in a command function)

```typescript
// src/commands/write.ts
import { validateSubject } from "../utils/validate.js";

const subjectValidation = validateSubject(args.subject);
if (!subjectValidation.ok) return subjectValidation;

// Safe to use args.subject in a file path now
const filePath = join(cacheDir, `${args.subject}.json`);
```

## Key points

- **`Result<void>`** — success has no meaningful value; `{ ok: true, value: undefined }` is idiomatic
- **Early return propagation** — the caller returns the validation error directly without wrapping it
- **`INVALID_ARGS` error code** — validation failures map to this code, not `VALIDATION_ERROR` (which is for schema validation)
- **Compiled regex constant** — defined at module level, not inline inside the function
