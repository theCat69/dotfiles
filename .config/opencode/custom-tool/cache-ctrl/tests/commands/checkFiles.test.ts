import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { checkFilesCommand } from "../../src/commands/checkFiles.js";

const LOCAL_DIR = join(".ai", "local-context-gatherer_cache");

let origCwd: string;
let tmpDir: string;

beforeEach(async () => {
  origCwd = process.cwd();
  tmpDir = await mkdtemp(join(tmpdir(), "cache-ctrl-checkfiles-"));
  process.chdir(tmpDir);
  await mkdir(join(tmpDir, LOCAL_DIR), { recursive: true });
});

afterEach(() => {
  process.chdir(origCwd);
});

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function getMtime(filePath: string): Promise<number> {
  return (await stat(filePath)).mtimeMs;
}

async function writeLocalCache(trackedFiles: Array<{ path: string; mtime: number; hash?: string }>): Promise<void> {
  const localPath = join(tmpDir, LOCAL_DIR, "context.json");
  await writeFile(
    localPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      topic: "test scan",
      description: "Test local cache",
      tracked_files: trackedFiles,
    }),
  );
}

describe("checkFilesCommand", () => {
  it("returns FILE_NOT_FOUND when local cache does not exist", async () => {
    const result = await checkFilesCommand();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FILE_NOT_FOUND");
  });

  it("returns unchanged for empty tracked_files list", async () => {
    await writeLocalCache([]);
    const result = await checkFilesCommand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("unchanged");
    expect(result.value.changed_files).toHaveLength(0);
    expect(result.value.unchanged_files).toHaveLength(0);
    expect(result.value.missing_files).toHaveLength(0);
  });

  it("returns unchanged when mtime matches", async () => {
    const trackedPath = join(tmpDir, "tracked.ts");
    await writeFile(trackedPath, "export const x = 1;");
    const mtime = await getMtime(trackedPath);

    await writeLocalCache([{ path: "tracked.ts", mtime }]);
    const result = await checkFilesCommand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("unchanged");
    expect(result.value.unchanged_files).toContain("tracked.ts");
  });

  it("returns changed when mtime differs and no hash stored", async () => {
    const trackedPath = join(tmpDir, "tracked.ts");
    await writeFile(trackedPath, "export const x = 1;");

    // Store a fake mtime that doesn't match the real one
    await writeLocalCache([{ path: "tracked.ts", mtime: 999_999_999 }]);
    const result = await checkFilesCommand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("changed");
    expect(result.value.changed_files[0]!.path).toBe("tracked.ts");
    expect(result.value.changed_files[0]!.reason).toBe("mtime");
  });

  it("returns unchanged when mtime differs but hash matches (touch-only change)", async () => {
    const trackedPath = join(tmpDir, "tracked.ts");
    const content = "export const x = 1;";
    await writeFile(trackedPath, content);
    const realMtime = await getMtime(trackedPath);
    const hash = sha256(content);

    // Store a slightly different mtime but correct hash
    const fakeMtime = realMtime - 5000;
    await writeLocalCache([{ path: "tracked.ts", mtime: fakeMtime, hash }]);

    const result = await checkFilesCommand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("unchanged");
    expect(result.value.unchanged_files).toContain("tracked.ts");
  });

  it("returns changed with reason=hash when mtime and hash both differ", async () => {
    const trackedPath = join(tmpDir, "tracked.ts");
    await writeFile(trackedPath, "export const x = 2;"); // new content

    // Store old mtime and old hash
    await writeLocalCache([{ path: "tracked.ts", mtime: 999_999_999, hash: sha256("export const x = 1;") }]);
    const result = await checkFilesCommand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("changed");
    expect(result.value.changed_files[0]!.reason).toBe("hash");
  });

  it("reports missing files in both missing_files and changed_files", async () => {
    await writeLocalCache([{ path: "does-not-exist.ts", mtime: 1_000_000 }]);
    const result = await checkFilesCommand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("changed");
    expect(result.value.missing_files).toContain("does-not-exist.ts");
    expect(result.value.changed_files[0]!.reason).toBe("missing");
  });

  it("rejects path traversal attempts — treated as missing", async () => {
    await writeLocalCache([{ path: "../../etc/passwd", mtime: 1_000_000 }]);
    const result = await checkFilesCommand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Path traversal → missing
    expect(result.value.missing_files).toContain("../../etc/passwd");
  });

  it("handles a mix of changed, unchanged, and missing files", async () => {
    const unchangedPath = join(tmpDir, "unchanged.ts");
    const changedPath = join(tmpDir, "changed.ts");
    await writeFile(unchangedPath, "const a = 1;");
    await writeFile(changedPath, "const b = 2;");

    const unchangedMtime = await getMtime(unchangedPath);

    await writeLocalCache([
      { path: "unchanged.ts", mtime: unchangedMtime },
      { path: "changed.ts", mtime: 1 }, // wrong mtime
      { path: "missing.ts", mtime: 1_000_000 },
    ]);

    const result = await checkFilesCommand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("changed");
    expect(result.value.unchanged_files).toContain("unchanged.ts");
    expect(result.value.changed_files.map((f) => f.path)).toContain("changed.ts");
    expect(result.value.missing_files).toContain("missing.ts");
  });
});
