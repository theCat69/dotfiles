---
name: cache-ctrl-caller
description: How orchestrating/primary agents use cache-ctrl to decide whether to call gatherer subagents and to control cache invalidation
---

# cache-ctrl — Caller Usage

For orchestrating or primary agents that call **local-context-gatherer** and **external-context-gatherer** subagents.

The cache avoids expensive subagent calls when their data is already fresh.
Use `cache_ctrl_*` tools directly for all status checks — **never spawn a subagent just to check cache state**.

---

## Availability Detection (run once at startup)

1. Call `cache_ctrl_list` (built-in tool).
   - Success → **use Tier 1** for all operations.
   - Failure (tool not found / permission denied) → try step 2.
2. Run `bash: "which cache-ctrl"`.
   - Exit 0 → **use Tier 2** for all operations.
   - Not found → **use Tier 3** for all operations.

---

## Before Calling local-context-gatherer

Check whether tracked repo files have changed since the last scan.

**Tier 1:** Call `cache_ctrl_check_files`.
**Tier 2:** `cache-ctrl check-files`
**Tier 3:** `read` `.ai/local-context-gatherer_cache/context.json`.
  - File absent → cold start, proceed to call the gatherer.
  - File present → if `timestamp` is empty or older than 1 hour → stale, call the gatherer.

| Result | Action |
|---|---|
| `status: "unchanged"` | Context is still valid. Skip calling local-context-gatherer, or pass a cache-fresh hint in the task prompt. |
| `status: "changed"` | Files changed. Call local-context-gatherer to re-scan. |
| File absent / `status: "unchanged"` with empty `tracked_files` | Cold start. Call local-context-gatherer. |

> **ℹ New/deleted file detection**: `check-files` now returns `new_git_files` and `deleted_git_files` (`string[]`). If either is non-empty, `status` is set to `"changed"`. `new_git_files` lists git-tracked files not yet in `tracked_files`; `deleted_git_files` lists git-tracked files removed from the working tree. Both fields are `[]` when git is unavailable or the directory is not a git repo.

To **force a full re-scan** (e.g. user just made significant changes):
**Tier 1:** Call `cache_ctrl_invalidate` with `agent: "local"`.
**Tier 2:** `cache-ctrl invalidate local`

---

## Before Calling external-context-gatherer

Check whether external docs for a given subject are already cached and fresh.

### Step 1 — List external entries

**Tier 1:** Call `cache_ctrl_list` with `agent: "external"`.
**Tier 2:** `cache-ctrl list --agent external`
**Tier 3:** `glob` `.ai/external-context-gatherer_cache/*.json` → for each file, `read` and check `fetched_at` (stale if empty or older than 24 hours).

### Step 2 — Search for a matching subject

If entries exist, check whether one already covers the topic:

**Tier 1:** Call `cache_ctrl_search` with relevant keywords.
**Tier 2:** `cache-ctrl search <keyword> [<keyword>...]`
**Tier 3:** Scan `subject` and `description` fields in the listed files.

### Step 3 — Decide

| Cache state | Action |
|---|---|
| Fresh entry found | Skip calling external-context-gatherer. Optionally `cache_ctrl_inspect` to read its summary for the prompt. |
| Entry stale or absent | Call external-context-gatherer with the subject. |
| Borderline (recently stale) | Call `cache_ctrl_check_freshness` (Tier 1) or `cache-ctrl check-freshness <subject>` (Tier 2). Fresh → skip; stale → call gatherer. |

To **force a re-fetch** for a specific subject:
**Tier 1:** Call `cache_ctrl_invalidate` with `agent: "external"` and the subject keyword.
**Tier 2:** `cache-ctrl invalidate external <subject>`

---

## Reading a Full Cache Entry

Use when you want to pass a cached summary to a subagent or include it inline in a prompt.

**Tier 1:** Call `cache_ctrl_inspect` with `agent` and `subject`.
**Tier 2:** `cache-ctrl inspect external <subject>` or `cache-ctrl inspect local context`
**Tier 3:** `read` the file directly from `.ai/<agent>_cache/<subject>.json`.

---

## Quick Reference

| Operation | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Check local freshness | `cache_ctrl_check_files` | `cache-ctrl check-files` | read context.json, check timestamp |
| List external entries | `cache_ctrl_list` (agent: "external") | `cache-ctrl list --agent external` | glob + read each JSON |
| Search entries | `cache_ctrl_search` | `cache-ctrl search <kw>...` | scan subject/description fields |
| Read full entry | `cache_ctrl_inspect` | `cache-ctrl inspect <agent> <subject>` | read file directly |
| Invalidate local | `cache_ctrl_invalidate` (agent: "local") | `cache-ctrl invalidate local` | delete or overwrite file |
| Invalidate external | `cache_ctrl_invalidate` (agent: "external", subject) | `cache-ctrl invalidate external <subject>` | set `fetched_at` to `""` via edit |
| HTTP freshness check | `cache_ctrl_check_freshness` | `cache-ctrl check-freshness <subject>` | compare `fetched_at` with now |

---

## Anti-Bloat Rules

- Use `cache_ctrl_list` and `cache_ctrl_invalidate` **directly** — do NOT spawn local-context-gatherer or external-context-gatherer just to read cache state.
- Require subagents to return **≤ 500 token summaries** — never let raw context dump into chat.
- Use `cache_ctrl_inspect` to read only the entries you actually need.
- Cache entries are the source of truth. Prefer them over re-fetching.

---

## server_time in Responses

Every `cache_ctrl_*` tool call returns a `server_time` field at the outer JSON level:

```json
{ "ok": true, "value": { ... }, "server_time": "2026-04-05T12:34:56.789Z" }
```

Use `server_time` when making cache freshness decisions — compare it against stored `fetched_at` or `timestamp` values to determine staleness without requiring bash or system access to get the current time.
