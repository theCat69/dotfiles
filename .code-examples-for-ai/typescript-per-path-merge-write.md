# Per-path merge write pattern

Demonstrates incremental merge of a keyed array (tracked_files) during a cache write:
read existing → filter out submitted paths → evict deleted files → merge → write-replace.

```typescript
// 1. Resolve stats for submitted entries; filter out missing files (mtime === 0 → evicted)
const resolved = await resolveTrackedFileStats(validEntries, repoRoot);
const survivingSubmitted = resolved.filter((f) => f.mtime !== 0);

// 2. Read existing cache (cold start → empty baseline)
const readResult = await readCache(filePath);
let existingContent: Record<string, unknown> = {};
let existingTrackedFiles: TrackedFile[] = [];
if (readResult.ok) {
  existingContent = readResult.value;
  existingTrackedFiles = Array.isArray(existingContent["tracked_files"])
    ? (existingContent["tracked_files"] as TrackedFile[])
    : [];
} else if (readResult.code !== ErrorCode.FILE_NOT_FOUND) {
  return { ok: false, error: readResult.error, code: readResult.code };
}

// 3. Keep existing entries not being replaced, then evict deleted files from them
const submittedPaths = new Set(survivingSubmitted.map((f) => f.path));
const existingNotSubmitted = existingTrackedFiles.filter((f) => !submittedPaths.has(f.path));
const survivingExisting = await filterExistingFiles(existingNotSubmitted, repoRoot);

// 4. Merge: existing surviving + new/updated submitted; top-level fields: existing base → submitted wins
const mergedTrackedFiles = [...survivingExisting, ...survivingSubmitted];
const processedContent: Record<string, unknown> = {
  ...existingContent,
  ...contentWithTimestamp,
  tracked_files: mergedTrackedFiles,
};

// 5. Write merged result atomically (replace mode — content is already fully merged above)
await writeCache(filePath, processedContent, "replace");
```

Key points:
- `filterExistingFiles` is a pure existence check (lstat only) — does NOT recompute mtime/hash
- `mtime === 0` sentinel from `resolveTrackedFileStats` signals missing/path-traversal-rejected files
- Top-level field merge uses spread: existing provides defaults, submitted wins on overlap
- Write mode is `"replace"` because the merge was done explicitly in application code
