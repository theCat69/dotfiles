import { findRepoRoot, readCache } from "../cache/cacheManager.js";
import { resolveLocalCachePath } from "../cache/localCache.js";
import { compareTrackedFile } from "../files/changeDetector.js";
import { LocalCacheFileSchema } from "../types/cache.js";
import { ErrorCode, type Result } from "../types/result.js";
import type { CheckFilesResult } from "../types/commands.js";

export async function checkFilesCommand(): Promise<Result<CheckFilesResult["value"]>> {
  try {
    const repoRoot = await findRepoRoot(process.cwd());
    const localPath = resolveLocalCachePath(repoRoot);

    const readResult = await readCache(localPath);
    if (!readResult.ok) return readResult;

    const parseResult = LocalCacheFileSchema.safeParse(readResult.value);
    if (!parseResult.success) {
      return { ok: false, error: `Malformed local cache file: ${localPath}`, code: ErrorCode.PARSE_ERROR };
    }
    const data = parseResult.data;
    const trackedFiles = data.tracked_files;

    if (trackedFiles.length === 0) {
      return {
        ok: true,
        value: {
          status: "unchanged",
          changed_files: [],
          unchanged_files: [],
          missing_files: [],
        },
      };
    }

    const changedFiles: Array<{ path: string; reason: "mtime" | "hash" | "missing" }> = [];
    const unchangedFiles: string[] = [];
    const missingFiles: string[] = [];

    for (const trackedFile of trackedFiles) {
      const result = await compareTrackedFile(trackedFile, repoRoot);
      if (result.status === "unchanged") {
        unchangedFiles.push(trackedFile.path);
      } else if (result.status === "missing") {
        missingFiles.push(trackedFile.path);
        changedFiles.push({ path: trackedFile.path, reason: "missing" });
      } else {
        changedFiles.push({ path: trackedFile.path, reason: result.reason ?? "mtime" });
      }
    }

    return {
      ok: true,
      value: {
        status: changedFiles.length > 0 || missingFiles.length > 0 ? "changed" : "unchanged",
        changed_files: changedFiles,
        unchanged_files: unchangedFiles,
        missing_files: missingFiles,
      },
    };
  } catch (err) {
    const error = err as Error;
    return { ok: false, error: error.message, code: ErrorCode.UNKNOWN };
  }
}
