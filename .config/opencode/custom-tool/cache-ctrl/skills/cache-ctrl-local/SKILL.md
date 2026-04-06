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
- `status: "unchanged"` → tracked files are content-stable; skip re-scan and return cached context.
- `status: "changed"` → at least one tracked file changed; proceed to **delta scan** (read content of `changed_files` + `new_files` only — do not re-read unchanged files).
- `status: "unchanged"` with empty `tracked_files` → cold start, proceed to scan.

The response also reports:
- `new_files` — untracked non-ignored files absent from cache, plus git-tracked files absent from cache when the cache is non-empty (blank-slate caches skip git-tracked files to avoid false positives on cold start)
- `deleted_git_files` — git-tracked files deleted from the working tree (reported by `git ls-files --deleted`)

> **⚠ Cache is non-exhaustive**: `status: "unchanged"` only confirms that previously-tracked files are content-stable — it does not mean the file set is complete. Always check `new_files` and `deleted_git_files` in the response; if either is non-empty, include those paths in the next write to keep the cache up to date.

### 2. Invalidate before writing (optional)

> Do this only if cache is really outdated and a full rescan is needed. Otherwise just proceed with next step (writing).

**Tier 1:** Call `cache_ctrl_invalidate` with `agent: "local"`.
**Tier 2:** `cache-ctrl invalidate local`
**Tier 3:** Skip — overwriting the file in step 3 is sufficient.

### 3. Write cache after scanning

**Always use the write tool/command — never edit the file directly.** Direct writes bypass schema validation and can silently corrupt the cache format.

> **Write is per-path merge**: Submitted `tracked_files` entries replace existing entries for the same paths. Paths not in the submission are preserved. Entries for files deleted from disk are evicted automatically (no agent action needed).

#### Input fields (`content` object)

| Field | Type | Required | Notes |
|---|---|---|---|
| `topic` | `string` | ✅ | Human description of what was scanned |
| `description` | `string` | ✅ | One-liner for keyword search |
| `tracked_files` | `Array<{ path: string }>` | ✅ | Paths to track; `mtime` and `hash` are auto-computed by the tool |
| `global_facts` | `string[]` | optional | Repo-level facts; last-write-wins; see trigger rule below |
| `facts` | `Record<string, string[]>` | optional | Per-file facts keyed by path; per-path merge |
| `cache_miss_reason` | `string` | optional | Why the previous cache was discarded |

> **Cold start vs incremental**: On first run (no existing cache), submit all relevant files. On subsequent runs, submit only new and changed files — the tool merges them in.

> **Auto-set by the tool — do not include**: `timestamp` (current UTC), `mtime` (filesystem `lstat()`), and `hash` (SHA-256) per `tracked_files` entry.

### Scope rule for `facts`

Submit `facts` ONLY for files you actually read in this session (i.e., files present in
your submitted `tracked_files`). Never reconstruct or re-submit facts for unchanged files —
the tool preserves them automatically via per-path merge.

Submitting a facts key for a path absent from submitted `tracked_files` is a
VALIDATION_ERROR and the entire write is rejected.

### When to submit `global_facts`

Submit `global_facts` only when you re-read at least one structural file in this session:
AGENTS.md, install.sh, opencode.json, package.json, *.toml config files.

If none of those are in `changed_files` or `new_files`, omit `global_facts` from the write.
The existing value is preserved automatically.

### Eviction

Facts for files deleted from disk are evicted automatically on the next write — no agent
action needed. `global_facts` is never evicted.

#### Tier 1 — `cache_ctrl_write`

```json
{
  "agent": "local",
  "content": {
    "topic": "neovim plugin configuration scan",
    "description": "Full scan of lua/plugins tree for neovim lazy.nvim setup",
    "tracked_files": [
      { "path": "lua/plugins/ui/bufferline.lua" },
      { "path": "lua/plugins/lsp/nvim-lspconfig.lua" }
    ]
  }
}
```

#### Tier 2 — CLI

`cache-ctrl write local --data '<json>'` — pass the same `content` object as JSON string.

#### Tier 3

Not available — there is no direct-file fallback for writes. If neither Tier 1 nor Tier 2 is accessible, request access to one of them.

### 4. Confirm cache (optional)

**Tier 1:** Call `cache_ctrl_list` with `agent: "local"` to confirm the entry was written.
**Tier 2:** `cache-ctrl list --agent local`
**Tier 3:** `read` `.ai/local-context-gatherer_cache/context.json` and verify `timestamp` is current.

Note: local entries show `is_stale: true` only when `cache_ctrl_check_files` detects actual changes (changed files, new non-ignored files, or deleted files). A freshly-written cache with no subsequent file changes will show `is_stale: false`.

---

## Tool / Command Reference

| Operation | Tier 1 (built-in) | Tier 2 (CLI) | Tier 3 (manual) |
|---|---|---|---|
| Detect file changes | `cache_ctrl_check_files` | `cache-ctrl check-files` | read `context.json`, check `timestamp` |
| Invalidate cache | `cache_ctrl_invalidate` | `cache-ctrl invalidate local` | overwrite file in next step |
| Confirm written | `cache_ctrl_list` | `cache-ctrl list --agent local` | `read` file, check `timestamp` |
| View full entry | `cache_ctrl_inspect` | `cache-ctrl inspect local context` | `read` file directly |
| Write cache | `cache_ctrl_write` | `cache-ctrl write local --data '<json>'` | ❌ not available |

## server_time in Responses

Every `cache_ctrl_*` tool call returns a `server_time` field at the outer JSON level:

```json
{ "ok": true, "value": { ... }, "server_time": "2026-04-05T12:34:56.789Z" }
```

Use this to assess how stale stored timestamps are — you do not need `bash` or system access to know the current time.

## Cache Location

`.ai/local-context-gatherer_cache/context.json` — single file, no per-subject splitting.

No time-based TTL for Tier 1/2. Freshness determined by `cache_ctrl_check_files`.
Tier 3 uses a 1-hour `timestamp` TTL as a rough proxy.
