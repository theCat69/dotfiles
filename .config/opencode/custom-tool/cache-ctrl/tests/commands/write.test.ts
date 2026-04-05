import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeCommand } from "../../src/commands/write.js";
import { ErrorCode } from "../../src/types/result.js";

const EXTERNAL_DIR = join(".ai", "external-context-gatherer_cache");
const LOCAL_DIR = join(".ai", "local-context-gatherer_cache");

const validExternalContent = {
  subject: "mysubject",
  description: "A test external cache entry",
  fetched_at: "2026-04-05T10:00:00Z",
  sources: [{ type: "docs", url: "https://example.com/docs" }],
  header_metadata: {},
} as const;

const validLocalContent = {
  timestamp: "2026-04-05T10:00:00Z",
  topic: "test local scan",
  description: "A test local cache entry",
  tracked_files: [{ path: "lua/plugins/ui/bufferline.lua", mtime: 1743768000000 }],
} as const;

let origCwd: string;
let tmpDir: string;

beforeEach(async () => {
  origCwd = process.cwd();
  tmpDir = await mkdtemp(join(tmpdir(), "cache-ctrl-write-"));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origCwd);
});

describe("writeCommand", () => {
  it("writes a valid external entry", async () => {
    const result = await writeCommand({
      agent: "external",
      subject: "mysubject",
      content: { ...validExternalContent },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedPath = join(tmpDir, EXTERNAL_DIR, "mysubject.json");
    expect(result.value.file).toBe(expectedPath);

    const raw = await readFile(expectedPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed["subject"]).toBe("mysubject");
    expect(parsed["description"]).toBe("A test external cache entry");
    expect(parsed["fetched_at"]).toBe("2026-04-05T10:00:00Z");
  });

  it("writes a valid local entry", async () => {
    const result = await writeCommand({
      agent: "local",
      content: { ...validLocalContent },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedPath = join(tmpDir, LOCAL_DIR, "context.json");
    expect(result.value.file).toBe(expectedPath);

    const raw = await readFile(expectedPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed["timestamp"]).toBe("2026-04-05T10:00:00Z");
    expect(parsed["topic"]).toBe("test local scan");
  });

  it("returns VALIDATION_ERROR for missing required field (external)", async () => {
    // Missing 'description'
    const contentMissingDescription = {
      subject: "mysubject",
      fetched_at: "2026-04-05T10:00:00Z",
      sources: [],
      header_metadata: {},
    };

    const result = await writeCommand({
      agent: "external",
      subject: "mysubject",
      content: contentMissingDescription,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("returns VALIDATION_ERROR for wrong field type (external)", async () => {
    // fetched_at must be string, passing number
    const contentWrongType = {
      subject: "mysubject",
      description: "A test entry",
      fetched_at: 123,
      sources: [],
      header_metadata: {},
    };

    const result = await writeCommand({
      agent: "external",
      subject: "mysubject",
      content: contentWrongType,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("injects subject into content.subject when absent", async () => {
    // content does not have subject field
    const contentWithoutSubject = {
      description: "A test external cache entry",
      fetched_at: "2026-04-05T10:00:00Z",
      sources: [{ type: "docs", url: "https://example.com/docs" }],
      header_metadata: {},
    };

    const result = await writeCommand({
      agent: "external",
      subject: "injected-subject",
      content: contentWithoutSubject,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const raw = await readFile(result.value.file, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed["subject"]).toBe("injected-subject");
  });

  it("returns VALIDATION_ERROR when content.subject mismatches subject param", async () => {
    const contentWithMismatch = {
      subject: "other",
      description: "A test entry",
      fetched_at: "2026-04-05T10:00:00Z",
      sources: [],
      header_metadata: {},
    };

    const result = await writeCommand({
      agent: "external",
      subject: "mysubject",
      content: contentWithMismatch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(result.error).toContain("does not match subject argument");
  });

  it("returns INVALID_ARGS when subject missing for external", async () => {
    const result = await writeCommand({
      agent: "external",
      content: { ...validExternalContent },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ErrorCode.INVALID_ARGS);
  });

  it("preserves unknown extra fields", async () => {
    const contentWithExtra = {
      ...validExternalContent,
      extra_field: "hello",
      nested_extra: { foo: 42 },
    };

    const result = await writeCommand({
      agent: "external",
      subject: "mysubject",
      content: contentWithExtra,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const raw = await readFile(result.value.file, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed["extra_field"]).toBe("hello");
    expect(parsed["nested_extra"]).toEqual({ foo: 42 });
  });

  it("merges with existing file on second write", async () => {
    // First write — full valid content
    await writeCommand({
      agent: "external",
      subject: "mysubject",
      content: { ...validExternalContent, existing_field: "original" },
    });

    // Second write — partial update (only update fetched_at, keep existing_field)
    const partialUpdate = {
      subject: "mysubject",
      description: "Updated description",
      fetched_at: "2026-04-06T10:00:00Z",
      sources: [],
      header_metadata: {},
    };

    const result = await writeCommand({
      agent: "external",
      subject: "mysubject",
      content: partialUpdate,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const raw = await readFile(result.value.file, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Updated fields from second write
    expect(parsed["description"]).toBe("Updated description");
    expect(parsed["fetched_at"]).toBe("2026-04-06T10:00:00Z");
    // Preserved from first write (merge semantics)
    expect(parsed["existing_field"]).toBe("original");
  });
});
