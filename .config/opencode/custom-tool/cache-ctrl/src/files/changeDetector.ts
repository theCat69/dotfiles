import { readFile, stat, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, isAbsolute } from "node:path";
import type { TrackedFile } from "../types/cache.js";

export interface FileComparisonResult {
  path: string;
  status: "changed" | "unchanged" | "missing";
  reason?: "mtime" | "hash" | "missing";
}

export async function compareTrackedFile(file: TrackedFile, repoRoot: string): Promise<FileComparisonResult> {
  const absolutePath = resolveTrackedFilePath(file.path, repoRoot);

  if (absolutePath === null) {
    // Path traversal attempt — treat as missing
    return { path: file.path, status: "missing", reason: "missing" };
  }

  try {
    const fileStat = await stat(absolutePath);
    const currentMtime = fileStat.mtimeMs;

    if (currentMtime === file.mtime) {
      return { path: file.path, status: "unchanged" };
    }

    // mtime differs
    if (file.hash) {
      const currentHash = await computeFileHash(absolutePath);
      if (currentHash === file.hash) {
        // Hash matches despite mtime change — just a touch
        return { path: file.path, status: "unchanged" };
      }
      return { path: file.path, status: "changed", reason: "hash" };
    }

    // No hash stored — mtime change alone is sufficient
    return { path: file.path, status: "changed", reason: "mtime" };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      return { path: file.path, status: "missing", reason: "missing" };
    }
    // Re-throw unexpected errors
    throw err;
  }
}

export async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Resolves a tracked file path against the repo root.
 * Returns null if the resolved path escapes the repo root (path traversal guard).
 */
export function resolveTrackedFilePath(inputPath: string, repoRoot: string): string | null {
  const resolved = isAbsolute(inputPath) ? resolve(inputPath) : resolve(repoRoot, inputPath);
  // Normalize root to ensure trailing slash for prefix matching
  const normalizedRoot = repoRoot.endsWith("/") ? repoRoot : repoRoot + "/";
  if (!resolved.startsWith(normalizedRoot) && resolved !== repoRoot) {
    return null; // path traversal rejected
  }
  return resolved;
}

/**
 * Resolves real mtimes from the filesystem for a list of tracked file entries.
 * For each entry: if the path is valid and the file exists, injects the real mtimeMs.
 * Falls back to the provided mtime (or 0) on path traversal rejection or missing file.
 * Never throws — always returns gracefully.
 */
export async function resolveTrackedFileMtimes(
  files: Array<{ path: string; mtime?: number; hash?: string }>,
  repoRoot: string,
): Promise<TrackedFile[]> {
  return Promise.all(
    files.map(async (file) => {
      const absolutePath = resolveTrackedFilePath(file.path, repoRoot);
      if (absolutePath === null) {
        return { path: file.path, mtime: file.mtime ?? 0, ...(file.hash !== undefined ? { hash: file.hash } : {}) };
      }
      try {
        const fileStat = await lstat(absolutePath);
        return { path: file.path, mtime: fileStat.mtimeMs, ...(file.hash !== undefined ? { hash: file.hash } : {}) };
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code !== "ENOENT") throw err;
        return { path: file.path, mtime: file.mtime ?? 0, ...(file.hash !== undefined ? { hash: file.hash } : {}) };
      }
    }),
  );
}
