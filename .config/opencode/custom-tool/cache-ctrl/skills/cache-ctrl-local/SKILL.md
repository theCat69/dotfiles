---
name: cache-ctrl-local
description: How to use cache-ctrl to detect file changes and manage the local context cache
---

# cache-ctrl — Local Cache Usage

The `cache_ctrl_*` plugin tools manage `.ai/local-context-gatherer_cache/context.json`. Use them on every run to avoid redundant full-repo scans.

## Startup Workflow

### 1. Check if tracked files changed

Call `cache_ctrl_check_files` (no parameters).

- `status: "unchanged"` → **skip scanning, return cached context**.
- `status: "changed"` → files have changed, proceed to re-scan.
- `status: "unchanged"` with empty `tracked_files` → cold start (no prior scan), proceed to scan.

Optionally call `cache_ctrl_invalidate` with `agent: "local"` to explicitly mark the entry stale before writing the new one.

### 2. Write cache after scanning

Write the cache file directly via the `edit` tool to `.ai/local-context-gatherer_cache/context.json`. The file MUST include:

```jsonc
{
  "timestamp": "<ISO 8601 now>",
  "topic": "<description of what was scanned>",
  "description": "<one-line summary>",  // required for cache_ctrl_search
  "tracked_files": [
    {
      "path": "<repo-relative or absolute path>",
      "mtime": 1743768000000,             // Date.getTime() in milliseconds
      "hash": "<sha256 hex>"              // strongly recommended
    }
  ]
}
```

**`tracked_files` is mandatory.** Without it, `cache_ctrl_check_files` cannot detect future changes and will always report `unchanged`. Every file read during the scan MUST be recorded here.

### 3. Confirm cache (optional)

Call `cache_ctrl_list` with `agent: "local"` to confirm the entry was written. Note: local entries always show `is_stale: true` in list output — this is expected by design. Use `cache_ctrl_check_files` for authoritative change detection, not `list`.

## Tool Reference

| Tool | When to use |
|---|---|
| `cache_ctrl_check_files` | Startup: detect if any tracked file changed |
| `cache_ctrl_invalidate` | Mark current cache stale before writing a new one |
| `cache_ctrl_list` | Confirm entry exists after writing |
| `cache_ctrl_inspect` | Debug: view full content of the local cache entry |

## Cache Location

`.ai/local-context-gatherer_cache/context.json` — single file, no per-subject splitting.

No time-based TTL. Freshness is determined entirely by `cache_ctrl_check_files`.
