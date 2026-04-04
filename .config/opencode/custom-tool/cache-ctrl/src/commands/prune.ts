import { unlink } from "node:fs/promises";
import { findRepoRoot, listCacheFiles, writeCache, readCache } from "../cache/cacheManager.js";
import { isExternalStale } from "../cache/externalCache.js";
import { resolveLocalCachePath } from "../cache/localCache.js";
import { ExternalCacheFileSchema } from "../types/cache.js";
import { ErrorCode, type Result } from "../types/result.js";
import type { PruneArgs, PruneResult } from "../types/commands.js";

export function parseDurationMs(duration: string): number | null {
  const match = /^(\d+)(h|d)$/.exec(duration);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  if (unit === "h") return value * 3_600_000;
  if (unit === "d") return value * 86_400_000;
  return null;
}

export async function pruneCommand(args: PruneArgs): Promise<Result<PruneResult["value"]>> {
  try {
    const repoRoot = await findRepoRoot(process.cwd());
    const agent = args.agent ?? "all";
    const doDelete = args.delete ?? false;
    const matched: string[] = [];

    // Parse maxAge for external (default 24h)
    const externalMaxAgeMs = args.maxAge ? parseDurationMs(args.maxAge) : 24 * 3_600_000;
    if (args.maxAge && externalMaxAgeMs === null) {
      return { ok: false, error: `Invalid duration format: "${args.maxAge}". Use format like "24h" or "7d"`, code: ErrorCode.INVALID_ARGS };
    }

    if (agent === "external" || agent === "all") {
      const filesResult = await listCacheFiles("external", repoRoot);
      if (!filesResult.ok) return filesResult;

      for (const filePath of filesResult.value) {
        const readResult = await readCache(filePath);
        if (!readResult.ok) continue;

        const parseResult = ExternalCacheFileSchema.safeParse(readResult.value);
        if (!parseResult.success) continue;
        const data = parseResult.data;

        if (isExternalStale(data, externalMaxAgeMs ?? undefined)) {
          matched.push(filePath);
          if (doDelete) {
            try {
              await unlink(filePath);
            } catch (err) {
              const error = err as NodeJS.ErrnoException;
              if (error.code !== "ENOENT") {
                return { ok: false, error: `Failed to delete ${filePath}: ${error.message}`, code: ErrorCode.FILE_WRITE_ERROR };
              }
            }
          } else {
            const writeResult = await writeCache(filePath, { fetched_at: "" });
            if (!writeResult.ok) return writeResult;
          }
        }
      }
    }

    if (agent === "local" || agent === "all") {
      // Local always matches (age 0 rule)
      const localPath = resolveLocalCachePath(repoRoot);

      if (doDelete) {
        try {
          await unlink(localPath);
          matched.push(localPath);
        } catch (err) {
          const error = err as NodeJS.ErrnoException;
          if (error.code !== "ENOENT") {
            return { ok: false, error: `Failed to delete ${localPath}: ${error.message}`, code: ErrorCode.FILE_WRITE_ERROR };
          }
          // File didn't exist — nothing pruned, don't add to matched
        }
      } else {
        const writeResult = await writeCache(localPath, { timestamp: "" });
        if (!writeResult.ok) {
          // If local cache doesn't exist, that's fine — nothing to prune
          if (writeResult.code !== ErrorCode.FILE_NOT_FOUND) {
            return writeResult;
          }
        } else {
          matched.push(localPath);
        }
      }
    }

    return {
      ok: true,
      value: {
        matched,
        action: doDelete ? "deleted" : "invalidated",
        count: matched.length,
      },
    };
  } catch (err) {
    const error = err as Error;
    return { ok: false, error: error.message, code: ErrorCode.UNKNOWN };
  }
}
