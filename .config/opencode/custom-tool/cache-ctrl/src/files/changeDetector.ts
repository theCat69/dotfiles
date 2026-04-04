import { readFile, stat } from "node:fs/promises";
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
