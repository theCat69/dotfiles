import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listCommand } from "../../src/commands/list.js";

const EXTERNAL_DIR = join(".ai", "external-context-gatherer_cache");
const LOCAL_DIR = join(".ai", "local-context-gatherer_cache");

function makeFetchedAt(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
}

async function setupCacheDir(repoRoot: string): Promise<void> {
  await mkdir(join(repoRoot, EXTERNAL_DIR), { recursive: true });
  await mkdir(join(repoRoot, LOCAL_DIR), { recursive: true });
}

let origCwd: string;
let tmpDir: string;

beforeEach(async () => {
  origCwd = process.cwd();
  tmpDir = await mkdtemp(join(tmpdir(), "cache-ctrl-list-"));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origCwd);
});

describe("listCommand", () => {
  it("returns all entries when agent=all", async () => {
    await setupCacheDir(tmpDir);
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "project-alpha.json"),
      JSON.stringify({
        subject: "project-alpha",
        description: "Alpha project docs",
        fetched_at: makeFetchedAt(1),
        sources: [],
        header_metadata: {},
      }),
    );
    await writeFile(
      join(tmpDir, LOCAL_DIR, "context.json"),
      JSON.stringify({
        timestamp: makeFetchedAt(2),
        topic: "local scan",
        description: "Local context",
        tracked_files: [],
      }),
    );

    const result = await listCommand({ agent: "all" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    const agents = result.value.map((e) => e.agent);
    expect(agents).toContain("external");
    expect(agents).toContain("local");
  });

  it("filters to external-only", async () => {
    await setupCacheDir(tmpDir);
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "alpha.json"),
      JSON.stringify({
        subject: "alpha",
        description: "desc",
        fetched_at: makeFetchedAt(1),
        sources: [],
        header_metadata: {},
      }),
    );
    await writeFile(
      join(tmpDir, LOCAL_DIR, "context.json"),
      JSON.stringify({
        timestamp: makeFetchedAt(1),
        topic: "local",
        description: "desc",
        tracked_files: [],
      }),
    );

    const result = await listCommand({ agent: "external" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.every((e) => e.agent === "external")).toBe(true);
  });

  it("filters to local-only", async () => {
    await setupCacheDir(tmpDir);
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "alpha.json"),
      JSON.stringify({
        subject: "alpha",
        description: "desc",
        fetched_at: makeFetchedAt(1),
        sources: [],
        header_metadata: {},
      }),
    );
    await writeFile(
      join(tmpDir, LOCAL_DIR, "context.json"),
      JSON.stringify({
        timestamp: makeFetchedAt(1),
        topic: "local",
        description: "desc",
        tracked_files: [],
      }),
    );

    const result = await listCommand({ agent: "local" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.every((e) => e.agent === "local")).toBe(true);
  });

  it("correctly computes age_human for recent entries", async () => {
    await setupCacheDir(tmpDir);
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "recent.json"),
      JSON.stringify({
        subject: "recent",
        description: "desc",
        fetched_at: makeFetchedAt(2),
        sources: [],
        header_metadata: {},
      }),
    );

    const result = await listCommand({ agent: "external" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = result.value[0]!;
    expect(entry.age_human).toContain("hour");
  });

  it("shows invalidated for empty fetched_at", async () => {
    await setupCacheDir(tmpDir);
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "invalid.json"),
      JSON.stringify({
        subject: "invalid",
        description: "desc",
        fetched_at: "",
        sources: [],
        header_metadata: {},
      }),
    );

    const result = await listCommand({ agent: "external" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = result.value[0]!;
    expect(entry.age_human).toBe("invalidated");
    expect(entry.is_stale).toBe(true);
  });

  it("marks external entries stale when age > 24h", async () => {
    await setupCacheDir(tmpDir);
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "old.json"),
      JSON.stringify({
        subject: "old",
        description: "desc",
        fetched_at: makeFetchedAt(25),
        sources: [],
        header_metadata: {},
      }),
    );

    const result = await listCommand({ agent: "external" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]!.is_stale).toBe(true);
  });

  it("marks fresh external entries as not stale", async () => {
    await setupCacheDir(tmpDir);
    await writeFile(
      join(tmpDir, EXTERNAL_DIR, "fresh.json"),
      JSON.stringify({
        subject: "fresh",
        description: "desc",
        fetched_at: makeFetchedAt(1),
        sources: [],
        header_metadata: {},
      }),
    );

    const result = await listCommand({ agent: "external" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]!.is_stale).toBe(false);
  });

  it("always marks local entries as is_stale: true", async () => {
    await setupCacheDir(tmpDir);
    await writeFile(
      join(tmpDir, LOCAL_DIR, "context.json"),
      JSON.stringify({
        timestamp: makeFetchedAt(0.1),
        topic: "recent local",
        description: "desc",
        tracked_files: [],
      }),
    );

    const result = await listCommand({ agent: "local" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]!.is_stale).toBe(true);
  });

  it("returns empty array when cache directories are empty", async () => {
    await setupCacheDir(tmpDir);

    const result = await listCommand({ agent: "all" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it("returns empty array when cache directories do not exist", async () => {
    const result = await listCommand({ agent: "all" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });
});
