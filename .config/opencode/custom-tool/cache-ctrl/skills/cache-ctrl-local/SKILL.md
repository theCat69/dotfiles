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

### 2. Invalidate before writing (optional)

**Tier 1:** Call `cache_ctrl_invalidate` with `agent: "local"`.
**Tier 2:** `cache-ctrl invalidate local`
**Tier 3:** Skip — overwriting the file in step 3 is sufficient.

### 3. Write cache after scanning

Write the cache file directly via the `edit` tool to `.ai/local-context-gatherer_cache/context.json`.
All tiers write the same JSON schema:

```jsonc
{
  "timestamp": "<ISO 8601 now>",
  "topic": "<description of what was scanned>",
  "description": "<one-line summary>",
  "tracked_files": [
    {
      "path": "<repo-relative or absolute path>",
      "mtime": 1743768000000,             // Date.getTime() in milliseconds
      "hash": "<sha256 hex>"              // strongly recommended
    }
  ]
}
```

**`tracked_files` is mandatory** for Tier 1/2 change detection. Every file read during the scan MUST be recorded here. Tier 3 relies on `timestamp` instead, so `tracked_files` is still recommended but detection precision is lower.

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

## Cache Location

`.ai/local-context-gatherer_cache/context.json` — single file, no per-subject splitting.

No time-based TTL for Tier 1/2. Freshness determined by `cache_ctrl_check_files`.
Tier 3 uses a 1-hour `timestamp` TTL as a rough proxy.
