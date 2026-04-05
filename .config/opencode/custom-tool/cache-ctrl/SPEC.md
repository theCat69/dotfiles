# cache-ctrl — Feature Specification

> **Status**: Implemented  
> **Root path**: `.config/opencode/custom-tool/cache-ctrl/`  
> **Runtime**: TypeScript + Bun  
> **Tests**: Vitest  
> **Written**: 2026-04-04

---

## 1. Goal

Two subagents (`external-context-gatherer` and `local-context-gatherer`) each maintain separate JSON caches under `.ai/`. These caches have no management interface: there is no way to inspect staleness, force re-fetches, search across cache entries, or safely write concurrently from parallel agent instances.

`cache-ctrl` provides a **dedicated CLI tool and native opencode plugin** that manages both caches with a uniform interface. It handles advisory locking for safe concurrent writes, keyword search across all entries, HTTP freshness checking for external URLs, and file-change detection for local scans.

---

## 2. Non-Goals

- Does NOT validate or transform the agent content fields beyond the defined required schema fields.
- Does NOT parse or understand the domain-specific content fields inside cache files (beyond the defined schema fields).
- Does NOT provide a TUI or interactive mode.
- Does NOT manage caches outside the two defined directories.
- Does NOT auto-schedule or daemon-run checks — all operations are invoked on-demand.
- Does NOT modify `opencode.json` or agent configuration files.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Invocation Layer                       │
│                                                             │
│   CLI (cache-ctrl)              opencode Plugin             │
│   src/index.ts                  plugin.ts                   │
│   ↓ parses args                 ↓ Zod-validated tool calls  │
└────────────────────┬────────────────────┬───────────────────┘
                     │                    │
         ┌───────────▼────────────────────▼──────────┐
         │              Command Layer                  │
          │  src/commands/{list, inspect, flush,        │
          │   invalidate, touch, prune,                 │
          │   checkFreshness, checkFiles, search,       │
          │   write}.ts                                 │
         └───────────┬────────────────────────────────┘
                     │
         ┌───────────▼────────────────────────────────┐
         │              Core Services                  │
         │                                             │
         │  cache/cacheManager.ts  ← read/write + lock │
         │  cache/externalCache.ts ← external logic    │
         │  cache/localCache.ts    ← local logic       │
         │  http/freshnessChecker.ts ← HEAD requests   │
         │  files/changeDetector.ts  ← mtime/hash      │
         │  search/keywordSearch.ts  ← ranking engine  │
         └───────────────────────────────────────────-─┘
                     │
         ┌───────────▼────────────────────────────────┐
         │           Cache Directories (on disk)       │
         │                                             │
         │  .ai/external-context-gatherer_cache/       │
         │    ├── <subject>.json  (one per subject)    │
         │    └── <subject>.json.lock  (advisory)      │
         │                                             │
         │  .ai/local-context-gatherer_cache/          │
         │    ├── context.json                         │
         │    └── context.json.lock  (advisory)        │
         └─────────────────────────────────────────────┘
```

**Key design decisions:**

- All commands funnel through `cacheManager.ts` for read/write — no direct filesystem access from commands.
- The two cache namespaces are identified by an `AgentType` discriminant (`"external"` | `"local"`).
- The CLI and plugin are thin shells over the same command functions; no business logic lives in either entry point.
- All operations return `Result<T, CacheError>` — nothing throws into the caller.

---

## 4. File Structure

```
.config/opencode/custom-tool/cache-ctrl/
│
├── install.sh                      # Symlink installer (idempotent)
├── package.json                    # Bun + Vitest deps
├── tsconfig.json                   # strict, verbatimModuleSyntax, ESNext/bundler
│
├── src/
│   ├── index.ts                    # CLI entry point — arg parsing, dispatch, JSON output
│   │
│   ├── types/
│   │   ├── cache.ts                # ExternalCacheFile, LocalCacheFile, CacheEntry, AgentType
│   │   ├── commands.ts             # Per-command arg/result types (ListArgs, FlushArgs, etc.)
│   │   └── result.ts               # Result<T,E>, CacheError, ErrorCode enum
│   │
│   ├── utils/
│   │   ├── fileStem.ts             — shared getFileStem() utility
│   │   └── validate.ts             — validateSubject() path-traversal guard
│   │
│   ├── commands/
│   │   ├── list.ts                 # list — enumerate entries with staleness flags
│   │   ├── inspect.ts              # inspect — pretty-print a single entry
│   │   ├── flush.ts                # flush — delete cache files (requires --confirm)
│   │   ├── invalidate.ts           # invalidate — zero out timestamps
│   │   ├── touch.ts                # touch — reset timestamp to now
│   │   ├── prune.ts                # prune — invalidate/flush entries older than duration
│   │   ├── checkFreshness.ts       # check-freshness — HTTP HEAD per source URL
│   │   ├── checkFiles.ts           # check-files — mtime/hash comparison
│   │   ├── search.ts               # search — ranked keyword search
│   │   └── write.ts                # write — validated cache entry write
│   │
│   ├── cache/
│   │   ├── cacheManager.ts         # readCache, writeCache, lockFile, unlockFile, listFiles
│   │   ├── externalCache.ts        # resolveExternalPaths, isExternalStale, mergeHeaderMetadata
│   │   └── localCache.ts           # resolveLocalPath, buildTrackedFilesIndex
│   │
│   ├── http/
│   │   └── freshnessChecker.ts     # sendHeadRequest, parseEtag, parseLastModified
│   │
│   ├── files/
│   │   └── changeDetector.ts       # compareTrackedFiles, computeHash, readMtime
│   │
│   └── search/
│       └── keywordSearch.ts        # scoreEntry, rankResults, normalizeKeyword
│
├── cache_ctrl.ts                       # opencode plugin — registers tool() calls via @opencode-ai/plugin
│
└── tests/
    ├── fixtures/
    │   ├── external-sample.json    # Minimal valid ExternalCacheFile for tests
    │   └── local-sample.json       # Minimal valid LocalCacheFile for tests
    │
    ├── commands/
    │   ├── list.test.ts
    │   ├── flush.test.ts
    │   ├── invalidate.test.ts
    │   ├── checkFreshness.test.ts
    │   └── search.test.ts
    │
    ├── cache/
    │   ├── cacheManager.test.ts    # read/write round-trip, lock acquisition
    │   └── concurrency.test.ts     # parallel write safety
    │
    ├── http/
    │   └── freshnessChecker.test.ts
    │
    └── files/
        └── changeDetector.test.ts
```

---

## 5. Cache Format Spec

### 5.1 External Cache File

**Location**: `.ai/external-context-gatherer_cache/<subject>.json`  
One file per subject. The file stem (filename without `.json`) is the subject identifier for CLI commands.

```typescript
export type ExternalCacheFile = z.infer<typeof ExternalCacheFileSchema>;
// Shape:
// {
//   // ── Identity ──────────────────────────────────────────────
//   subject: string;               // Unique subject key. Must match the file stem.
//   description: string;           // NEW. Human-readable one-liner for keyword search.
//
//   // ── Freshness ─────────────────────────────────────────────
//   fetched_at: string;            // ISO 8601. When the cache was last populated.
//                                  // Set to "" (empty string) when invalidated.
//
//   // ── Sources ───────────────────────────────────────────────
//   sources: Array<{
//     type: string;                // e.g. "github_api", "docs", "webfetch"
//     url: string;                 // Canonical URL for HTTP HEAD checks
//     version?: string;            // Optional version tag at fetch time
//   }>;
//
//   // ── HTTP Freshness Metadata ────────────────────────────────
//   // NEW. Keyed by URL from sources[]. Populated by check-freshness command.
//   header_metadata: {
//     [url: string]: {
//       etag?: string;             // ETag header value from last HEAD response
//       last_modified?: string;    // Last-Modified header value
//       checked_at: string;        // ISO 8601. When the HEAD request was sent.
//       status: "fresh" | "stale" | "unchecked";
//     };
//   };
//
//   // ── Agent Content Fields (open) ────────────────────────────
//   // Any additional fields written by the agent are preserved unchanged.
//   // cache-ctrl never deletes unknown fields.
//   [key: string]: unknown;
// }
```

**Staleness rule**: An external entry is stale if `fetched_at` is empty OR if the age since `fetched_at` exceeds 24 hours (configurable via `--max-age`).

**File naming constraint**: The `subject` value in JSON must equal the file stem (i.e., `opencode-skills.json` → `subject: "opencode-skills"`). `cache-ctrl` warns (but does not fail) if they diverge.

> **Zod schema note**: The Zod schema for `ExternalCacheFile` must use `.passthrough()` or `.catchall(z.unknown())` at the object level. This preserves unknown fields through validation and is required for Key Invariant #2 (merge not replace) to work correctly when agents write custom fields.

---

### 5.2 Local Cache File

**Location**: `.ai/local-context-gatherer_cache/context.json`  
Single file. No per-subject splitting for local cache.

```typescript
export type LocalCacheFile = z.infer<typeof LocalCacheFileSchema>;
// Shape:
// {
//   // ── Identity ──────────────────────────────────────────────
//   timestamp: string;             // ISO 8601. When the local scan completed.
//                                  // Set to "" (empty string) when invalidated.
//   topic: string;                 // Topic description of this scan.
//   description: string;           // NEW. One-liner for keyword search.
//   cache_miss_reason?: string;    // Optional. Why the previous cache was discarded.
//
//   // ── File Change Detection ─────────────────────────────────
//   // NEW. Populated by the local-context-gatherer agent when writing cache.
//   // cache-ctrl reads and compares, but does NOT write this field.
//   tracked_files: Array<{
//     path: string;                // Absolute or repo-relative path.
//     mtime: number;               // Unix timestamp in milliseconds (Date.getTime()).
//     hash?: string;               // Optional SHA-256 hex of file contents at scan time.
//   }>;
//
//   // ── Agent Content Fields (open) ────────────────────────────
//   [key: string]: unknown;
// }
```

**Staleness rule for local**: Local cache has no time-based TTL. The `list` command always marks local as `is_stale: true` because it cannot run filesystem scans inline. For authoritative change detection, use `check-files`.

**Agent responsibility**: The local-context-gatherer agent MUST populate `tracked_files[]` when writing cache. `cache-ctrl check-files` will return `{ status: "unchanged" }` (no files to check) if `tracked_files` is absent or empty — this is not an error.

> **Zod schema note**: The Zod schema for `LocalCacheFile` must use `.passthrough()` or `.catchall(z.unknown())` at the object level. This preserves unknown fields through validation and is required for Key Invariant #2 (merge not replace) to work correctly when agents write custom fields.

---

### 5.3 Lock File Convention

For each cache file at path `<file>.json`, the advisory lock is `<file>.json.lock`.

Lock file content (plain text, one line):
```
<PID>\n
```

Lock files are cleaned up on unlock. A stale lock (PID no longer running, or lock older than 30 seconds) is considered abandoned and may be overridden.

---

## 6. Feature Specs

### 6.1 CLI Commands

**Entry point**: `cache-ctrl` (symlinked to `~/.local/bin/cache-ctrl`)  
**Default output**: JSON (single line)  
**Human output**: Add `--pretty` flag for formatted JSON  
**Errors**: Printed to stderr as `{ "ok": false, "error": "...", "code": "..." }`, exit code non-zero

---

#### `cache-ctrl list`

```
cache-ctrl list [--agent external|local|all] [--pretty]
```

Lists all cache entries across the requested agent namespace(s).

**Output type**:
```typescript
type ListResult = {
  ok: true;
  value: Array<{
    file: string;            // Absolute path to cache file
    agent: "external" | "local";
    subject: string;         // From subject / topic field
    description?: string;
    fetched_at: string;      // ISO 8601 or "" if invalidated
    age_human: string;       // e.g. "2 hours ago", "3 days ago", "invalidated"
    is_stale: boolean;       // true if age > threshold or fetched_at is empty
  }>;
};
```

**Staleness thresholds**:
- External: stale if `fetched_at` is empty OR age > 24h
- Local: `is_stale` is always `true` (local cache has no TTL — always must be re-verified)

**Default**: `--agent all`

---

#### `cache-ctrl inspect`

```
cache-ctrl inspect <agent> <subject-keyword> [--pretty]
```

Finds the cache file whose subject/topic matches `<subject-keyword>` (substring, case-insensitive) and prints the full parsed JSON. Uses the same resolution logic as `search` — if multiple files match, returns the highest-scored result. Fails with `AMBIGUOUS_MATCH` if the top two results have the same score.

**Output type**:
```typescript
type InspectResult = {
  ok: true;
  value: {
    file: string;
    agent: "external" | "local";
    content: ExternalCacheFile | LocalCacheFile;
  };
};
```

---

#### `cache-ctrl flush`

```
cache-ctrl flush <agent|all> --confirm [--pretty]
```

Deletes cache files for the given agent namespace. The `--confirm` flag is **required** — the command exits with `CONFIRMATION_REQUIRED` if omitted.

**Scope**:
- `external` → deletes all `*.json` files in `.ai/external-context-gatherer_cache/` (not `.lock` files)
- `local` → deletes `.ai/local-context-gatherer_cache/context.json`
- `all` → both of the above

**Output type**:
```typescript
type FlushResult = {
  ok: true;
  value: {
    deleted: string[];       // Absolute paths of deleted files
    count: number;
  };
};
```

---

#### `cache-ctrl invalidate`

```
cache-ctrl invalidate <agent> [subject-keyword] [--pretty]
```

Zeros out the `fetched_at` (external) or `timestamp` (local) field, leaving all other content intact. This forces agents to treat the cache as a miss on next run without losing the cached content.

**Scope**:
- If `subject-keyword` is provided: matches the best-scored file for that agent
- If omitted for `local`: invalidates `context.json`
- If omitted for `external`: invalidates ALL external cache files

**Output type**:
```typescript
type InvalidateResult = {
  ok: true;
  value: {
    invalidated: string[];   // Absolute paths of modified files
  };
};
```

---

#### `cache-ctrl touch`

```
cache-ctrl touch <agent> [subject-keyword] [--pretty]
```

Resets `fetched_at` / `timestamp` to the current UTC ISO 8601 time, marking the entry as fresh. Inverse of `invalidate`.

**Scope**:
- `touch local`: always touches `context.json` (no keyword needed)
- `touch external [subject-keyword]`: if keyword omitted, touches ALL external cache files (updates `fetched_at` to now on all); if keyword provided, touches only matching files (same search logic as `search`)

**Output type**:
```typescript
type TouchResult = {
  ok: true;
  value: {
    touched: string[];
    new_timestamp: string;   // ISO 8601
  };
};
```

---

#### `cache-ctrl prune`

```
cache-ctrl prune [--agent external|local|all] [--max-age <duration>] [--delete] [--pretty]
```

Finds entries older than `--max-age` and invalidates them (default) or deletes them (with `--delete`).

**Duration format**: `<number><unit>` where unit is `h` (hours) or `d` (days). Examples: `24h`, `7d`, `1d`.

**Defaults**:
- `--agent all`
- `--max-age 24h` for external; `0` (always stale — prune always matches) for local
- Without `--delete`: runs invalidate on matched files
- With `--delete`: runs flush on matched files (no `--confirm` needed because the age filter acts as the guard)

> ⚠️ **Local cache always matches**: Local cache has no TTL, so `--max-age 0` means it always qualifies for pruning. Running `prune --agent all --delete` will always delete the local cache. Use `--agent external` to avoid this.

**Output type**:
```typescript
type PruneResult = {
  ok: true;
  value: {
    matched: string[];       // Files that met the age threshold
    action: "invalidated" | "deleted";
    count: number;
  };
};
```

---

#### `cache-ctrl check-freshness`

```
cache-ctrl check-freshness <subject-keyword> [--url <url>] [--pretty]
```

For each URL in `sources[]` of the matched external cache entry, sends an HTTP HEAD request with conditional headers (`If-None-Match` from stored `etag`, `If-Modified-Since` from stored `last_modified`). Updates `header_metadata[url]` in-place. Does NOT update `fetched_at`.

**Behavior per URL**:
- HTTP 304 → `status: "fresh"`
- HTTP 200 → `status: "stale"` (resource has changed)
- HTTP 4xx/5xx or network error → `status: "error"`, does not write `header_metadata`

**With `--url`**: checks only the specified URL (must be present in `sources[]`). If the URL is not found in `sources[]`, returns error code `URL_NOT_FOUND` with exit code 1 and message `"URL not found in sources for subject '<subject>'"`.

**Output type**:
```typescript
type CheckFreshnessResult = {
  ok: true;
  value: {
    subject: string;
    sources: Array<{
      url: string;
      status: "fresh" | "stale" | "error";
      http_status?: number;
      error?: string;
    }>;
    overall: "fresh" | "stale" | "error";  // "stale" if any source is stale
  };
};
```

**Age override**: If the entry's `fetched_at` age exceeds 24h, the result `overall` is always `"stale"` regardless of HTTP responses.

---

#### `cache-ctrl check-files`

```
cache-ctrl check-files [--pretty]
```

> **Note**: `check-files` operates only on the local cache (`context.json`). Local cache is a single file with no per-subject scoping, so no `subject-keyword` parameter is accepted.

Reads `tracked_files[]` from the local cache file and compares each entry's current `mtime` (and `hash` if present) against stored values.

**Comparison logic**:
1. Read current `mtime` via `stat()`.
2. If stored `hash` is present AND current `mtime` differs → recompute SHA-256 and compare hashes. Hash match despite mtime change → file is `unchanged` (touch-only modification).
3. If no stored `hash` → mtime change alone marks the file as `changed`.
4. If file does not exist on disk → `missing`.

**Output type**:
```typescript
type CheckFilesResult = {
  ok: true;
  value: {
    status: "changed" | "unchanged";
    changed_files: Array<{
      path: string;
      reason: "mtime" | "hash" | "missing";
    }>;
    unchanged_files: string[];
    missing_files: string[];
  };
};
```

If `tracked_files` is absent or empty: returns `{ status: "unchanged", changed_files: [], unchanged_files: [], missing_files: [] }`.

---

#### `cache-ctrl search`

```
cache-ctrl search <keyword> [<keyword>...] [--pretty]
```

Searches all cache files across both namespaces. Case-insensitive. Returns ranked results.

**Output type**:
```typescript
type SearchResult = {
  ok: true;
  value: Array<{
    file: string;
    subject: string;
    description?: string;
    agent: "external" | "local";
    fetched_at: string;
    score: number;
  }>;
};
```

---

### 6.2 HTTP Freshness Checking

**Module**: `src/http/freshnessChecker.ts`

**Interface**:
```typescript
interface FreshnessCheckInput {
  url: string;
  etag?: string;
  last_modified?: string;
}

interface FreshnessCheckOutput {
  url: string;
  status: "fresh" | "stale" | "error";
  http_status?: number;
  etag?: string;             // From response ETag header (for updating stored value)
  last_modified?: string;    // From response Last-Modified header
  error?: string;
}
```

**Request construction**:
- Always send `HEAD <url>`
- If `etag` is present: add `If-None-Match: <etag>`
- If `last_modified` is present: add `If-Modified-Since: <last_modified>`
- Timeout: 10 seconds per request
- No retries on failure

**Response handling**:
- 304 → `status: "fresh"`. Do NOT update the stored ETag from response (no body sent with 304).
- 200 → `status: "stale"`. Update stored `etag` and `last_modified` from response headers if present.
- Any other 4xx or 5xx → `status: "error"`, `http_status: <code>`.
- Network error (timeout, DNS failure) → `status: "error"`, `error: <message>`.

**Write-back**: After all URLs are checked, `checkFreshness.ts` calls `cacheManager.writeCache()` to persist updated `header_metadata`. Uses file locking. If any URL returns `error`, the corresponding `header_metadata[url]` entry is NOT updated. If **all** URLs return `error`, `writeCache()` is NOT called — the cache file is left completely untouched.

---

### 6.3 File Change Detection

**Module**: `src/files/changeDetector.ts`

**Interface**:
```typescript
export type TrackedFile = z.infer<typeof TrackedFileSchema>;
// Shape:
// {
//   path: string;
//   mtime: number;
//   hash?: string;
// }

interface FileComparisonResult {
  path: string;
  status: "changed" | "unchanged" | "missing";
  reason?: "mtime" | "hash" | "missing";
}
```

**Hash algorithm**: SHA-256, hex-encoded. Computed using Bun's native `crypto` APIs (no Node.js `crypto` import needed).

**Path resolution**: If `path` is relative, resolve relative to the repository root (detected by walking up from `process.cwd()` to find `.git/`). If no `.git/` is found, resolve relative to `process.cwd()`.

**Agent responsibility note**: Agents MUST populate `tracked_files[]` at write time. The tool NEVER modifies this field — it only reads it for comparison. If an agent omits `tracked_files`, `check-files` returns `unchanged` without error.

---

### 6.4 Keyword Search Engine

**Module**: `src/search/keywordSearch.ts`

**Scoring matrix** (per keyword, scores are additive across multiple keywords):

| Match type | Score |
|---|---|
| Exact match on file stem | 100 |
| Substring match on file stem | 80 |
| Exact word match on `subject`/`topic` field | 70 |
| Substring match on `subject`/`topic` field | 50 |
| Keyword match on `description` field | 30 |

- All comparisons are **case-insensitive** (normalize both sides with `.toLowerCase()`).
- "Exact word match" means the keyword appears as a whole word (space/punctuation-delimited) in the field value.
- "Substring match" means `field.includes(keyword)`.
- For multiple search keywords: compute total score as the sum across all keywords. A file must score > 0 on at least one keyword to appear in results.
- Results are sorted by total score descending. Files with equal score preserve filesystem order (alphabetical).

**Search scope**: All `*.json` files in `.ai/external-context-gatherer_cache/` AND `.ai/local-context-gatherer_cache/context.json`.

Files that fail to parse (invalid JSON) are silently skipped with a warning written to stderr.

---

### 6.5 File Locking (Concurrent Write Safety)

**Module**: `src/cache/cacheManager.ts`

**Cache directory resolution**: `cacheManager.ts` resolves `.ai/` relative to the repository root, detected by walking up from `process.cwd()` to find `.git/` (same strategy as `changeDetector.ts` in §6.3). If no `.git/` is found, `process.cwd()` is used as the root.

**Lock protocol** (advisory, PID-based):

```
ACQUIRE:
  1. Try to exclusively create <file>.json.lock (O_EXCL).
     Use `fs.promises.open(lockPath, 'wx')` (Node.js `fs` module available in Bun) to atomically create the lock file with `O_EXCL` semantics — do not use `existsSync` + `writeFile` which has a TOCTOU race.
  2. If creation succeeds: write PID to lock file. Proceed with read/write.
  3. If creation fails (lock exists):
     a. Read PID from lock file.
     b. Check if PID is alive using `try { process.kill(pid, 0); /* PID alive */ } catch { /* PID dead → treat lock as stale */ }` — `process.kill(pid, 0)` throws `ESRCH` when the PID does not exist; it does not return a boolean.
     c. If PID is not alive OR lock file mtime > 30 seconds: remove stale lock, retry from step 1.
     d. If PID is alive: wait 50ms, retry. Max total wait: 5 seconds.
     e. If timeout exceeded: return { ok: false, error: "Lock timeout", code: "LOCK_TIMEOUT" }.

RELEASE:
  1. Delete <file>.json.lock.
  2. If deletion fails (already removed by another process): log warning, do not error.
```

**Scope**: `cacheManager.writeCache()` always acquires the lock before writing. `cacheManager.readCache()` does NOT acquire the lock (reads are non-exclusive). This provides writer mutual exclusion with non-blocking reads.

**Atomicity**: Write is performed as write-to-temp-file then atomic rename (`mv <tmp> <target>`). The temp file is `<file>.json.tmp.<pid>`. If the process is killed mid-write, the original file is preserved.

**`writeCache()` signature**:

```typescript
function writeCache(
  filePath: string,
  updates: Partial<ExternalCacheFile> | Partial<LocalCacheFile>
): Promise<Result<void>>;
```

Internally: reads the existing file (if any), `JSON.parse`s it, spread-merges `updates` onto the existing object (`{ ...existing, ...updates }`), then writes back atomically (temp + rename). This guarantees Key Invariant #2 (merge not replace) — unknown agent fields are preserved. If the file does not yet exist, `updates` is written as the initial content.

---

### 6.6 opencode Plugin Tool Integration

**Entry point**: `cache_ctrl.ts` (symlinked to `.opencode/tools/cache-ctrl.ts`)

**Framework**: `@opencode-ai/plugin` (version `1.3.13`, already installed in the workspace)

The plugin registers 7 tools using the `tool()` function. All argument schemas use Zod. All tools call the same command functions used by the CLI — no duplicated logic.

**Module shape** (`cache_ctrl.ts` skeleton):

```typescript
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
// command imports ...

const AgentRequiredSchema = z.enum(["external", "local"]);

export const search = tool({
  description: "Search all cache entries by keyword. Returns ranked list with agent type, subject, description, and staleness info.",
  args: { keywords: z.array(z.string().min(1)).min(1) },
  async execute(args) { /* calls search command */ },
});
export const list = tool({ /* ... */ });
export const inspect = tool({ /* ... */ });
export const invalidate = tool({ /* ... */ });
export const check_freshness = tool({ /* ... */ });
export const check_files = tool({ /* ... */ });
export const write = tool({ /* ... */ });
```

> Tools are exported as individual named constants using the `tool()` helper from `@opencode-ai/plugin`. Each named export becomes a tool registered by opencode. There is no `server` wrapper object — the file uses flat named exports, not a `Plugin`/`Hooks` nested structure.

```typescript
// All Zod schemas for tool args:

const AgentSchema = z.enum(["external", "local", "all"]);
const AgentRequiredSchema = z.enum(["external", "local"]);

// cache_ctrl_search
{ keywords: z.array(z.string().min(1)).min(1) }

// cache_ctrl_list
{ agent: AgentSchema.optional().default("all") }

// cache_ctrl_inspect
{ agent: AgentRequiredSchema, subject: z.string().min(1) }

// cache_ctrl_invalidate
{ agent: AgentRequiredSchema, subject: z.string().optional() }

// cache_ctrl_check_freshness
{ subject: z.string().min(1), url: z.string().url().optional() }

// cache_ctrl_check_files
// No subject param — local cache is always a single file
{}

// cache_ctrl_write
{ agent: AgentRequiredSchema, subject: z.string().min(1).optional(), content: z.record(z.string(), z.unknown()) }
```

**Tool descriptions** (shown to opencode agents):

| Tool name | Description |
|---|---|
| `cache_ctrl_search` | Search all cache entries by keyword. Returns ranked list with agent type, subject, description, and staleness info. |
| `cache_ctrl_list` | List all cache entries for the given agent type (external, local, or all) with age and staleness flags. |
| `cache_ctrl_inspect` | Return the full content of a specific cache entry identified by agent type and subject keyword. |
| `cache_ctrl_invalidate` | Mark a cache entry as stale by zeroing its timestamp. The entry content is preserved. Agent should re-fetch on next run. |
| `cache_ctrl_check_freshness` | For external cache: send HTTP HEAD requests to all source URLs and return freshness status per URL. Optionally pass a specific `url` to check only that source instead of all sources. |
| `cache_ctrl_check_files` | For local cache: compare tracked files against stored mtime/hash values and return which files changed. |
| `cache_ctrl_write` | Write a validated cache entry to disk; validates against ExternalCacheFile or LocalCacheFile schema before writing. |

**Plugin tool output**: Same `Result<T, CacheError>` shape as CLI. The plugin wraps the result in a JSON string. On error, the plugin returns `{ ok: false, error: "...", code: "..." }` rather than throwing.

---

### 6.7 Installation

See Section 10 for the full `install.sh` spec.

**Summary of symlinks created**:
1. `~/.local/bin/cache-ctrl` → `<repo>/.config/opencode/custom-tool/cache-ctrl/src/index.ts`  
   Makes `cache-ctrl` available as a global shell command (Bun executes TypeScript directly).
2. `<repo>/.opencode/tools/cache-ctrl.ts` → `<repo>/.config/opencode/custom-tool/cache-ctrl/cache_ctrl.ts`  
   Registers the plugin with opencode's tool discovery path.

---

### 6.8 `cache-ctrl write` Command

**CLI usage**:
```
cache-ctrl write external <subject> --data '<json>' [--pretty]
cache-ctrl write local --data '<json>' [--pretty]
```

**Plugin tool**: `cache_ctrl_write` with args `{ agent: "external" | "local", subject?: string, content: Record<string, unknown> }`

**Validation behavior**:
- For `external`: validates `content` (with `subject` injected if absent) against `ExternalCacheFileSchema` via Zod `safeParse`. Returns `VALIDATION_ERROR` if required fields are missing or have wrong types.
- For `local`: validates `content` against `LocalCacheFileSchema` via Zod `safeParse`. Returns `VALIDATION_ERROR` if required fields are missing or have wrong types.

**Subject injection and mismatch detection**:
- If `content.subject` is absent, the positional `subject` argument is injected before validation.
- If `content.subject` is present and does not match the positional `subject` argument, returns `VALIDATION_ERROR` with an error message indicating the mismatch.

**Subject requirement**:
- `external`: `subject` positional argument is required. Returns `INVALID_ARGS` if absent.
- `local`: no subject argument is accepted.

**Subject validation** (external agent): `subject` must match `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/` (max 128 chars). Returns `INVALID_ARGS` if it fails validation. This prevents path traversal.

**Write delegation**: Delegates to `writeCache()` for atomic write-with-merge. Existing unknown fields in the file are preserved.

**Returns**: `WriteResult`: `{ ok: true; value: { file: string } }` — `file` is the absolute path to the written cache file.

**Error codes**:
- `INVALID_ARGS` — subject missing for external agent, or subject fails regex/length validation (path-traversal guard)
- `VALIDATION_ERROR` — Zod schema validation failed, or content.subject mismatches subject arg
- `FILE_WRITE_ERROR`, `LOCK_TIMEOUT`, `LOCK_ERROR` — from `writeCache()`

---

## 7. Error Handling Contract

### 7.1 Result Type

```typescript
// src/types/result.ts

type Result<T, E extends CacheError = CacheError> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: E["code"] };

interface CacheError {
  code: ErrorCode;
  error: string;
}
```

### 7.2 Error Codes

```typescript
// src/types/result.ts

enum ErrorCode {
  // File system errors
  FILE_NOT_FOUND      = "FILE_NOT_FOUND",       // Cache file does not exist
  FILE_READ_ERROR     = "FILE_READ_ERROR",       // Cannot read file
  FILE_WRITE_ERROR    = "FILE_WRITE_ERROR",      // Cannot write file
  PARSE_ERROR         = "PARSE_ERROR",           // File is not valid JSON

  // Lock errors
  LOCK_TIMEOUT        = "LOCK_TIMEOUT",          // Could not acquire lock within 5s
  LOCK_ERROR          = "LOCK_ERROR",            // Unexpected lock file error

  // Validation errors
  INVALID_AGENT       = "INVALID_AGENT",         // Unknown agent type
  INVALID_ARGS        = "INVALID_ARGS",          // Missing or invalid CLI arguments
  CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED", // flush without --confirm

  // Search/match errors
  NO_MATCH            = "NO_MATCH",              // No cache file matched the keyword
  AMBIGUOUS_MATCH     = "AMBIGUOUS_MATCH",       // Multiple files with identical top score

  // HTTP errors
  HTTP_REQUEST_FAILED = "HTTP_REQUEST_FAILED",   // Network error during HEAD request
  URL_NOT_FOUND       = "URL_NOT_FOUND",         // --url value not found in sources[] for the subject

  // Internal
  UNKNOWN             = "UNKNOWN",               // Unexpected internal error
}
```

### 7.3 CLI Exit Codes

| Exit code | Meaning |
|---|---|
| `0` | Success |
| `1` | Command error (any `ErrorCode` above) |
| `2` | Invalid arguments / usage error |

**stderr format on error**:
```json
{ "ok": false, "error": "Cache file not found: opencode-skills.json", "code": "FILE_NOT_FOUND" }
```

**Never throw to the top level.** All `try/catch` blocks in commands must return `{ ok: false, error: ..., code: ErrorCode.UNKNOWN }` for unexpected errors. The CLI handler in `index.ts` receives a `Result` and exits accordingly.

---

## 8. Testing Plan

### 8.1 Test Runner

Vitest (`bun run test` or `bunx vitest`). Tests live in `tests/`. Use `vi.mock()` for HTTP and filesystem where needed — prefer real temp-directory operations over heavy mocking for integration tests.

### 8.2 Fixtures

`tests/fixtures/external-sample.json`:
```json
{
  "subject": "test-external",
  "description": "A test external cache entry",
  "fetched_at": "2026-01-01T00:00:00Z",
  "sources": [
    { "type": "docs", "url": "https://example.com/docs" }
  ],
  "header_metadata": {
    "https://example.com/docs": {
      "etag": "\"abc123\"",
      "checked_at": "2026-01-01T01:00:00Z",
      "status": "fresh"
    }
  }
}
```

`tests/fixtures/local-sample.json`:
```json
{
  "timestamp": "2026-01-01T00:00:00Z",
  "topic": "test local scan",
  "description": "A test local cache entry",
  "tracked_files": [
    { "path": "test-file.ts", "mtime": 1735689600000, "hash": "abc123def456" }
  ]
}
```

### 8.3 Test Coverage Map

#### `tests/commands/list.test.ts`
- Returns all entries when `--agent all`
- Filters to external-only or local-only
- Correctly computes `age_human` for recent, old, and invalidated entries
- Marks external entries stale when age > 24h
- Always marks local entries as `is_stale: true`
- Returns empty array (not error) when cache directories are empty

#### `tests/commands/flush.test.ts`
- Deletes all external files when agent=external
- Deletes local context.json when agent=local
- Refuses to flush without `--confirm` (returns `CONFIRMATION_REQUIRED`)
- Does not delete `.lock` files
- Returns correct `deleted[]` list

#### `tests/commands/invalidate.test.ts`
- Zeros out `fetched_at` for a matched external entry
- Zeros out `timestamp` for local entry
- Preserves all other fields after invalidation
- Returns `NO_MATCH` for unrecognized keyword
- Invalidates all external entries when no keyword provided

#### `tests/commands/touch.test.ts`
- Updates `fetched_at` / `timestamp` to current time
- Preserves all other fields (Invariant #2 — no data loss)
- Returns `NO_MATCH` on unknown keyword
- Touches all external files when keyword omitted (`touch external` with no subject)

#### `tests/commands/prune.test.ts`
- Invalidates expired entries by default (without --delete)
- With `--delete`: deletes expired external files from disk
- Local cache always matches age threshold (age 0 rule)
- Respects `--agent external` (skips local) and `--agent local` (skips external)

#### `tests/commands/inspect.test.ts`
- Returns full content for exact subject match
- Returns `AMBIGUOUS_MATCH` when two files score identically
- Returns `NO_MATCH` for unknown subject
- Filters to the specified agent namespace (does not return results from the other namespace)

#### `tests/commands/checkFiles.test.ts`
- Returns status 'changed' when a tracked file's mtime or hash has changed
- Returns status 'unchanged' when all tracked files match stored hash/mtime
- Returns `unchanged` (not an error) when `tracked_files` is empty or absent
- Returns error `FILE_NOT_FOUND` when the local cache file itself is missing

#### `tests/commands/checkFreshness.test.ts`
- Returns `fresh` for mocked 304 response
- Returns `stale` for mocked 200 response
- Returns `error` for network failure without modifying cache
- Updates `header_metadata` with new ETag on 200 response
- Returns `overall: "stale"` when any source is stale
- Returns `overall: "stale"` for entries older than 24h regardless of HTTP status

#### `tests/commands/search.test.ts`
- Exact file stem match scores 100
- Substring file stem match scores 80
- Subject exact word match scores 70
- Subject substring match scores 50
- Description keyword match scores 30
- Multi-keyword search is additive
- Results sorted by score descending
- Case-insensitive matching
- Files with no match excluded from results
- Invalid JSON files skipped with warning to stderr

#### `tests/cache/cacheManager.test.ts`
- `readCache` returns parsed object for valid file
- `readCache` returns `PARSE_ERROR` for malformed JSON
- `readCache` returns `FILE_NOT_FOUND` for missing file
- `writeCache` creates file if not existing
- `writeCache` atomic: original preserved if write fails mid-way (simulate by killing temp write)
- `writeCache` acquires and releases lock
- Lock file is removed after successful write

#### `tests/cache/concurrency.test.ts`
- Two parallel `writeCache` calls do not produce corrupted output
- Second writer waits for first writer's lock to release
- Stale lock (mtime > 30s) is ignored and overridden
- Returns `LOCK_TIMEOUT` after 5s if lock never released (simulate hung lock with real PID)

#### `tests/http/freshnessChecker.test.ts`
- Sends `If-None-Match` header when etag is stored
- Sends `If-Modified-Since` header when last_modified is stored
- Correctly parses 304 → `fresh`
- Correctly parses 200 → `stale`
- Network timeout → `error` result, no throw
- Extracts ETag from 200 response headers

#### `tests/files/changeDetector.test.ts`
- Unchanged mtime → `unchanged`
- Changed mtime, no hash stored → `changed` with `reason: "mtime"`
- Changed mtime, hash stored and matches → `unchanged` (hash is authoritative)
- Changed mtime, hash stored and differs → `changed` with `reason: "hash"`
- Missing file → `missing`
- Empty `tracked_files` → returns all-unchanged result without error

---

## 9. Agent Integration Guide

### 9.1 `external-context-gatherer` Agent

**On startup** (before fetching):
```
cache-ctrl list --agent external --pretty
```
Inspect `is_stale` for the relevant subject. If `false`, skip fetching.

**For precise freshness check** (when `is_stale` is borderline):
```
cache-ctrl check-freshness <subject>
```
If `overall: "fresh"` → skip re-fetch. If `overall: "stale"` → proceed.

**After fetching and writing cache**: The agent writes its cache file using `cache_ctrl_write` (Tier 1) or `cache-ctrl write external <subject> --data '<json>'` (Tier 2). It should include the `description` field and the `header_metadata` block (can be empty `{}`). Direct file writes via `edit` bypass schema validation and are discouraged.

**To mark entry fresh after writing**:
```
cache-ctrl touch external <subject>
```

**To force re-fetch for a subject**:
```
cache-ctrl invalidate external <subject>
```

**Searching before fetching** (check if related info is already cached under a different subject):
```
cache-ctrl search <keyword1> [keyword2...]
```

---

### 9.2 `local-context-gatherer` Agent

**On startup** (always runs this check before deciding to re-scan):
```
cache-ctrl check-files
```

If `status: "changed"` → invalidate and re-scan:
```
cache-ctrl invalidate local
```

If `status: "unchanged"` → use cached context. Optionally call:
```
cache-ctrl list --agent local --pretty
```
to confirm the entry is present and not manually invalidated.

**When writing cache**: The agent MUST use `cache_ctrl_write` (Tier 1) or `cache-ctrl write local --data '<json>'` (Tier 2). The content MUST include `tracked_files[]` (with `path`, `mtime`, and optionally `hash`). Direct file writes via `edit` bypass schema validation and are discouraged. `check-files` returns `unchanged` silently if `tracked_files` is absent.

**Schema compliance**: The agent should also include `description` (a one-liner summary of what was scanned) in the cache file. This enables `cache-ctrl search` to find the local cache entry by keyword.

---

### 9.3 Permission Requirements

Both agents currently have `bash: deny` with specific allowlist entries. To use `cache-ctrl` commands from bash, the following pattern must be added to each agent's frontmatter:

```yaml
bash:
  "cache-ctrl *": "allow"
```

Alternatively, agents may call the native opencode tools (`cache_ctrl_search`, `cache_ctrl_list`, etc.) via the plugin integration without requiring bash permission.

**Plugin tool access**: Since `plugin.ts` is symlinked to `.opencode/tools/cache-ctrl.ts`, opencode will auto-discover and register the tools. No additional configuration is required.

---

## 10. install.sh Spec

### 10.1 Prerequisites

The install script checks for the following before creating symlinks:

| Prerequisite | Check command | Failure action |
|---|---|---|
| `bun` in PATH | `command -v bun` | Print error and exit 1 |
| `~/.local/bin` directory exists | `[[ -d ~/.local/bin ]]` | `mkdir -p ~/.local/bin` and continue |
| `.opencode/tools/` directory exists | `[[ -d <repo>/.opencode/tools ]]` | `mkdir -p <repo>/.opencode/tools` and continue |

### 10.2 Symlinks to Create

| From (symlink location) | To (real file in repo) | Purpose |
|---|---|---|
| `~/.local/bin/cache-ctrl` | `$(pwd)/src/index.ts` | Global CLI command |
| `$(pwd)/../../.opencode/tools/cache-ctrl.ts` | `$(pwd)/cache_ctrl.ts` | opencode plugin registration |

> **Note**: The install script is executed from within `.config/opencode/custom-tool/cache-ctrl/`. `$(pwd)` refers to the `cache-ctrl/` directory. The `.opencode/tools/` path resolves to `<repo-root>/.opencode/tools/` via `$(pwd)/../../.opencode/tools/`.

### 10.3 install.sh Full Spec

> **Note**: `install.sh` intentionally has no shebang for shell compatibility across environments. Always invoke it explicitly: `zsh install.sh`. Do not add a shebang.

```zsh
# install.sh — cache-ctrl tool installer
#
# Installs cache-ctrl as:
#   1. A global CLI command at ~/.local/bin/cache-ctrl
#   2. An opencode plugin tool at .opencode/tools/cache-ctrl.ts
#
# Run from: .config/opencode/custom-tool/cache-ctrl/
# Usage: zsh install.sh

set -euo pipefail

TOOL_DIR="$(pwd)"
REPO_ROOT="$(cd "${TOOL_DIR}/../../.." && pwd)"

# ── Prerequisite checks ────────────────────────────────────

if ! command -v bun &> /dev/null; then
  print "ERROR: bun is not installed or not in PATH. Install bun first." >&2
  exit 1
fi

# ── Ensure target directories exist ───────────────────────

mkdir -p "${HOME}/.local/bin"
mkdir -p "${REPO_ROOT}/.opencode/tools"

# ── CLI symlink ────────────────────────────────────────────
# ~/.local/bin/cache-ctrl → <cache-ctrl-dir>/src/index.ts
ln -sf "${TOOL_DIR}/src/index.ts" "${HOME}/.local/bin/cache-ctrl"

# ── opencode plugin symlink ────────────────────────────────
# .opencode/tools/cache-ctrl.ts → <cache-ctrl-dir>/cache_ctrl.ts
ln -sf "${TOOL_DIR}/cache_ctrl.ts" "${REPO_ROOT}/.opencode/tools/cache-ctrl.ts"

# ── Install dependencies ───────────────────────────────────
# bun install is idempotent — safe to re-run
if [[ -f "${TOOL_DIR}/package.json" ]]; then
  bun install --cwd "${TOOL_DIR}"
fi

# ── Verify ─────────────────────────────────────────────────
print "cache-ctrl installed:"
print "  CLI     → ${HOME}/.local/bin/cache-ctrl"
print "  Plugin  → ${REPO_ROOT}/.opencode/tools/cache-ctrl.ts"
```

### 10.4 Idempotency

Both `ln -sf` calls use the force flag (`-f`) which overwrites any existing symlink. Re-running `zsh install.sh` is safe and produces the same result.

### 10.5 Shebang in `src/index.ts`

The `src/index.ts` file must begin with:
```
#!/usr/bin/env bun
```
This allows it to be executed directly as a shell script when symlinked to `~/.local/bin/cache-ctrl`. Bun will interpret the TypeScript file natively.

---

## 11. TypeScript Configuration Reference

### `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "cache_ctrl.ts", "tests/**/*"]
}
```

### `package.json`

```json
{
  "name": "cache-ctrl",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "bunx vitest run",
    "test:watch": "bunx vitest"
  },
  "dependencies": {
    "@opencode-ai/plugin": "1.3.13",
    "zod": "4.1.8"
  },
  "devDependencies": {
    "vitest": "3.2.4",
    "@types/bun": "1.2.9"
  }
}
```

---

## 12. Key Invariants (Implementation Constraints)

1. **No cross-namespace reads**: External commands must never touch local cache files and vice versa.
2. **Preserve unknown fields**: `cacheManager.writeCache()` must merge the updated fields into the existing parsed object — never replace the entire file with a new object. Agents may add arbitrary fields that `cache-ctrl` does not know about.
3. **No silent data loss**: Any error during a write operation must return `{ ok: false, ... }` and leave the original file untouched (guaranteed by atomic write-rename).
4. **JSON output is machine-readable by default**: No color codes, no table formatting, no human prose in stdout. All human-friendly output is gated behind `--pretty` (which still outputs valid JSON, but indented).
5. **Result pattern is mandatory**: No function in `src/` may throw an exception as part of its normal error path. Only truly impossible states (programmer errors) should use `throw` — and those must be documented with a comment.
6. **Lock files are not cache files**: `list`, `flush`, and `search` must ignore `.lock` files when enumerating cache entries.
7. **Plugin and CLI share logic**: The plugin tools must import and call the same functions as the CLI commands. Duplication of business logic between `plugin.ts` and `src/commands/` is not permitted.
