import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareTrackedFile, computeFileHash, resolveTrackedFileStats } from "../../src/files/changeDetector.js";

let origCwd: string;
let tmpDir: string;

beforeEach(async () => {
  origCwd = process.cwd();
  tmpDir = await mkdtemp(join(tmpdir(), "cache-ctrl-detector-"));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origCwd);
});

describe("changeDetector", () => {
  it("unchanged mtime → unchanged", async () => {
    const filePath = join(tmpDir, "stable.ts");
    await writeFile(filePath, "export const x = 1;");

    const { stat } = await import("node:fs/promises");
    const fileStat = await stat(filePath);

    const result = await compareTrackedFile(
      { path: filePath, mtime: fileStat.mtimeMs },
      tmpDir,
    );
    expect(result.status).toBe("unchanged");
  });

  it("changed mtime, no hash stored → changed with reason mtime", async () => {
    const filePath = join(tmpDir, "changed.ts");
    await writeFile(filePath, "export const x = 1;");

    const oldMtime = 1000000; // Far in the past

    const result = await compareTrackedFile(
      { path: filePath, mtime: oldMtime },
      tmpDir,
    );
    expect(result.status).toBe("changed");
    expect(result.reason).toBe("mtime");
  });

  it("changed mtime, hash stored and matches → unchanged (hash is authoritative)", async () => {
    const filePath = join(tmpDir, "touch-only.ts");
    const content = "export const x = 1;";
    await writeFile(filePath, content);

    const hash = await computeFileHash(filePath);
    const oldMtime = 1000000; // Different mtime

    const result = await compareTrackedFile(
      { path: filePath, mtime: oldMtime, hash },
      tmpDir,
    );
    expect(result.status).toBe("unchanged");
  });

  it("changed mtime, hash stored and differs → changed with reason hash", async () => {
    const filePath = join(tmpDir, "modified.ts");
    await writeFile(filePath, "export const x = 1;");

    const oldHash = "0000000000000000000000000000000000000000000000000000000000000000"; // Wrong hash
    const oldMtime = 1000000;

    const result = await compareTrackedFile(
      { path: filePath, mtime: oldMtime, hash: oldHash },
      tmpDir,
    );
    expect(result.status).toBe("changed");
    expect(result.reason).toBe("hash");
  });

  it("missing file → missing with reason missing", async () => {
    const result = await compareTrackedFile(
      { path: join(tmpDir, "does-not-exist.ts"), mtime: 12345 },
      tmpDir,
    );
    expect(result.status).toBe("missing");
    expect(result.reason).toBe("missing");
  });

  it("relative paths are resolved against repoRoot", async () => {
    const fileName = "relative-file.ts";
    const filePath = join(tmpDir, fileName);
    await writeFile(filePath, "export const y = 2;");

    const { stat } = await import("node:fs/promises");
    const fileStat = await stat(filePath);

    const result = await compareTrackedFile(
      { path: fileName, mtime: fileStat.mtimeMs },
      tmpDir,
    );
    expect(result.status).toBe("unchanged");
  });

  it("computeFileHash produces consistent SHA-256 hex", async () => {
    const filePath = join(tmpDir, "hashable.ts");
    await writeFile(filePath, "constant content");

    const hash1 = await computeFileHash(filePath);
    const hash2 = await computeFileHash(filePath);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("resolveTrackedFileStats", () => {
  it("injects real mtime for existing file", async () => {
    const filePath = join(tmpDir, "tracked.ts");
    await writeFile(filePath, "export const y = 2;");

    const { stat } = await import("node:fs/promises");
    const realStat = await stat(filePath);
    const realMtime = realStat.mtimeMs;

    const result = await resolveTrackedFileStats(
      [{ path: filePath }],
      tmpDir,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.mtime).toBe(realMtime);
    expect(result[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses mtime=0 and no hash for missing file", async () => {
    const result = await resolveTrackedFileStats(
      [{ path: "missing/file.ts" }],
      tmpDir,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.mtime).toBe(0);
    expect(result[0]?.hash).toBeUndefined();
  });

  it("falls back to 0 for path traversal attempt", async () => {
    const result = await resolveTrackedFileStats(
      [{ path: "../../etc/passwd" }],
      tmpDir,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.mtime).toBe(0);
    expect(result[0]?.hash).toBeUndefined();
  });
});
