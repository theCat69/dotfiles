import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import type { ExternalCacheFile } from "../types/cache.js";
import { ErrorCode, type Result } from "../types/result.js";

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function resolveExternalCacheDir(repoRoot: string): string {
  return join(repoRoot, ".ai", "external-context-gatherer_cache");
}

export async function resolveExternalFiles(repoRoot: string): Promise<Result<string[]>> {
  const cacheDir = resolveExternalCacheDir(repoRoot);
  try {
    const entries = await readdir(cacheDir);
    return {
      ok: true,
      value: entries
        .filter((name) => name.endsWith(".json") && !name.endsWith(".lock"))
        .map((name) => join(cacheDir, name)),
    };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      return { ok: true, value: [] };
    }
    return { ok: false, error: `Failed to list external cache directory: ${error.message}`, code: ErrorCode.FILE_READ_ERROR };
  }
}

export function isExternalStale(entry: ExternalCacheFile, maxAgeMs?: number): boolean {
  if (!entry.fetched_at) return true;
  const threshold = maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const age = Date.now() - new Date(entry.fetched_at).getTime();
  return age > threshold;
}

export interface HeaderMeta {
  etag?: string;
  last_modified?: string;
  checked_at: string;
  status: "fresh" | "stale" | "unchecked";
}

export function mergeHeaderMetadata(
  existing: ExternalCacheFile,
  updates: Record<string, HeaderMeta>,
): ExternalCacheFile {
  return {
    ...existing,
    header_metadata: {
      ...existing.header_metadata,
      ...updates,
    },
  };
}

export function getAgeHuman(fetchedAt: string): string {
  if (!fetchedAt) return "invalidated";

  const now = Date.now();
  const fetched = new Date(fetchedAt).getTime();
  const diffMs = now - fetched;

  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (days >= 1) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (hours >= 1) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (minutes >= 1) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  return "just now";
}

export function getFileStem(filePath: string): string {
  const name = basename(filePath);
  return name.endsWith(".json") ? name.slice(0, -5) : name;
}
