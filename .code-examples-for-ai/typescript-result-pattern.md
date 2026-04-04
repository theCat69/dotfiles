# TypeScript Result<T> Pattern with ErrorCode Enum

Demonstrates the `Result<T, E>` discriminated union used in `cache-ctrl` for explicit, no-throw error handling.

```typescript
// src/types/result.ts

export enum ErrorCode {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PARSE_ERROR    = "PARSE_ERROR",
  LOCK_TIMEOUT   = "LOCK_TIMEOUT",
  NO_MATCH       = "NO_MATCH",
  UNKNOWN        = "UNKNOWN",
}

export interface CacheError {
  code: ErrorCode;
  error: string;
}

export type Result<T, E extends CacheError = CacheError> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: E["code"] };

// Usage — every function returns Result, never throws:
async function readCache(filePath: string): Promise<Result<Record<string, unknown>>> {
  try {
    const content = await readFile(filePath, "utf-8");
    try {
      return { ok: true, value: JSON.parse(content) };
    } catch {
      return { ok: false, error: `Bad JSON: ${filePath}`, code: ErrorCode.PARSE_ERROR };
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return { ok: false, error: "Not found", code: ErrorCode.FILE_NOT_FOUND };
    return { ok: false, error: e.message, code: ErrorCode.UNKNOWN };
  }
}

// Caller narrows the union:
const result = await readCache("./context.json");
if (!result.ok) {
  console.error(result.code, result.error);
  return result; // propagate unchanged
}
doSomethingWith(result.value); // TypeScript knows it's Record<string,unknown>
```
