import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { getGitTrackedFiles, getGitDeletedFiles } from "../../src/files/gitFiles.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "cache-ctrl-gitfiles-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function initGitRepo(dir: string): void {
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
}

describe("getGitTrackedFiles", () => {
  it("returns [] for a non-git directory", async () => {
    const result = await getGitTrackedFiles(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns [] for an empty git repo with no commits", async () => {
    initGitRepo(tmpDir);
    const result = await getGitTrackedFiles(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns committed files", async () => {
    initGitRepo(tmpDir);
    await writeFile(join(tmpDir, "file.ts"), "export const x = 1;");
    execFileSync("git", ["add", "."], { cwd: tmpDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: tmpDir });

    const result = await getGitTrackedFiles(tmpDir);
    expect(result).toContain("file.ts");
  });

  it("does NOT include untracked files (not git add'd)", async () => {
    initGitRepo(tmpDir);
    await writeFile(join(tmpDir, "untracked.ts"), "export const y = 2;");
    // Intentionally not calling git add

    const result = await getGitTrackedFiles(tmpDir);
    expect(result).not.toContain("untracked.ts");
  });
});

describe("getGitDeletedFiles", () => {
  it("returns [] for a non-git directory", async () => {
    const result = await getGitDeletedFiles(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns files committed then deleted from working tree", async () => {
    initGitRepo(tmpDir);
    const filePath = join(tmpDir, "file.ts");
    await writeFile(filePath, "export const x = 1;");
    execFileSync("git", ["add", "."], { cwd: tmpDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: tmpDir });

    // Delete only from working tree (not via git rm)
    await rm(filePath);

    const result = await getGitDeletedFiles(tmpDir);
    expect(result).toContain("file.ts");
  });

  it("returns [] when no files have been deleted", async () => {
    initGitRepo(tmpDir);
    await writeFile(join(tmpDir, "file.ts"), "export const x = 1;");
    execFileSync("git", ["add", "."], { cwd: tmpDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: tmpDir });

    const result = await getGitDeletedFiles(tmpDir);
    expect(result).toEqual([]);
  });
});
