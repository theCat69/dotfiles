import { join } from "node:path";
import { ExternalCacheFileSchema, LocalCacheFileSchema } from "../types/cache.js";
import { ErrorCode, type Result } from "../types/result.js";
import type { WriteArgs, WriteResult } from "../types/commands.js";
import { writeCache, findRepoRoot, resolveCacheDir, readCache } from "../cache/cacheManager.js";
import { validateSubject } from "../utils/validate.js";
import { resolveTrackedFileStats, filterExistingFiles } from "../files/changeDetector.js";
import type { TrackedFile } from "../types/cache.js";
import { TrackedFileSchema } from "../types/cache.js";

export async function writeCommand(args: WriteArgs): Promise<Result<WriteResult["value"]>> {
  try {
    const repoRoot = await findRepoRoot(process.cwd());

    if (args.agent === "external") {
      // subject is required
      if (!args.subject) {
        return { ok: false, error: "subject is required for external agent", code: ErrorCode.INVALID_ARGS };
      }

      const subjectValidation = validateSubject(args.subject);
      if (!subjectValidation.ok) return subjectValidation;

      // if content.subject is set but mismatches the subject param → error
      if (args.content["subject"] !== undefined && args.content["subject"] !== args.subject) {
        return {
          ok: false,
          error: `content.subject "${String(args.content["subject"])}" does not match subject argument "${args.subject}"`,
          code: ErrorCode.VALIDATION_ERROR,
        };
      }

      // inject subject into content if absent
      const contentWithSubject = { ...args.content, subject: args.subject };

      // validate against ExternalCacheFileSchema
      const parsed = ExternalCacheFileSchema.safeParse(contentWithSubject);
      if (!parsed.success) {
        const message = parsed.error.issues.map((i) => i.message).join("; ");
        return { ok: false, error: `Validation failed: ${message}`, code: ErrorCode.VALIDATION_ERROR };
      }

      const cacheDir = resolveCacheDir("external", repoRoot);
      const filePath = join(cacheDir, `${args.subject}.json`);
      const writeResult = await writeCache(filePath, contentWithSubject);
      if (!writeResult.ok) return writeResult;
      return { ok: true, value: { file: filePath } };
    }

    // local — auto-inject server-side timestamp; agent must not control this field
    const contentWithTimestamp = { ...args.content, timestamp: new Date().toISOString() };

    // Resolve real mtimes for submitted tracked_files if present
    const rawTrackedFiles = contentWithTimestamp["tracked_files"];
    let survivingSubmitted: TrackedFile[] = [];

    if (Array.isArray(rawTrackedFiles)) {
      const validEntries = rawTrackedFiles
        .filter(
          (entry): entry is { path: string } =>
            entry !== null && typeof entry === "object" && typeof (entry as Record<string, unknown>)["path"] === "string",
        )
        .map((entry) => ({ path: entry.path }));
      const resolved = await resolveTrackedFileStats(validEntries, repoRoot);
      // Evict submitted entries for files that are missing or path-traversal-rejected
      survivingSubmitted = resolved.filter((f) => f.mtime !== 0);
    }

    // Read existing cache to perform per-path merge
    const localCacheDir = resolveCacheDir("local", repoRoot);
    const filePath = join(localCacheDir, "context.json");

    const readResult = await readCache(filePath);
    let existingContent: Record<string, unknown> = {};
    let existingTrackedFiles: TrackedFile[] = [];

    if (readResult.ok) {
      existingContent = readResult.value;
      // Validate the on-disk tracked_files against the schema — fall back to [] on corrupt/missing data
      const parseResult = TrackedFileSchema.array().safeParse(existingContent["tracked_files"]);
      existingTrackedFiles = parseResult.success ? parseResult.data : [];
    } else if (readResult.code !== ErrorCode.FILE_NOT_FOUND) {
      return { ok: false, error: readResult.error, code: readResult.code };
    }

    // Keep existing entries whose paths are NOT being replaced by the submitted set
    const submittedPaths = new Set(survivingSubmitted.map((f) => f.path));
    const existingNotSubmitted = existingTrackedFiles.filter((f) => !submittedPaths.has(f.path));

    // Evict deleted files from the preserved existing entries
    const survivingExisting = await filterExistingFiles(existingNotSubmitted, repoRoot);

    const mergedTrackedFiles = [...survivingExisting, ...survivingSubmitted];

    // Merge top-level fields: existing base → then submitted content (submitted wins)
    const processedContent: Record<string, unknown> = {
      ...existingContent,
      ...contentWithTimestamp,
      tracked_files: mergedTrackedFiles,
    };

    const parsed = LocalCacheFileSchema.safeParse(processedContent);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join("; ");
      return { ok: false, error: `Validation failed: ${message}`, code: ErrorCode.VALIDATION_ERROR };
    }

    // processedContent is used (not parsed.data) to preserve loose fields not known to the schema — intentional merge semantics
    const writeResult = await writeCache(filePath, processedContent, "replace");
    if (!writeResult.ok) return writeResult;
    return { ok: true, value: { file: filePath } };
  } catch (err) {
    const error = err as Error;
    return { ok: false, error: error.message, code: ErrorCode.UNKNOWN };
  }
}
