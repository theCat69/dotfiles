---
name: cache-ctrl-local
description: How to use cache-ctrl to detect file changes and manage the local context cache
---

# cache-ctrl — Local Cache Usage

Manage `.ai/local-context-gatherer_cache/context.json` to avoid redundant full-repo scans.
Three tiers of access — use the best one available.

## Availability Detection (run once at startup)

1. Call `cache_ctrl_check_files` (built-in tool).
   - Success → **use Tier 1** for all operations below.
   - Failure (tool not found / permission denied) → continue to step 2.
2. Run `bash: "which cache-ctrl"`.
   - Exit 0 → **use Tier 2** for all operations below.
   - Not found → **use Tier 3** for all operations below.

---

## Startup Workflow

### 1. Check if tracked files changed

**Tier 1:** Call `cache_ctrl_check_files` (no parameters).
**Tier 2:** `cache-ctrl check-files`
**Tier 3:** `read` `.ai/local-context-gatherer_cache/context.json`.
  - File absent → cold start, proceed to scan.
  - File present → check `timestamp`. If older than 1 hour, treat as stale and re-scan. Otherwise treat as fresh.

Result interpretation (Tier 1 & 2):
- `status: "unchanged"` → **skip scanning, return cached context**.
- `status: "changed"` → files changed, proceed to re-scan.
- `status: "unchanged"` with empty `tracked_files` → cold start, proceed to scan.

> **⚠ Cache is non-exhaustive**: The cached file list only covers files that were tracked during the last scan. New files added to the repository, or files deleted, since the last scan are NOT detected by the cache check — `status: "unchanged"` only confirms tracked files are content-stable. Callers must use `glob`/`grep` for comprehensive file discovery and must not assume the cached file list is complete.

### 2. Invalidate before writing (optional)

**Tier 1:** Call `cache_ctrl_invalidate` with `agent: "local"`.
**Tier 2:** `cache-ctrl invalidate local`
**Tier 3:** Skip — overwriting the file in step 3 is sufficient.

### 3. Write cache after scanning

**Always use the write tool/command — never write cache files directly via `edit`.** Direct writes bypass schema validation and can silently corrupt the cache format.

**Tier 1:** Call `cache_ctrl_write` with:
```json
{
  "agent": "local",
  "content": {
    "topic": "<description of what was scanned>",
    "description": "<one-liner summary>",
    "tracked_files": [
      { "path": "<repo-relative or absolute path>", "mtime": 1743768000000, "hash": "<sha256-hex>" }
    ]
  }
}
```

> **`timestamp` is auto-set** by the write command to the current UTC time. Do not include it in `content` — any value provided is silently overridden.

**Tier 2:** `cache-ctrl write local --data '<json>'`

**Tier 3:** Same as Tier 2 — there is no direct-file fallback for writes. If neither Tier 1 nor Tier 2 is available, request access to one of them.

#### LocalCacheFile schema

All fields are validated on write. Unknown extra fields are allowed and preserved.

| Field | Type | Required | Notes |
|---|---|---|---|
| `timestamp` | `string` | ➕ auto-set | Set automatically by write command to current UTC time. Do not pass from calling agent |
| `topic` | `string` | ✅ | Human description of what was scanned |
| `description` | `string` | ✅ | One-liner for keyword search |
| `cache_miss_reason` | `string` | ➕ optional | Why the previous cache was discarded |
| `tracked_files` | `Array<{ path: string; mtime: number; hash?: string }>` | ✅ | **Mandatory** for `check-files` to work. `mtime` is Unix ms (`Date.getTime()`). `hash` is SHA-256 hex |
| *(any other fields)* | `unknown` | ➕ optional | Preserved unchanged |

**Minimal valid agent-supplied content** (what you pass to `cache_ctrl_write`):
```json
{
  "topic": "neovim plugin configuration scan",
  "description": "Full scan of lua/plugins tree for neovim lazy.nvim setup",
  "tracked_files": [
    { "path": "lua/plugins/ui/bufferline.lua", "mtime": 1743768000000, "hash": "a1b2c3..." }
  ]
}
```

The file written to disk will also include `"timestamp": "<current UTC ISO string>"` injected by the write command.

### 4. Confirm cache (optional)

**Tier 1:** Call `cache_ctrl_list` with `agent: "local"` to confirm the entry was written.
**Tier 2:** `cache-ctrl list --agent local`
**Tier 3:** `read` `.ai/local-context-gatherer_cache/context.json` and verify `timestamp` is current.

Note: local entries always show `is_stale: true` in Tier 1/2 list output — this is expected. Use `cache_ctrl_check_files` (Tier 1/2) or timestamp comparison (Tier 3) for authoritative change detection.

---

## Tool / Command Reference

| Operation | Tier 1 (built-in) | Tier 2 (CLI) | Tier 3 (manual) |
|---|---|---|---|
| Detect file changes | `cache_ctrl_check_files` | `cache-ctrl check-files` | read `context.json`, check `timestamp` |
| Invalidate cache | `cache_ctrl_invalidate` | `cache-ctrl invalidate local` | overwrite file in next step |
| Confirm written | `cache_ctrl_list` | `cache-ctrl list --agent local` | `read` file, check `timestamp` |
| View full entry | `cache_ctrl_inspect` | `cache-ctrl inspect local context` | `read` file directly |
| Write cache | `cache_ctrl_write` | `cache-ctrl write local --data '<json>'` | ❌ not available |

## Cache Location

`.ai/local-context-gatherer_cache/context.json` — single file, no per-subject splitting.

No time-based TTL for Tier 1/2. Freshness determined by `cache_ctrl_check_files`.
Tier 3 uses a 1-hour `timestamp` TTL as a rough proxy.
