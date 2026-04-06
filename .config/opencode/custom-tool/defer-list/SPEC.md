# Feature Specification: `defer-list` — Persistent Deferred Findings Tool

**Project**: `defer-list` CLI (TypeScript/Bun)  
**Location**: `.config/opencode/custom-tool/defer-list/`  
**Author**: PM/Tech Lead  
**Date**: 2026-04-06  
**Status**: Draft v1 — reviewer fixes applied (v2)

---

## 1. Overview

### Problem

AI agents (especially the Orchestrator) often discover security issues, architectural concerns, and reviewer challenges that are too costly to address immediately. Today, these findings either block the session or are forgotten — there is no mechanism to persist them across sessions in a structured, retrievable way.

### Solution

`defer-list` is a CLI tool and opencode plugin that allows AI agents to persist "deferred findings" to a JSON store at `.ai/deferred-list/deferred.json`. Findings survive session boundaries without being acted on immediately. Agents can later list, get full details on, resolve, export snapshots of, or flush deferred entries as the project progresses.

### Why a Separate Store

- **Separation of concerns**: The `cache-ctrl` tool manages ephemeral scan context. `defer-list` manages durable findings that require human-visible tracking.
- **Non-destructive by default**: Export is a read-only snapshot. Entries are not mutated unless the agent explicitly resolves or removes them.
- **Session survival**: A finding deferred in session 1 is still visible in session 5 unless explicitly resolved or discarded.

### Scope Boundary

`defer-list` manages **entry lifecycle only** — it does not evaluate findings, send notifications, or integrate with issue trackers. It is a persistent key-value store with lifecycle semantics.

---

## 2. Complete File Tree

All files to be created (relative to `defer-list/`):

```
defer-list/
├── SPEC.md                         ← this file
├── defer_list.ts                   ← opencode plugin entry point (auto-discovered by opencode)
├── package.json                    ← Bun project manifest
├── tsconfig.json                   ← TypeScript config (verbatimModuleSyntax, strict)
├── vitest.config.ts                ← Unit test runner config
├── install.sh                      ← Idempotent symlink installer
├── README.md                       ← Usage documentation
├── .dockerignore                   ← Excludes node_modules/, .ai/, *.lock from Docker build context
├── src/
│   ├── index.ts                    ← CLI entry point (bun run src/index.ts)
│   ├── types/
│   │   ├── result.ts               ← Result<T, E> + ErrorCode (reuse + extend cache-ctrl pattern)
│   │   └── store.ts                ← DeferredEntry + DeferredStore Zod schemas + inferred types
│   ├── store/
│   │   └── storeManager.ts         ← Read/write .ai/deferred-list/deferred.json (advisory lock)
│   ├── commands/
│   │   ├── add.ts                  ← defer_list_add
│   │   ├── list.ts                 ← defer_list_list
│   │   ├── get.ts                  ← defer_list_get
│   │   ├── remove.ts               ← defer_list_remove
│   │   ├── resolve.ts              ← defer_list_resolve
│   │   ├── export.ts               ← defer_list_export
│   │   └── flush.ts                ← defer_list_flush
│   └── utils/
│       └── idGen.ts                ← ID generator: def-YYYYMMDD-xxxxxx
├── tests/
│   ├── store/
│   │   └── storeManager.test.ts
│   └── commands/
│       ├── add.test.ts
│       ├── list.test.ts
│       ├── get.test.ts
│       ├── remove.test.ts
│       ├── resolve.test.ts
│       ├── export.test.ts
│       └── flush.test.ts
└── e2e/
    ├── FEATURE_SPEC.md             ← E2E test spec (inlined below in Section 6)
    ├── Dockerfile
    ├── docker-compose.yml
    ├── vitest.config.ts
    ├── helpers/
    │   └── cli.ts                  ← Bun.spawn-based CLI subprocess helper
    └── tests/
        ├── smoke.e2e.test.ts
        ├── add.e2e.test.ts
        ├── list.e2e.test.ts
        ├── get.e2e.test.ts
        ├── remove.e2e.test.ts
        ├── resolve.e2e.test.ts
        ├── export.e2e.test.ts
        ├── flush.e2e.test.ts
        └── help.e2e.test.ts
```

**Storage layout at runtime** (outside the project, inside the target repo):

```
.ai/
├── deferred-list/
│   ├── deferred.json               ← Single source of truth
│   └── deferred.json.lock          ← Advisory lock file (created transiently)
└── deferred-list-context/
    └── <name>.json                 ← Export snapshots (non-destructive)
```

---

## 3. Data Model

### 3.1 `DeferredEntry` Schema

**File**: `src/types/store.ts`

```typescript
import { z } from "zod";

export const DeferredEntrySchema = z.looseObject({
  id: z.string(),                                                   // "def-YYYYMMDD-xxxxxx"
  created_at: z.string(),                                           // ISO 8601
  updated_at: z.string().optional(),                                // ISO 8601, set on any mutation
  agent: z.string(),                                                // name of agent that added it
  source: z.string(),                                               // tool/command that triggered it
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  title: z.string(),                                                // short one-line summary
  details: z.string(),                                              // full description / finding
  status: z.enum(["pending", "reviewed", "resolved", "discarded"]),
  file_path: z.string().optional(),                                 // optional file context
  line: z.number().optional(),                                      // optional line number
  snippet: z.string().optional(),                                   // optional code snippet
  resolution_note: z.string().optional(),                           // filled on resolve/discard
});

export type DeferredEntry = z.infer<typeof DeferredEntrySchema>;
```

**ID format**: `def-YYYYMMDD-xxxxxx` where `YYYYMMDD` is UTC date and `xxxxxx` is 6 random lowercase alphanumeric chars.  
**Example**: `def-20260406-k3xm9a`

---

### 3.2 `DeferredStore` Schema

```typescript
export const DeferredStoreSchema = z.looseObject({
  version: z.literal("1"),
  updated_at: z.string(),               // ISO 8601, last store-level mutation time
  entries: z.array(DeferredEntrySchema),
});

export type DeferredStore = z.infer<typeof DeferredStoreSchema>;
```

**Storage path**: `.ai/deferred-list/deferred.json`  
**Lock path**: `.ai/deferred-list/deferred.json.lock`  
**Cold start**: If the file does not exist, commands treat it as `{ version: "1", updated_at: "", entries: [] }`.

---

### 3.3 `SummaryEntry` Type

`defer_list_list` returns summaries only — never full `details` or `snippet`.

```typescript
// Derived type (not stored separately): pick from DeferredEntry
export type SummaryEntry = Pick<
  DeferredEntry,
  "id" | "created_at" | "updated_at" | "agent" | "source" | "severity" | "title" | "status" | "file_path" | "line"
>;
```

---

### 3.4 Status Lifecycle

```
pending ──► reviewed ──► resolved
pending ──────────────► resolved     (skip reviewed)
pending ──────────────► discarded
reviewed ─────────────► resolved
reviewed ─────────────► discarded
```

**Terminal states**: `resolved` and `discarded`. Entries in a terminal state cannot be transitioned further.

**Valid transition table**:

| From \ To  | reviewed | resolved | discarded |
|------------|----------|----------|-----------|
| `pending`  | ✅        | ✅        | ✅         |
| `reviewed` | ✗        | ✅        | ✅         |
| `resolved` | ✗        | ✗        | ✗         |
| `discarded`| ✗        | ✗        | ✗         |

---

## 4. Feature Specifications

### Feature 1: `defer_list_add` — Add a Deferred Entry

**File**: `src/commands/add.ts`  
**Plugin tool**: `defer_list_add`  
**CLI**: `defer-list add`

#### Purpose

Appends a new deferred finding to the store. Generates a unique ID and sets initial status to `"pending"`.

#### Input Parameters

| Parameter   | Type                                       | Required | Description                                        |
|-------------|--------------------------------------------|----------|----------------------------------------------------|
| `agent`     | `string`                                   | Yes      | Name of the agent adding the finding               |
| `source`    | `string`                                   | Yes      | Tool/command that triggered it (e.g. `"critic"`)   |
| `title`     | `string`                                   | Yes      | Short one-line summary                             |
| `details`   | `string`                                   | Yes      | Full description / finding text                    |
| `severity`  | `"low"\|"medium"\|"high"\|"critical"`      | No       | Severity level                                     |
| `file_path` | `string`                                   | No       | File path context                                  |
| `line`      | `number`                                   | No       | Line number within `file_path`                     |
| `snippet`   | `string`                                   | No       | Relevant code snippet                              |

#### Output

```typescript
{ ok: true; value: { id: string; entry: DeferredEntry } }
```

#### Behavior

1. Generate `id` using `idGen` (`def-YYYYMMDD-xxxxxx`).
2. Set `status: "pending"`, `created_at: new Date().toISOString()`.
3. Acquire advisory lock on `deferred.json.lock`.
4. Read store (or cold-start empty store if file absent).
5. Append new entry to `store.entries`.
6. Set `store.updated_at: new Date().toISOString()`.
7. Write store to disk.
8. Release lock.
9. Return `{ ok: true, value: { id, entry } }`.

#### Error Cases

| Code              | Condition                                              |
|-------------------|--------------------------------------------------------|
| `LOCK_TIMEOUT`    | Lock cannot be acquired within the timeout window      |
| `FILE_WRITE_ERROR`| Write to disk fails                                    |
| `INVALID_ARGS`    | Required fields (`agent`, `source`, `title`, `details`) are missing or empty |
| `VALIDATION_ERROR`| Entry fails `DeferredEntrySchema` validation           |

#### Invariants

- `id` is set at creation and never changes.
- `status` is always `"pending"` on creation.
- `created_at` is set at creation and never mutated.
- No secrets (tokens, passwords) should be included in `details` or `snippet`.

---

### Feature 2: `defer_list_list` — List Entries by Status

**File**: `src/commands/list.ts`  
**Plugin tool**: `defer_list_list`  
**CLI**: `defer-list list`

#### Purpose

Returns summary-only entries filtered by status. Full details require `defer_list_get`.

#### Input Parameters

| Parameter | Type                                                    | Required | Default      | Description           |
|-----------|---------------------------------------------------------|----------|--------------|-----------------------|
| `status`  | `"pending"\|"reviewed"\|"resolved"\|"discarded"`        | No       | `"pending"`  | Filter by this status |

#### Output

```typescript
{ ok: true; value: { entries: SummaryEntry[] } }
```

`SummaryEntry` includes: `id`, `created_at`, `updated_at`, `agent`, `source`, `severity`, `title`, `status`, `file_path`, `line`.  
`details`, `snippet`, and `resolution_note` are **never** included in list output.

#### Behavior

1. Read store (cold-start: return empty list — not an error).
2. Filter entries where `entry.status === status`.
3. Map each matching entry to `SummaryEntry` (omit `details`, `snippet`, `resolution_note`).
4. Return `{ ok: true, value: { entries: SummaryEntry[] } }`.

#### Error Cases

| Code           | Condition                                      |
|----------------|------------------------------------------------|
| `INVALID_ARGS` | `status` value is not one of the four valid enums |

#### Invariants

- `details`, `snippet`, and `resolution_note` are never returned by this command — callers must use `defer_list_get` for full data.
- An empty store or no matching entries returns `{ ok: true, value: { entries: [] } }` — never an error.
- No lock required (read-only operation).

---

### Feature 3: `defer_list_get` — Get Full Entry by ID

**File**: `src/commands/get.ts`  
**Plugin tool**: `defer_list_get`  
**CLI**: `defer-list get <id>`

#### Purpose

Returns the complete `DeferredEntry` for a given ID, including `details`, `snippet`, and `resolution_note`.

#### Input Parameters

| Parameter | Type     | Required | Description                         |
|-----------|----------|----------|-------------------------------------|
| `id`      | `string` | Yes      | Entry ID (`def-YYYYMMDD-xxxxxx`)    |

#### Output

```typescript
{ ok: true; value: { entry: DeferredEntry } }
```

#### Behavior

1. Read store (cold-start: treat as empty store).
2. Find entry where `entry.id === id`.
3. If found, return full entry.
4. If not found, return `ENTRY_NOT_FOUND`.

#### Error Cases

| Code              | Condition                                      |
|-------------------|------------------------------------------------|
| `ENTRY_NOT_FOUND` | No entry with the given ID exists in the store |
| `INVALID_ARGS`    | `id` is missing or empty                       |

#### Invariants

- No lock required (read-only operation).
- Returns all fields, including `details` and `snippet`.

---

### Feature 4: `defer_list_remove` — Hard Delete an Entry

**File**: `src/commands/remove.ts`  
**Plugin tool**: `defer_list_remove`  
**CLI**: `defer-list remove <id>`

#### Purpose

Permanently removes an entry from the store. Irreversible. Use `defer_list_resolve` with `status: "discarded"` for a soft delete that preserves the record.

#### Input Parameters

| Parameter | Type     | Required | Description                         |
|-----------|----------|----------|-------------------------------------|
| `id`      | `string` | Yes      | Entry ID to remove                  |

#### Output

```typescript
{ ok: true; value: { id: string } }
```

#### Behavior

1. Acquire advisory lock.
2. Read store.
3. Find entry by `id`. If not found, return `ENTRY_NOT_FOUND`.
4. Filter entry out of `store.entries`.
5. Set `store.updated_at: new Date().toISOString()`.
6. Write store.
7. Release lock.
8. Return `{ ok: true, value: { id } }`.

#### Error Cases

| Code              | Condition                                          |
|-------------------|----------------------------------------------------|
| `ENTRY_NOT_FOUND` | No entry with the given ID exists                  |
| `INVALID_ARGS`    | `id` is missing or empty                           |
| `LOCK_TIMEOUT`    | Lock cannot be acquired                            |
| `FILE_WRITE_ERROR`| Write fails                                        |

#### Invariants

- Hard delete is permanent — no soft-delete semantics. If the caller wants to preserve the record, use `defer_list_resolve`.
- `store.updated_at` is always updated on removal.

---

### Feature 5: `defer_list_resolve` — Transition Entry Status

**File**: `src/commands/resolve.ts`  
**Plugin tool**: `defer_list_resolve`  
**CLI**: `defer-list resolve <id> --status <reviewed|resolved|discarded>`

#### Purpose

Transitions an entry's status through the allowed lifecycle. Optionally records a resolution note.

#### Input Parameters

| Parameter         | Type                                         | Required | Description                                |
|-------------------|----------------------------------------------|----------|--------------------------------------------|
| `id`              | `string`                                     | Yes      | Entry ID to transition                     |
| `status`          | `"reviewed"\|"resolved"\|"discarded"`        | Yes      | Target status                              |
| `resolution_note` | `string`                                     | No       | Human-readable note explaining the action  |

#### Output

```typescript
{ ok: true; value: { entry: DeferredEntry } }
```

#### Behavior

1. Acquire advisory lock.
2. Read store.
3. Find entry by `id`. If not found, return `ENTRY_NOT_FOUND`.
4. Validate the transition is allowed per the status lifecycle table. If invalid, return `INVALID_STATUS`.
5. Set `entry.status = status`.
6. If `resolution_note` is provided, set `entry.resolution_note = resolution_note`.
7. Set `entry.updated_at = new Date().toISOString()`.
8. Set `store.updated_at = new Date().toISOString()`.
9. Write store.
10. Release lock.
11. Return `{ ok: true, value: { entry } }`.

#### Error Cases

| Code              | Condition                                                                |
|-------------------|--------------------------------------------------------------------------|
| `ENTRY_NOT_FOUND` | No entry with the given ID exists                                        |
| `INVALID_STATUS`  | Transition not allowed (e.g. `resolved → reviewed`, or terminal → any)  |
| `INVALID_ARGS`    | `id` or `status` missing; or `status` not one of the three valid values  |
| `LOCK_TIMEOUT`    | Lock cannot be acquired                                                  |
| `FILE_WRITE_ERROR`| Write fails                                                              |

#### Invariants

- Terminal states (`resolved`, `discarded`) cannot be transitioned further — `INVALID_STATUS` is returned.
- `updated_at` is set on the entry and the store on every successful transition.
- `resolution_note` is preserved across subsequent reads.
- **CLI flag mapping**: The plugin tool parameter is named `resolution_note`. The CLI flag is `--note`. These are equivalent; the CLI maps `--note` → `resolution_note`.

---

### Feature 6: `defer_list_export` — Snapshot Pending/Reviewed Entries

**File**: `src/commands/export.ts`  
**Plugin tool**: `defer_list_export`  
**CLI**: `defer-list export <name>`

#### Purpose

Writes a snapshot of all `pending` and `reviewed` entries to `.ai/deferred-list-context/<name>.json`. Non-destructive — no entry statuses are mutated.

#### Input Parameters

| Parameter | Type     | Required | Description                                                          |
|-----------|----------|----------|----------------------------------------------------------------------|
| `name`    | `string` | Yes      | Snapshot filename stem (result: `.ai/deferred-list-context/<name>.json`) |

#### Output

```typescript
{ ok: true; value: { path: string; count: number } }
```

Where `path` is the absolute or repo-relative path of the written snapshot file.

#### Behavior

1. Read store (cold-start: empty entries → `count: 0` snapshot is valid).
2. Filter entries where `entry.status === "pending" || entry.status === "reviewed"`.
3. Validate `name` using the same allowlist pattern as `validateSubject` in `cache-ctrl/src/utils/validate.ts`: `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`, max 128 chars. Return `INVALID_ARGS` if invalid. Extract this as a local `validateName` function in `src/utils/validate.ts`, or copy `validateSubject` verbatim.
4. Resolve export directory: `.ai/deferred-list-context/` relative to repo root.
5. Create export directory if it does not exist. On failure, return `EXPORT_DIR_ERROR`.
6. Write snapshot JSON: `{ exported_at: new Date().toISOString(), count: N, entries: [...] }`.
7. Return `{ ok: true, value: { path, count: N } }`.

#### Error Cases

| Code               | Condition                                                   |
|--------------------|-------------------------------------------------------------|
| `INVALID_ARGS`     | `name` is missing, empty, or contains path traversal        |
| `EXPORT_DIR_ERROR` | Cannot create `.ai/deferred-list-context/` directory        |
| `FILE_WRITE_ERROR` | Cannot write the snapshot file                              |

#### Invariants

- Export is **always non-destructive** — no entry statuses are modified.
- Export includes full entries (all fields including `details` and `snippet`).
- Only `pending` and `reviewed` entries are included — `resolved` and `discarded` entries are excluded.

> **Note**: "pending and reviewed" are the active set — entries a future session may still need to act on.

---

### Feature 7: `defer_list_flush` — Delete All Entries

**File**: `src/commands/flush.ts`  
**Plugin tool**: `defer_list_flush`  
**CLI**: `defer-list flush --confirm`

#### Purpose

Destroys all entries in the store and resets it to an empty state. Requires an explicit `confirm: true` flag to prevent accidental data loss.

#### Input Parameters

| Parameter | Type      | Required | Description                                          |
|-----------|-----------|----------|------------------------------------------------------|
| `confirm` | `boolean` | Yes      | Must be `true`. Any other value returns `FLUSH_ABORTED` |

#### Output

```typescript
{ ok: true; value: { deleted: number } }
```

Where `deleted` is the count of entries that were removed.

#### Behavior

1. If `confirm !== true` (including `false`, absent, or any non-boolean): return `FLUSH_ABORTED`.
2. Acquire advisory lock.
3. Read store (to count entries before flush).
4. Set `deleted = store.entries.length`.
5. Reset store to `{ version: "1", updated_at: new Date().toISOString(), entries: [] }`.
6. Write store.
7. Release lock.
8. Return `{ ok: true, value: { deleted } }`.

#### Error Cases

| Code              | Condition                                           |
|-------------------|-----------------------------------------------------|
| `FLUSH_ABORTED`   | `confirm` is not `true`                             |
| `LOCK_TIMEOUT`    | Lock cannot be acquired                             |
| `FILE_WRITE_ERROR`| Write fails                                         |

#### Invariants

- `confirm: false`, `confirm: undefined`, and absent `confirm` all return `FLUSH_ABORTED` — only boolean `true` proceeds.
- After flush, the store file exists on disk with `entries: []`.
- Export snapshots in `.ai/deferred-list-context/` are **not** deleted by flush.

---

## 5. Error Codes (`src/types/result.ts`)

Reuse all error codes from `cache-ctrl/src/types/result.ts` and add the following:

```typescript
export enum ErrorCode {
  // ── Inherited from cache-ctrl ──────────────────────────────
  FILE_NOT_FOUND        = "FILE_NOT_FOUND",
  FILE_READ_ERROR       = "FILE_READ_ERROR",
  FILE_WRITE_ERROR      = "FILE_WRITE_ERROR",
  PARSE_ERROR           = "PARSE_ERROR",

  LOCK_TIMEOUT          = "LOCK_TIMEOUT",
  LOCK_ERROR            = "LOCK_ERROR",

  INVALID_AGENT         = "INVALID_AGENT",   // unused in defer-list but preserved for consistency
  INVALID_ARGS          = "INVALID_ARGS",
  CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED",  // preserved for consistency
  VALIDATION_ERROR      = "VALIDATION_ERROR",

  NO_MATCH              = "NO_MATCH",
  AMBIGUOUS_MATCH       = "AMBIGUOUS_MATCH",

  HTTP_REQUEST_FAILED   = "HTTP_REQUEST_FAILED",  // unused but preserved
  URL_NOT_FOUND         = "URL_NOT_FOUND",         // unused but preserved

  UNKNOWN               = "UNKNOWN",

  // ── defer-list additions ───────────────────────────────────
  ENTRY_NOT_FOUND       = "ENTRY_NOT_FOUND",   // entry with given ID does not exist
  INVALID_STATUS        = "INVALID_STATUS",     // transition not allowed from current status
  EXPORT_DIR_ERROR      = "EXPORT_DIR_ERROR",   // cannot create export directory
  FLUSH_ABORTED         = "FLUSH_ABORTED",      // flush called without confirm: true
}

export interface DeferError {
  code: ErrorCode;
  error: string;
}

export type Result<T, E extends DeferError = DeferError> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: E["code"] };
```

> **`FLUSH_ABORTED` exit code**: `FLUSH_ABORTED` is classified as a **business logic error (exit 1)**, not a usage error (exit 2), because the `confirm` field is recognized and intentionally rejected — not malformed or missing. A caller that passes `--confirm false` is using the CLI correctly but choosing not to proceed.

---

## 6. CLI Commands

**Binary name**: `defer-list`  
**Entry point**: `src/index.ts`

All commands output JSON to **stdout** on success (exit code `0`) and JSON to **stderr** on error (exit codes `1` or `2`).

| Exit code | Meaning                             |
|-----------|-------------------------------------|
| `0`       | Success                             |
| `1`       | Business logic / not-found error    |
| `2`       | Usage / argument validation error   |

### Command Reference

```
defer-list add
  --agent     <string>                (required)
  --source    <string>                (required)
  --title     <string>                (required)
  --details   <string>                (required)
  [--severity low|medium|high|critical]
  [--file-path <string>]
  [--line     <number>]
  [--snippet  <string>]

defer-list list
  [--status pending|reviewed|resolved|discarded]   (default: pending)

defer-list get <id>

defer-list remove <id>

defer-list resolve <id>
  --status reviewed|resolved|discarded             (required)
  [--note <string>]

defer-list export <name>

defer-list flush
  --confirm                                        (boolean flag, must be present)

defer-list help [command]
```

### Output Shape — Success

```json
{
  "ok": true,
  "value": { ... },
  "server_time": "2026-04-06T11:00:00.000Z"
}
```

### Output Shape — Error

```json
{
  "ok": false,
  "error": "Entry with id def-20260406-k3xm9a not found",
  "code": "ENTRY_NOT_FOUND",
  "server_time": "2026-04-06T11:00:00.000Z"
}
```

> `server_time` is injected by the `withServerTime` wrapper in both CLI output and the opencode plugin layer.

---

## 7. Plugin Entry Point (`defer_list.ts`)

### Pattern: `withServerTime` Wrapper

Replicate the exact `withServerTime` wrapper from `cache_ctrl.ts`:

```typescript
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import type { ... } from "./src/types/store.js";
import { addCommand } from "./src/commands/add.js";
// ... etc

function withServerTime(result: unknown): string {
  const base = result !== null && typeof result === "object" ? result : {};
  return JSON.stringify({ ...base, server_time: new Date().toISOString() });
}
```

Each tool:
1. Wraps its result with `withServerTime(result)`.
2. Catches uncaught exceptions and returns `withServerTime({ ok: false, error: ..., code: ErrorCode.UNKNOWN })`.
3. Uses `import type` for type-only imports (`verbatimModuleSyntax: true`).

### 7 Tool Registrations

| Export name          | Maps to command   | Args schema                                                               |
|----------------------|-------------------|---------------------------------------------------------------------------|
| `defer_list_add`     | `addCommand`      | `agent`, `source`, `title`, `details`, optional: `severity`, `file_path`, `line`, `snippet` |
| `defer_list_list`    | `listCommand`     | optional `status` (default `"pending"`)                                   |
| `defer_list_get`     | `getCommand`      | `id` (required string)                                                    |
| `defer_list_remove`  | `removeCommand`   | `id` (required string)                                                    |
| `defer_list_resolve` | `resolveCommand`  | `id`, `status` (required), optional `resolution_note`                     |
| `defer_list_export`  | `exportCommand`   | `name` (required string)                                                  |
| `defer_list_flush`   | `flushCommand`    | `confirm` (required boolean)                                              |

---

## 8. `storeManager.ts` — Advisory Locking Pattern

**File**: `src/store/storeManager.ts`

Mirrors the advisory lock pattern from `cache-ctrl/src/commands/write.ts` and `cache-ctrl/src/cache/cacheManager.ts`.

**Lock path**: `deferred.json + '.lock'` i.e. `.ai/deferred-list/deferred.json.lock`.

### Responsibilities

1. **`readStore(repoRoot: string): Promise<Result<DeferredStore>>`**  
   - Reads `.ai/deferred-list/deferred.json`.
   - If file absent: returns empty store `{ version: "1", updated_at: "", entries: [] }` as `ok: true`.
   - If file present but invalid JSON: returns `PARSE_ERROR`.
   - Validates against `DeferredStoreSchema` using `safeParse`. Returns `VALIDATION_ERROR` on schema mismatch.

2. **`writeStore(store: DeferredStore, repoRoot: string): Promise<Result<void>>`**  
   - Creates `.ai/deferred-list/` directory if absent.
   - Writes `deferred.json` atomically (write to temp file, rename).
   - Returns `FILE_WRITE_ERROR` on failure.

3. **`withLock<T>(fn: () => Promise<T>): Promise<T>`**  
   - Acquires advisory lock at `.ai/deferred-list/deferred.json.lock` (lock path: `deferred.json + '.lock'`).
   - Calls `fn()` inside a `try/finally` block — the lock file is **always** released in the `finally` block, so any thrown exception inside `fn()` does not leave a stale lock on disk.
   - Returns `LOCK_TIMEOUT` if lock cannot be acquired within the timeout window.

### Usage Pattern in Commands

```typescript
// Mutating commands use withLock:
return withLock(repoRoot, async () => {
  const readResult = await readStore(repoRoot);
  if (!readResult.ok) return readResult;
  const store = readResult.value;
  // ... mutate store ...
  return writeStore(updatedStore, repoRoot);
});

// Read-only commands (list, get) use readStore directly without a lock.
```

---

## 9. `idGen.ts` — ID Generator

**File**: `src/utils/idGen.ts`

### Specification

```typescript
// Generates: def-YYYYMMDD-xxxxxx
// YYYYMMDD = UTC date (zero-padded)
// xxxxxx   = 6 random lowercase alphanumeric chars (a-z0-9)
export function generateId(): string
```

**Format rules**:
- Always prefix `def-`.
- Date is UTC (`new Date()` formatted as `YYYYMMDD`).
- Random suffix: 6 characters drawn from `[a-z0-9]` using `crypto.getRandomValues` (or `crypto.randomBytes` in Node). Do **not** use `Math.random()` — it is not cryptographically random and produces weaker IDs.
- Total length: 18 characters (`def-` + 8 + `-` + 6).

**Example**: `def-20260406-k3xm9a`

**Uniqueness**: The combination of date + 6-char random suffix provides ~2.2 billion permutations per day. Collision probability is negligible for expected agent workloads.

---

## 10. `package.json`

```json
{
  "name": "defer-list",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "bunx vitest run",
    "test:watch": "bunx vitest",
    "test:e2e": "docker compose -f e2e/docker-compose.yml run --rm e2e"
  },
  "dependencies": {
    "@opencode-ai/plugin": "latest",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "vitest": "4.1.2",
    "@types/bun": "1.3.11"
  }
}
```

> Dependency versions are pinned to match `cache-ctrl/package.json` exactly. `@opencode-ai/plugin` uses `"latest"` per project policy — never pin this.

> **Maintenance note**: Dependency versions are pinned to match `cache-ctrl/package.json` at time of writing. When `cache-ctrl` dependencies are updated, update `defer-list` in sync.

---

## 11. `install.sh`

**Purpose**: Creates the opencode tool symlink so the plugin is auto-discovered by opencode.

```bash
#!/usr/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PLUGIN_SRC="$REPO_ROOT/.config/opencode/custom-tool/defer-list/defer_list.ts"
TOOLS_DIR="$HOME/.config/opencode/tools"
PLUGIN_LINK="$TOOLS_DIR/defer_list.ts"

mkdir -p "$TOOLS_DIR"
ln -sf "$PLUGIN_SRC" "$PLUGIN_LINK"

echo "✓ defer-list: symlink created → $PLUGIN_LINK"
```

**Behavior**:
- `ln -sf` — idempotent (overwrites existing symlink).
- Prints a confirmation message on success.
- Fails with non-zero exit if the source file does not exist (propagated by `set -e`).

---

## 12. Design Constraints & Invariants

The following invariants MUST be enforced by the implementation. Tests must verify each one.

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | **Single source of truth** | All state lives in `.ai/deferred-list/deferred.json`. No in-memory caches between commands. |
| 2 | **Advisory locking** | All mutating commands (`add`, `remove`, `resolve`, `flush`) acquire the `.lock` file before read-modify-write. |
| 3 | **Immutable IDs** | `id` is set at creation by `idGen` and never modified by any command. |
| 4 | **Terminal states are final** | `resolve` on a `resolved` or `discarded` entry returns `INVALID_STATUS`, never modifies the entry. |
| 5 | **Export is non-destructive** | `export` never modifies `status`, `updated_at`, or any field of any entry. |
| 6 | **`list` returns summaries only** | `details`, `snippet`, and `resolution_note` are always omitted from `list` output. |
| 7 | **`flush` requires explicit `confirm: true`** | `confirm: false`, `confirm: undefined`, missing, or any non-boolean returns `FLUSH_ABORTED`. |
| 8 | **`updated_at` set on all mutations** | Every mutating command sets `updated_at` on both the entry (where applicable) and `store.updated_at`. |
| 9 | **Graceful cold start** | If `.ai/deferred-list/deferred.json` does not exist, all read commands return empty results. Mutating commands create the file. |
| 10 | **No secrets in store** | Entries should never contain credentials, tokens, or private keys. (Enforced by policy, not by schema — agents must comply.) |
| 11 | **Path traversal guard on `export` name** | `name` is validated against `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/` (max 128 chars), mirroring `validateSubject` in `cache-ctrl/src/utils/validate.ts`. Implemented as `validateName` in `src/utils/validate.ts`. |
| 12 | **`server_time` on every response** | Both CLI and plugin tool responses include `server_time: new Date().toISOString()` at the outer JSON level. |

---

## 13. Orchestrator Integration

After approval and implementation, the following changes must be applied to `.config/opencode/deployable-agents/implementer/Orchestrator.md`.

### 13.1 Permissions Section Addition

Add to the `permission:` block:

```yaml
permission:
  # ... existing entries ...
  "defer_list_*": "allow"
  bash:
    # ... existing bash entries ...
    "mkdir -p .ai/deferred-list": "allow"
    "mkdir -p .ai/deferred-list-context": "allow"
```

### 13.2 Workflow Step 8 — Security Triage (Deferred Classification)

In Workflow Step 8, when a finding is classified as **"Deferred"**, the Orchestrator must:

1. Call `defer_list_add` with:
   - `agent`: `"Orchestrator"`
   - `source`: name of the subagent that produced the finding (e.g. `"security-reviewer"`, `"critic"`)
   - `title`: one-line summary of the finding
   - `details`: full finding text from the subagent
   - `severity`: mapped from the finding severity if available
   - `file_path` / `line` / `snippet`: if the finding references a specific code location
2. Record the returned `id` in the Context Snapshot under `deferred_findings: [{ id, title, severity }]`.

**Motivation**: Without this step, deferred findings are lost when the session compacts or ends. The `defer-list` store survives session boundaries.

### 13.3 Workflow Step 10 — Summarize (Session Close)

Before closing the session (after summarizing blocking issues and next steps), the Orchestrator must:

1. Call `defer_list_list` (defaults to `status: "pending"`).
2. If `entries` is non-empty, present the user with the entry summaries and three options:
   - **Act now** — continue the session to address one or more deferred items.
   - **Export snapshot** — call `defer_list_export` with a session-named snapshot (e.g. `session-2026-04-06`). Report the returned `path` to the user.
   - **Discard all** — for each entry, call `defer_list_resolve` with `status: "discarded"` and a note explaining the discard reason.
3. If `entries` is empty, no action required — proceed normally.

**Motivation**: Ensures deferred findings surface to the user at the natural end of a session rather than silently accumulating.

---

## 14. E2E Test Specification

### 14.1 Infrastructure

The E2E harness follows the exact same Docker-based architecture as `cache-ctrl/e2e/`.

#### `e2e/Dockerfile`

```dockerfile
FROM oven/bun:latest

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

ENV GIT_AUTHOR_NAME="E2E Test Runner"
ENV GIT_AUTHOR_EMAIL="e2e@defer-list.test"
ENV GIT_COMMITTER_NAME="E2E Test Runner"
ENV GIT_COMMITTER_EMAIL="e2e@defer-list.test"

WORKDIR /app

# Source bind-mounted at runtime via docker-compose.yml
CMD ["sh", "-c", "bun install && bunx vitest run --config e2e/vitest.config.ts"]
```

> Unlike `cache-ctrl`, `defer-list` does not require `git` — no `check-files` integration. The `ca-certificates` package is included for future-proofing.

#### `e2e/docker-compose.yml`

```yaml
services:
  e2e:
    build:
      context: .
      dockerfile: e2e/Dockerfile
    volumes:
      - .:/app
    working_dir: /app
```

#### `.dockerignore`

**File path**: `defer-list/.dockerignore` (build context root)

```
node_modules/
.ai/
*.lock
```

**Rationale**: `node_modules/` is installed inside the container by `bun install` and must not be sent in the build context. `.ai/` contains runtime state and local deferred store data — not build-time inputs. `*.lock` excludes advisory lock files that may be transiently present on disk during development.

#### `e2e/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e/tests/**/*.e2e.test.ts"],
    testTimeout: 30_000,
    pool: "forks",
    coverage: { enabled: false },
  },
});
```

#### `tsconfig.json` — E2E inclusion

The `tsconfig.json` `include` array must cover `e2e/**/*` in addition to `src/**/*` and `tests/**/*` to ensure E2E helper and test files are type-checked:

```json
{
  "include": ["src/**/*", "defer_list.ts", "tests/**/*", "e2e/**/*"]
}
```

Without this, `e2e/helpers/cli.ts` and all test files are excluded from TypeScript checking.

---

### 14.2 `e2e/helpers/cli.ts`

Identical pattern to `cache-ctrl/e2e/helpers/cli.ts`. Key differences:
- Binary invocation: `["bun", "/app/src/index.ts", ...args]`
- `CliResult` interface with `stdout`, `stderr`, `exitCode` (same shape)
- `runCli(args, options?)` — always resolves, never rejects
- `parseJsonOutput<T>(raw: string): T` — parse stdout or stderr as JSON

---

### 14.3 E2E Test Files — Per-Command Coverage

#### Shared Setup Pattern (all test files)

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli, parseJsonOutput } from "../helpers/cli.ts";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "defer-list-e2e-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});
```

All `runCli` calls use `{ cwd: testDir }`. Unlike `cache-ctrl`, no fixture template is needed — `defer-list` cold-starts cleanly from an empty directory.

---

#### `e2e/tests/smoke.e2e.test.ts`

Full pipeline integration: add → list → get → resolve → list again.

```
describe("smoke: full lifecycle")
  it("add → list → get → resolve → list again")
    1. runCli(["add", "--agent", "Orchestrator", "--source", "security-reviewer",
               "--title", "SQL injection risk", "--details", "Unsanitized input in query builder",
               "--severity", "high"], { cwd: testDir })
       Assert: exitCode === 0, ok === true, value.id starts with "def-"
       Store returned id.

    2. runCli(["list"], { cwd: testDir })
       Assert: exitCode === 0, ok === true
       Assert: value.entries.length === 1
       Assert: value.entries[0].id === storedId
       Assert: value.entries[0].status === "pending"
       Assert: value.entries[0].details is undefined (summary only)

    3. runCli(["get", storedId], { cwd: testDir })
       Assert: exitCode === 0, ok === true
       Assert: value.entry.id === storedId
       Assert: value.entry.details === "Unsanitized input in query builder"

    4. runCli(["resolve", storedId, "--status", "resolved", "--note", "Fixed in PR #42"],
              { cwd: testDir })
       Assert: exitCode === 0, ok === true
       Assert: value.entry.status === "resolved"
       Assert: value.entry.resolution_note === "Fixed in PR #42"

    5. runCli(["list"], { cwd: testDir })
       Assert: exitCode === 0, ok === true
       Assert: value.entries.length === 0  (resolved entries excluded from default pending list)

    6. runCli(["list", "--status", "resolved"], { cwd: testDir })
       Assert: exitCode === 0, ok === true
       Assert: value.entries.length === 1
       Assert: value.entries[0].id === storedId
```

---

#### `e2e/tests/add.e2e.test.ts`

```
describe("add")
  it("adds entry with all required fields and returns id + entry")
    Assert: exitCode === 0, ok === true
    Assert: value.id matches /^def-\d{8}-[a-z0-9]{6}$/
    Assert: value.entry.status === "pending"
    Assert: value.entry.created_at is a valid ISO 8601 string

  it("adds entry with all optional fields")
    Include --severity high --file-path src/db.ts --line 42 --snippet "query(input)"
    Assert: exitCode === 0, ok === true
    Assert: value.entry.severity === "high"
    Assert: value.entry.file_path === "src/db.ts"
    Assert: value.entry.line === 42
    Assert: value.entry.snippet === "query(input)"

  it("exits 2 when --agent is missing")
    Assert: exitCode === 2
    parseJsonOutput(result.stderr): ok === false, code === "INVALID_ARGS"

  it("exits 2 when --title is missing")
    Assert: exitCode === 2, code === "INVALID_ARGS"

  it("exits 2 when --details is missing")
    Assert: exitCode === 2, code === "INVALID_ARGS"

  it("exits 2 for invalid severity value")
    Include --severity ultra (not in enum)
    Assert: exitCode === 2, code === "INVALID_ARGS"

  it("each call generates a unique id")
    Call add twice with same args
    Assert: both calls succeed
    Assert: returned ids are different
```

---

#### `e2e/tests/list.e2e.test.ts`

```
describe("list")
  it("returns empty entries on cold start (no store file)")
    runCli(["list"], { cwd: testDir })
    Assert: exitCode === 0, ok === true
    Assert: value.entries is an array of length 0

  it("defaults to status:pending")
    Add one pending and one resolved entry
    runCli(["list"], { cwd: testDir })
    Assert: value.entries.length === 1, entry.status === "pending"

  it("--status resolved returns only resolved entries")
    Add one pending, resolve it, add another pending
    runCli(["list", "--status", "resolved"], { cwd: testDir })
    Assert: value.entries.length === 1, entry.status === "resolved"

  it("list entries do not contain details or snippet")
    Add entry with --details "secret details" --snippet "secret snippet"
    runCli(["list"], { cwd: testDir })
    Assert: value.entries[0].details is undefined
    Assert: value.entries[0].snippet is undefined

  it("exits 2 for invalid --status value")
    runCli(["list", "--status", "unknown"], { cwd: testDir })
    Assert: exitCode === 2, code === "INVALID_ARGS"
```

---

#### `e2e/tests/get.e2e.test.ts`

```
describe("get")
  it("returns full entry including details and snippet")
    Add entry with --details "full details" --snippet "code snippet"
    runCli(["get", id], { cwd: testDir })
    Assert: exitCode === 0, ok === true
    Assert: value.entry.details === "full details"
    Assert: value.entry.snippet === "code snippet"

  it("exits 1 with ENTRY_NOT_FOUND for unknown id")
    runCli(["get", "def-19990101-zzzzzz"], { cwd: testDir })
    Assert: exitCode === 1
    parseJsonOutput(result.stderr): ok === false, code === "ENTRY_NOT_FOUND"

  it("exits 2 when id arg is missing")
    runCli(["get"], { cwd: testDir })
    Assert: exitCode === 2, code === "INVALID_ARGS"
```

---

#### `e2e/tests/resolve.e2e.test.ts`

```
describe("resolve")
  it("transitions pending → reviewed")
    Add entry, then resolve with --status reviewed
    Assert: exitCode === 0, ok === true
    Assert: value.entry.status === "reviewed"
    Assert: value.entry.updated_at is set

  it("transitions pending → resolved with note")
    Add entry, resolve with --status resolved --note "Fixed"
    Assert: value.entry.status === "resolved"
    Assert: value.entry.resolution_note === "Fixed"

  it("transitions reviewed → discarded")
    Add, resolve to reviewed, then resolve to discarded
    Assert: value.entry.status === "discarded"

  it("exits 1 with INVALID_STATUS for resolved → reviewed (invalid transition)")
    Add entry, resolve to resolved, then try to resolve to reviewed
    Assert: exitCode === 1
    parseJsonOutput(result.stderr): ok === false, code === "INVALID_STATUS"

  it("exits 1 with INVALID_STATUS for any transition from discarded")
    Add entry, resolve to discarded, then try to resolve to resolved
    Assert: exitCode === 1, code === "INVALID_STATUS"

  it("exits 1 with ENTRY_NOT_FOUND for unknown id")
    runCli(["resolve", "def-19990101-zzzzzz", "--status", "reviewed"], { cwd: testDir })
    Assert: exitCode === 1, code === "ENTRY_NOT_FOUND"

  it("exits 2 when --status is missing")
    Assert: exitCode === 2, code === "INVALID_ARGS"

  it("exits 2 for invalid --status value (e.g. 'pending')")
    runCli(["resolve", id, "--status", "pending"], { cwd: testDir })
    Assert: exitCode === 2, code === "INVALID_ARGS"
    Note: "pending" is a valid status but not a valid transition target in resolve.
```

---

#### `e2e/tests/export.e2e.test.ts`

```
describe("export")
  it("exports pending and reviewed entries to snapshot file")
    Add 2 pending entries, 1 resolved entry
    runCli(["export", "session-2026-04-06"], { cwd: testDir })
    Assert: exitCode === 0, ok === true
    Assert: value.count === 2
    Assert: value.path ends with "session-2026-04-06.json"
    Verify: file exists at testDir + "/.ai/deferred-list-context/session-2026-04-06.json"
    Verify: parsed file.entries.length === 2
    Verify: entries in file have full details (not summary-only)

  it("does not mutate entry statuses after export")
    Add pending entry, export, then list
    Assert: list still returns the entry with status "pending"

  it("exports 0 entries when all entries are resolved/discarded")
    Add entry, resolve it
    runCli(["export", "empty-snapshot"], { cwd: testDir })
    Assert: exitCode === 0, ok === true
    Assert: value.count === 0

  it("exits 0 on cold start with count 0")
    runCli(["export", "cold-start"], { cwd: testDir })
    Assert: exitCode === 0, ok === true, value.count === 0

  it("exits 2 when name is missing")
    Assert: exitCode === 2, code === "INVALID_ARGS"

  it("exits 2 when name contains path traversal")
    runCli(["export", "../../../etc/passwd"], { cwd: testDir })
    Assert: exitCode === 2, code === "INVALID_ARGS"
```

---

#### `e2e/tests/flush.e2e.test.ts`

```
describe("flush")
  it("flushes all entries with --confirm and returns deleted count")
    Add 3 entries
    runCli(["flush", "--confirm"], { cwd: testDir })
    Assert: exitCode === 0, ok === true
    Assert: value.deleted === 3
    Verify: runCli(["list"]) returns value.entries of length 0

  it("returns FLUSH_ABORTED without --confirm")
    Add 1 entry
    runCli(["flush"], { cwd: testDir })
    Assert: exitCode === 1
    parseJsonOutput(result.stderr): ok === false, code === "FLUSH_ABORTED"
    Verify: entry is still present — runCli(["list"]) returns length 1

  it("flush on cold start returns deleted: 0")
    runCli(["flush", "--confirm"], { cwd: testDir })
    Assert: exitCode === 0, ok === true
    Assert: value.deleted === 0

  it("does NOT delete export snapshots")
    Add entry, export it, then flush
    Assert: flush succeeds, value.deleted >= 1
    Verify: snapshot file from export still exists on disk
```

---

#### `e2e/tests/remove.e2e.test.ts`

```
describe("remove")
  it("removes an existing entry and store no longer contains it")
    Add entry, capture id
    runCli(["remove", id], { cwd: testDir })
    Assert: exitCode === 0, ok === true
    Assert: value.id === id
    Verify: runCli(["get", id]) exits 1 with ENTRY_NOT_FOUND

  it("exits 1 with ENTRY_NOT_FOUND for a non-existent id")
    runCli(["remove", "def-19990101-zzzzzz"], { cwd: testDir })
    Assert: exitCode === 1
    parseJsonOutput(result.stderr): ok === false, code === "ENTRY_NOT_FOUND"

  it("removes the last entry, leaving store with entries: []")
    Add 1 entry, then remove it
    Verify: runCli(["list"]) returns value.entries of length 0

  it("store.updated_at is updated after remove")
    Add entry, record time before remove (const before = Date.now())
    runCli(["remove", id], { cwd: testDir })
    Read deferred.json from disk and parse
    Assert: new Date(store.updated_at).getTime() >= before

  it("exits 2 when id arg is missing")
    runCli(["remove"], { cwd: testDir })
    Assert: exitCode === 2, code === "INVALID_ARGS"
```

---

#### `e2e/tests/help.e2e.test.ts`

```
describe("help")
  it("defer-list help exits 0 and prints general usage")
    runCli(["help"], { cwd: testDir })
    Assert: exitCode === 0
    Assert: result.stdout.includes("Usage")
    Assert: result.stdout.includes("defer-list")

  it("defer-list help add exits 0 and prints add-specific usage")
    runCli(["help", "add"], { cwd: testDir })
    Assert: exitCode === 0
    Assert: result.stdout.includes("add")
    Assert: result.stdout.includes("--agent")
    Assert: result.stdout.includes("--title")

  it("defer-list help resolve prints valid status values")
    runCli(["help", "resolve"], { cwd: testDir })
    Assert: exitCode === 0
    Assert: result.stdout.includes("resolve")
    Assert: result.stdout.includes("reviewed")
    Assert: result.stdout.includes("resolved")
    Assert: result.stdout.includes("discarded")

  it("defer-list help unknown-cmd exits non-zero")
    runCli(["help", "xyzzy-nonexistent-cmd"], { cwd: testDir })
    Assert: exitCode !== 0
```

---

## 15. Unit Testing Strategy

### `tests/store/storeManager.test.ts`

- Cold start: `readStore` returns empty store when file absent.
- Round-trip: `writeStore` then `readStore` returns identical data.
- Schema validation: `readStore` returns `PARSE_ERROR` on invalid JSON, `VALIDATION_ERROR` on schema mismatch.
- Locking: concurrent calls to `withLock` queue correctly; second caller waits, not errors.
- Lock timeout: `withLock` returns `LOCK_TIMEOUT` if lock held beyond timeout.
- Directory creation: `writeStore` creates `.ai/deferred-list/` if absent.

### `tests/commands/add.test.ts`

- Returns `{ ok: true, value: { id, entry } }` on valid input.
- ID matches `def-YYYYMMDD-xxxxxx` pattern.
- Entry has `status: "pending"` and a valid `created_at`.
- Returns `INVALID_ARGS` on missing required fields.
- Multiple add calls produce unique IDs.
- Appends to existing entries (does not overwrite).

### `tests/commands/list.test.ts`

- Returns empty array on cold start.
- Filters by status correctly.
- Returns `SummaryEntry` shape — `details` and `snippet` absent.
- Returns `INVALID_ARGS` for invalid status string.

### `tests/commands/get.test.ts`

- Returns full `DeferredEntry` including `details` and `snippet`.
- Returns `ENTRY_NOT_FOUND` for unknown ID.
- Returns `INVALID_ARGS` for empty ID.

### `tests/commands/remove.test.ts`

- Removes entry from store and returns `{ id }`.
- Returns `ENTRY_NOT_FOUND` for unknown ID.
- `store.updated_at` is updated after removal.
- Does not mutate other entries.

### `tests/commands/resolve.test.ts`

- All valid transitions succeed.
- All invalid transitions return `INVALID_STATUS`.
- Terminal states (`resolved`, `discarded`) cannot transition further.
- `updated_at` is set on entry and store on success.
- `resolution_note` is persisted when provided.
- Returns `ENTRY_NOT_FOUND` for unknown ID.

### `tests/commands/export.test.ts`

- Exports only `pending` and `reviewed` entries.
- Snapshot file contains full entries (not summary-only).
- Does not mutate any entry status.
- Returns `count === 0` when nothing to export.
- Returns `INVALID_ARGS` for path-traversal `name`.
- Returns `EXPORT_DIR_ERROR` when directory cannot be created (simulate write permission error).

### `tests/commands/flush.test.ts`

- Returns `FLUSH_ABORTED` when `confirm !== true`.
- Deletes all entries and returns correct `deleted` count.
- After flush, store has `entries: []`.
- Returns `deleted: 0` on cold start / empty store.

---

## 16. Open Questions / Implementation Notes

1. **Repo root detection**: `storeManager.ts` needs a `findRepoRoot` utility (reuse from `cache-ctrl/src/cache/cacheManager.ts` if extractable as a shared module, otherwise re-implement inline).

2. **Lock timeout value**: `cache-ctrl` uses a fixed timeout (check `cacheManager.ts` for the exact value). Use the same default. Consider exporting a `LOCK_TIMEOUT_MS` constant for testability.

3. **`store.updated_at` on read-only commands**: `list`, `get`, and `export` do not set `store.updated_at`. Only `add`, `remove`, `resolve`, and `flush` do. This is intentional.

4. **Concurrent add race**: Two agents calling `add` simultaneously will queue on the lock. The second will see the first's entry in the store before appending. This is the correct behavior — no entries are lost.

5. **Export snapshot schema**: The snapshot file format is intentionally loose — it is for human and agent inspection only, not for schema-validated reads. A suggested format is `{ exported_at: string, count: number, entries: DeferredEntry[] }`. Implementors may add additional metadata.

6. **`remove` vs `resolve(discarded)`**: `remove` is a hard delete for administrative cleanup. Agents should prefer `resolve(discarded)` to maintain an audit trail. Document this distinction in `README.md`.

7. **Line number type in CLI**: CLI args are strings; `--line 42` must be parsed to `number`. Use `parseInt` with base 10 and validate it is a finite positive integer. Invalid values (e.g. `--line "abc"`) should return `INVALID_ARGS`.

8. **`severity` is optional on `list` output**: If an entry was added without `severity`, the `SummaryEntry` will have `severity: undefined`. This is expected and valid — consumers must handle the optional field.
