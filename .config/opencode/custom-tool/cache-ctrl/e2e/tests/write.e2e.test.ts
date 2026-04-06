import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runCli, parseJsonOutput } from "../helpers/cli.ts";
import { createTestRepo, type TestRepo } from "../helpers/repo.ts";

let repo: TestRepo;

beforeEach(async () => {
  repo = await createTestRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

describe("write external", () => {
  it("writes valid external entry and exits 0", async () => {
    await rm(join(repo.dir, ".ai"), { recursive: true, force: true });

    const entryData = {
      subject: "mywrite",
      description: "test",
      fetched_at: "2026-04-01T00:00:00Z",
      sources: [],
      header_metadata: {},
    };
    const result = await runCli(
      ["write", "external", "mywrite", "--data", JSON.stringify(entryData)],
      { cwd: repo.dir },
    );
    expect(result.exitCode).toBe(0);

    const output = parseJsonOutput<{ ok: boolean; value: { file: string } }>(result.stdout);
    expect(output.ok).toBe(true);
    expect(output.value.file).toMatch(/mywrite\.json$/);

    // Verify file exists on disk
    const filePath = join(
      repo.dir,
      ".ai",
      "external-context-gatherer_cache",
      "mywrite.json",
    );
    const fileContent = await readFile(filePath, "utf-8");
    const parsed = parseJsonOutput<{ subject: string }>(fileContent);
    expect(parsed.subject).toBe("mywrite");
  });

  it("fails with VALIDATION_ERROR for missing required field", async () => {
    // missing description
    const incompleteData = {
      subject: "bad",
      fetched_at: "2026-04-01T00:00:00Z",
      sources: [],
      header_metadata: {},
    };
    const result = await runCli(
      ["write", "external", "bad", "--data", JSON.stringify(incompleteData)],
      { cwd: repo.dir },
    );
    expect(result.exitCode).toBe(1);

    const errorOutput = parseJsonOutput<{ ok: boolean; code: string }>(result.stderr);
    expect(errorOutput.ok).toBe(false);
    expect(errorOutput.code).toBe("VALIDATION_ERROR");
  });

  it("fails with INVALID_ARGS when subject arg missing for external", async () => {
    const entryData = {
      description: "test",
      fetched_at: "2026-04-01T00:00:00Z",
      sources: [],
      header_metadata: {},
    };
    const result = await runCli(
      ["write", "external", "--data", JSON.stringify(entryData)],
      { cwd: repo.dir },
    );
    expect(result.exitCode).toBe(1);

    const errorOutput = parseJsonOutput<{ ok: boolean; code: string }>(result.stderr);
    expect(errorOutput.ok).toBe(false);
    expect(errorOutput.code).toBe("INVALID_ARGS");
  });

  it("--data must be valid JSON — exits 2 on invalid JSON string", async () => {
    const result = await runCli(
      ["write", "external", "test", "--data", "not-valid-json"],
      { cwd: repo.dir },
    );
    expect(result.exitCode).toBe(2);

    const errorOutput = parseJsonOutput<{ ok: boolean; code: string }>(result.stderr);
    expect(errorOutput.ok).toBe(false);
    expect(errorOutput.code).toBe("INVALID_ARGS");
  });

  it("missing --data flag exits with code 2", async () => {
    const result = await runCli(["write", "external", "test"], { cwd: repo.dir });
    expect(result.exitCode).toBe(2);

    const errorOutput = parseJsonOutput<{ ok: boolean; code: string }>(result.stderr);
    expect(errorOutput.ok).toBe(false);
    expect(errorOutput.code).toBe("INVALID_ARGS");
  });
});

describe("write local", () => {
  it("writes valid local entry and exits 0", async () => {
    await rm(join(repo.dir, ".ai"), { recursive: true, force: true });

    const entryData = { topic: "e2e test", description: "local write test", tracked_files: [] };
    const result = await runCli(
      ["write", "local", "--data", JSON.stringify(entryData)],
      { cwd: repo.dir },
    );
    expect(result.exitCode).toBe(0);

    const output = parseJsonOutput<{ ok: boolean; value: { file: string } }>(result.stdout);
    expect(output.ok).toBe(true);
    expect(output.value.file).toMatch(/context\.json$/);
  });

  it("auto-computes mtime for tracked files — caller-provided mtime is ignored", async () => {
    await rm(join(repo.dir, ".ai"), { recursive: true, force: true });

    const entryData = {
      topic: "mtime test",
      description: "test",
      tracked_files: [{ path: "src/file-a.ts", mtime: 1, hash: "fake" }],
    };
    const result = await runCli(
      ["write", "local", "--data", JSON.stringify(entryData)],
      { cwd: repo.dir },
    );
    expect(result.exitCode).toBe(0);

    const contextPath = join(
      repo.dir,
      ".ai",
      "local-context-gatherer_cache",
      "context.json",
    );
    const fileContent = await readFile(contextPath, "utf-8");
    const parsed = parseJsonOutput<{
      tracked_files: Array<{ path: string; mtime: number; hash: string }>;
    }>(fileContent);

    expect(parsed.tracked_files[0]?.mtime).not.toBe(1);
    expect(parsed.tracked_files[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
