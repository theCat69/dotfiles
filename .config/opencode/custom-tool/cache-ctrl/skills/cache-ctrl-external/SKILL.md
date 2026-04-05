---
name: cache-ctrl-external
description: How to use cache-ctrl to check staleness, search, and manage the external context cache
---

# cache-ctrl — External Cache Usage

Manage `.ai/external-context-gatherer_cache/` to avoid redundant HTTP fetches.
Three tiers of access — use the best one available.

## Availability Detection (run once at startup)

1. Call `cache_ctrl_list` (built-in tool).
   - Success → **use Tier 1** for all operations below.
   - Failure (tool not found / permission denied) → continue to step 2.
2. Run `bash: "which cache-ctrl"`.
   - Exit 0 → **use Tier 2** for all operations below.
   - Not found → **use Tier 3** for all operations below.

---

## Startup Workflow

### 1. Check freshness before fetching

**Tier 1:** Call `cache_ctrl_list` with `agent: "external"`.
**Tier 2:** `cache-ctrl list --agent external`
**Tier 3:** `glob` `.ai/external-context-gatherer_cache/*.json` → for each match, `read` the file and check `fetched_at`. Stale if `fetched_at` is empty or older than 24 hours.

- Entry for target subject is fresh → **skip fetching, return cached content**.
- Entry is stale or absent → proceed to step 2.

For borderline cases (entry recently turned stale):

**Tier 1:** Call `cache_ctrl_check_freshness` with the subject keyword.
**Tier 2:** `cache-ctrl check-freshness <subject-keyword>`
**Tier 3:** Re-read the file and compare `fetched_at` with current time. If within the last hour, treat as fresh.

- `overall: "fresh"` (Tier 1/2) or fresh by timestamp (Tier 3) → skip fetch.
- `overall: "stale"` / `"error"` or stale by timestamp → proceed to fetch.

### 2. Search before creating a new subject

Before fetching a brand-new subject, check whether related info is already cached.

**Tier 1:** Call `cache_ctrl_search` with relevant keywords.
**Tier 2:** `cache-ctrl search <keyword> [<keyword>...]`
**Tier 3:** `glob` `.ai/external-context-gatherer_cache/*.json` → `read` each file, scan the `subject` and `description` fields for keyword matches.

### 3. Write cache after fetching

Write the cache file directly via the `edit` tool to `.ai/external-context-gatherer_cache/<subject>.json`.
All tiers write the same JSON schema:

```jsonc
{
  "subject": "<subject>",              // must match the file stem
  "description": "<one-line summary>", // required for search
  "fetched_at": "<ISO 8601 now>",
  "sources": [
    { "type": "<type>", "url": "<canonical-url>" }
  ],
  "header_metadata": {}                // empty map is fine on first write
}
```

No tool call needed after writing — the fresh `fetched_at` is sufficient.

### 4. Force a re-fetch

**Tier 1:** Call `cache_ctrl_invalidate` with `agent: "external"` and the subject keyword.
**Tier 2:** `cache-ctrl invalidate external <subject-keyword>`
**Tier 3:** `read` the file, set `fetched_at` to `""`, `edit` it back.

---

## Tool / Command Reference

| Operation | Tier 1 (built-in) | Tier 2 (CLI) | Tier 3 (manual) |
|---|---|---|---|
| List entries | `cache_ctrl_list` | `cache-ctrl list --agent external` | `glob` + `read` each JSON |
| HTTP freshness check | `cache_ctrl_check_freshness` | `cache-ctrl check-freshness <subject>` | compare `fetched_at` with now |
| Search entries | `cache_ctrl_search` | `cache-ctrl search <kw>...` | `glob` + scan `subject`/`description` |
| View full entry | `cache_ctrl_inspect` | `cache-ctrl inspect external <subject>` | `read` file directly |
| Invalidate entry | `cache_ctrl_invalidate` | `cache-ctrl invalidate external <subject>` | set `fetched_at` to `""` via `edit` |

## Cache Location

`.ai/external-context-gatherer_cache/<subject>.json` — one file per subject.

Staleness threshold: `fetched_at` is empty **or** older than 24 hours.
