import { join } from "node:path";
import type { TrackedFile } from "../types/cache.js";

export { TrackedFile };

export function resolveLocalCacheDir(repoRoot: string): string {
  return join(repoRoot, ".ai", "local-context-gatherer_cache");
}

export function resolveLocalCachePath(repoRoot: string): string {
  return join(resolveLocalCacheDir(repoRoot), "context.json");
}

export function buildTrackedFilesIndex(trackedFiles: TrackedFile[]): Map<string, TrackedFile> {
  const index = new Map<string, TrackedFile>();
  for (const file of trackedFiles) {
    index.set(file.path, file);
  }
  return index;
}
