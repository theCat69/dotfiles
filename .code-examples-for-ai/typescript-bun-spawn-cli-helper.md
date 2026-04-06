# Pattern: Bun.spawn subprocess helper for E2E CLI testing

Demonstrates how to invoke a CLI binary as a subprocess using `Bun.spawn` with full
stdout/stderr capture and typed result — no `child_process`, no `execa`.

```typescript
// e2e/helpers/cli.ts

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawns: bun /app/src/index.ts ...args
 * Always resolves — non-zero exit code is NOT an exception.
 */
export async function runCli(
  args: string[],
  options?: { cwd?: string },
): Promise<CliResult> {
  const proc = Bun.spawn(["bun", "/app/src/index.ts", ...args], {
    cwd: options?.cwd ?? process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

/**
 * Parses CLI stdout as JSON with a typed generic.
 * Call on result.stderr when exitCode !== 0 (CLI writes errors to stderr).
 */
export function parseJsonOutput<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("parseJsonOutput: stdout was empty");
  return JSON.parse(trimmed) as T;
}
```

Key details:
- `Bun.spawn` takes an array (no shell interpolation) — safe for arbitrary `--data` JSON values
- `new Response(proc.stdout).text()` is the idiomatic Bun way to read a `ReadableStream` to string
- `proc.exited` is a `Promise<number>` — await it alongside stdout/stderr for parallel drain
- Error responses go to **stderr** (exitCode 1 or 2); success output goes to **stdout**
