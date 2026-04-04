import { findRepoRoot, listCacheFiles, writeCache, readCache } from "../cache/cacheManager.js";
import { getFileStem } from "../cache/externalCache.js";
import { resolveLocalCachePath } from "../cache/localCache.js";
import { scoreEntry } from "../search/keywordSearch.js";
import type { CacheEntry } from "../types/cache.js";
import { ExternalCacheFileSchema } from "../types/cache.js";
import { ErrorCode, type Result } from "../types/result.js";
import type { InvalidateArgs, InvalidateResult } from "../types/commands.js";

export async function invalidateCommand(args: InvalidateArgs): Promise<Result<InvalidateResult["value"]>> {
  try {
    const repoRoot = await findRepoRoot(process.cwd());
    const invalidated: string[] = [];

    if (args.agent === "external") {
      const filesResult = await listCacheFiles("external", repoRoot);
      if (!filesResult.ok) return filesResult;

      let filesToInvalidate: string[];

      if (args.subject) {
        // Find best match
        const candidates: Array<{ filePath: string; entry: CacheEntry }> = [];
        for (const filePath of filesResult.value) {
          const readResult = await readCache(filePath);
          if (!readResult.ok) continue;
          const parseResult = ExternalCacheFileSchema.safeParse(readResult.value);
          if (!parseResult.success) continue;
          const data = parseResult.data;
          const stem = getFileStem(filePath);
          const subject = data.subject ?? stem;
          candidates.push({
            filePath,
            entry: {
              file: filePath,
              agent: "external",
              subject,
              description: data.description,
              fetched_at: data.fetched_at ?? "",
            },
          });
        }

        const keywords = [args.subject];
        const scored = candidates
          .map((c) => ({ ...c, score: scoreEntry(c.entry, keywords) }))
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
          return { ok: false, error: `No cache entry matched keyword "${args.subject}"`, code: ErrorCode.NO_MATCH };
        }

        filesToInvalidate = [scored[0]!.filePath];
      } else {
        filesToInvalidate = filesResult.value;
      }

      for (const filePath of filesToInvalidate) {
        const writeResult = await writeCache(filePath, { fetched_at: "" });
        if (!writeResult.ok) return writeResult;
        invalidated.push(filePath);
      }
    } else {
      // local
      const localPath = resolveLocalCachePath(repoRoot);
      const writeResult = await writeCache(localPath, { timestamp: "" });
      if (!writeResult.ok) return writeResult;
      invalidated.push(localPath);
    }

    return { ok: true, value: { invalidated } };
  } catch (err) {
    const error = err as Error;
    return { ok: false, error: error.message, code: ErrorCode.UNKNOWN };
  }
}
