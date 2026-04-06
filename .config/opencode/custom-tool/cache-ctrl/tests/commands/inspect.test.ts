import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectCommand } from "../../src/commands/inspect.js";

const EXTERNAL_DIR = join(".ai", "external-context-gatherer_cache");
const LOCAL_DIR = join(".ai", "local-context-gatherer_cache");

let origCwd: string;
let tmpDir: string;

beforeEach(async () => {
  origCwd = process.cwd();
  tmpDir = await mkdtemp(join(tmpdir(), "cache-ctrl-inspect-"));
  process.chdir(tmpDir);
  await mkdir(join(tmpDir, EXTERNAL_DIR), { recursive: true });
  await mkdir(join(tmpDir, LOCAL_DIR), { recursive: true });
});

afterEach(() => {
  process.chdir(origCwd);
});

describe("inspectCommand — external agent", () => {
  it("returns full file content for a matched external entry", async () => {
    const filePath = join(tmpDir, EXTERNAL_DIR, "mylib.json");
    const originalData = {
      subject: "mylib",
      description: "My library docs",
      fetched_at: "2026-01-01T00:00:00Z",
      sources: [{ type: "docs", url: "https://example.com" }],
      header_metadata: { "https://example.com": { checked_at: "2026-01-01T00:00:00Z", status: "fresh" } },
      extra_field: "custom value",
    };
    await writeFile(filePath, JSON.stringify(originalData));

    const result = await inspectCommand({ agent: "external", subject: "mylib" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.file).toBe(filePath);
    expect(result.value.agent).toBe("external");
    const value = result.value as Record<string, unknown>;
    expect(value.subject).toBe("mylib");
    expect(value.description).toBe("My library docs");
    expect(value.extra_field).toBe("custom value");
  });

  it("returns NO_MATCH for unrecognized keyword", async () => {
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "mylib.json"),
      JSON.stringify({
        subject: "mylib",
        description: "My library",
        fetched_at: "2026-01-01T00:00:00Z",
        sources: [],
        header_metadata: {},
      }),
    );

    const result = await inspectCommand({ agent: "external", subject: "completely-unrelated-xyz" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FILE_NOT_FOUND");
  });

  it("returns FILE_NOT_FOUND when no external cache files exist", async () => {
    const result = await inspectCommand({ agent: "external", subject: "anything" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FILE_NOT_FOUND");
  });

  it("returns AMBIGUOUS_MATCH when two entries score equally", async () => {
    // "mylib" matches stem "mylib-a" as substring (80) and subject "mylib" exactly (70) → score 80
    // "mylib" matches stem "mylib-b" as substring (80) and subject "mylib" exactly (70) → score 80
    // Both entries get identical scores → AMBIGUOUS_MATCH
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "mylib-a.json"),
      JSON.stringify({ subject: "mylib", description: "library docs", fetched_at: "2026-01-01T00:00:00Z", sources: [], header_metadata: {} }),
    );
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "mylib-b.json"),
      JSON.stringify({ subject: "mylib", description: "library docs", fetched_at: "2026-01-01T00:00:00Z", sources: [], header_metadata: {} }),
    );

    const result = await inspectCommand({ agent: "external", subject: "mylib" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AMBIGUOUS_MATCH");
  });

  it("selects the best match when scores differ", async () => {
    // "react" in both subject and description scores higher
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "react-docs.json"),
      JSON.stringify({
        subject: "react-docs",
        description: "React documentation",
        fetched_at: "2026-01-01T00:00:00Z",
        sources: [],
        header_metadata: {},
      }),
    );
    // "unrelated" only in subject
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "unrelated.json"),
      JSON.stringify({
        subject: "unrelated",
        description: "Something else",
        fetched_at: "2026-01-01T00:00:00Z",
        sources: [],
        header_metadata: {},
      }),
    );

    const result = await inspectCommand({ agent: "external", subject: "react" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.file).toContain("react-docs.json");
  });
});

describe("inspectCommand — local agent", () => {
  it("returns full file content for the local cache", async () => {
    const localPath = join(tmpDir, LOCAL_DIR, "context.json");
    const localData = {
      timestamp: "2026-01-01T00:00:00Z",
      topic: "local codebase scan",
      description: "Scanned local project files",
      tracked_files: [{ path: "src/index.ts", mtime: 1_700_000_000_000 }],
    };
    await writeFile(localPath, JSON.stringify(localData));

    const result = await inspectCommand({ agent: "local", subject: "local" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.file).toBe(localPath);
    expect(result.value.agent).toBe("local");
    const value = result.value as Record<string, unknown>;
    expect(value.topic).toBe("local codebase scan");
    expect(Array.isArray(value.tracked_files)).toBe(true);
  });

  it("returns FILE_NOT_FOUND when local cache does not exist", async () => {
    const result = await inspectCommand({ agent: "local", subject: "local" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FILE_NOT_FOUND");
  });
});
