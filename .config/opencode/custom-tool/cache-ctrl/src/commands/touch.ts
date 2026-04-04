import { findRepoRoot, listCacheFiles, writeCache, readCache } from "../cache/cacheManager.js";
import { getFileStem } from "../cache/externalCache.js";
import { resolveLocalCachePath } from "../cache/localCache.js";
import { scoreEntry } from "../search/keywordSearch.js";
import type { CacheEntry } from "../types/cache.js";
import { ExternalCacheFileSchema } from "../types/cache.js";
import { ErrorCode, type Result } from "../types/result.js";
import type { TouchArgs, TouchResult } from "../types/commands.js";

export async function touchCommand(args: TouchArgs): Promise<Result<TouchResult["value"]>> {
  try {
    const repoRoot = await findRepoRoot(process.cwd());
    const newTimestamp = new Date().toISOString();
    const touched: string[] = [];

    if (args.agent === "external") {
      const filesResult = await listCacheFiles("external", repoRoot);
      if (!filesResult.ok) return filesResult;

      let filesToTouch: string[];

      if (args.subject) {
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

        filesToTouch = [scored[0]!.filePath];
      } else {
        filesToTouch = filesResult.value;
      }

      for (const filePath of filesToTouch) {
        const writeResult = await writeCache(filePath, { fetched_at: newTimestamp });
        if (!writeResult.ok) return writeResult;
        touched.push(filePath);
      }
    } else {
      // local
      const localPath = resolveLocalCachePath(repoRoot);
      const writeResult = await writeCache(localPath, { timestamp: newTimestamp });
      if (!writeResult.ok) return writeResult;
      touched.push(localPath);
    }

    return { ok: true, value: { touched, new_timestamp: newTimestamp } };
  } catch (err) {
    const error = err as Error;
    return { ok: false, error: error.message, code: ErrorCode.UNKNOWN };
  }
}
