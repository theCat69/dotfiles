---
name: cache-ctrl-external
description: How to use cache-ctrl to check staleness, search, and manage the external context cache
---

# cache-ctrl — External Cache Usage

The `cache_ctrl_*` plugin tools manage `.ai/external-context-gatherer_cache/`. Use them on every run to avoid redundant HTTP fetches.

## Startup Workflow

### 1. Check freshness before fetching

Call `cache_ctrl_list` with `agent: "external"`.

- `is_stale: false` for the target subject → **skip fetching, return cached content**.
- `is_stale: true` OR subject absent → proceed to fetch.

For borderline cases (entry exists but recently turned stale), call `cache_ctrl_check_freshness` with the subject keyword:
- `overall: "fresh"` → skip fetch.
- `overall: "stale"` or `"error"` → proceed to fetch.

### 2. Search before creating a new subject

Before fetching a brand-new subject, call `cache_ctrl_search` with relevant keywords. Related info may already be cached under a different subject name.

### 3. Write cache after fetching

Write the cache file directly via the `edit` tool to `.ai/external-context-gatherer_cache/<subject>.json`. The file MUST include:

```jsonc
{
  "subject": "<subject>",              // must match the file stem
  "description": "<one-line summary>", // required for cache_ctrl_search
  "fetched_at": "<ISO 8601 now>",
  "sources": [
    { "type": "<type>", "url": "<canonical-url>" }
  ],
  "header_metadata": {}                // empty map is fine on first write
}
```

Do **not** call any cache-ctrl tool after writing — the direct write with a fresh `fetched_at` is sufficient.

### 4. Force a re-fetch

To mark an entry stale (without deleting its content): call `cache_ctrl_invalidate` with `agent: "external"` and the subject keyword.

## Tool Reference

| Tool | When to use |
|---|---|
| `cache_ctrl_list` | Startup: check freshness of all external entries |
| `cache_ctrl_check_freshness` | HTTP HEAD check for a borderline-stale entry |
| `cache_ctrl_search` | Find related entries before fetching a new subject |
| `cache_ctrl_inspect` | Debug: view full content of a specific entry |
| `cache_ctrl_invalidate` | Mark an entry stale to force a re-fetch on next run |

## Cache Location

`.ai/external-context-gatherer_cache/<subject>.json` — one file per subject.

Staleness threshold: `fetched_at` is empty **or** older than 24 hours.
