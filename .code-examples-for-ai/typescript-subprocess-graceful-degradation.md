# TypeScript: Async subprocess with graceful degradation

Demonstrates running a child process asynchronously via `execFile` + `promisify`, parsing line-delimited stdout, and silently returning an empty array on any error (process not found, non-zero exit, not a git repo, etc.). Suitable for optional integrations where unavailability is not a failure.

```typescript
// src/files/gitFiles.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parseGitOutput(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export async function getGitTrackedFiles(repoRoot: string): Promise<string[]> {
  try {
    const result = await execFileAsync("git", ["ls-files"], { cwd: repoRoot });
    return parseGitOutput(result.stdout);
  } catch {
    return []; // git not available, not a repo, or non-zero exit — silent degradation
  }
}

export async function getGitDeletedFiles(repoRoot: string): Promise<string[]> {
  try {
    const result = await execFileAsync("git", ["ls-files", "--deleted"], { cwd: repoRoot });
    return parseGitOutput(result.stdout);
  } catch {
    return [];
  }
}
```

**Key points:**
- `promisify(execFile)` gives a typed async wrapper over the callback-based `execFile` — prefer over `exec` (no shell injection risk)
- `{ cwd: repoRoot }` scopes the subprocess to the relevant directory
- Bare `catch {}` returning `[]` is intentional: any failure (ENOENT for git not installed, non-zero exit for not-a-repo) should silently degrade
- `parseGitOutput` is extracted to keep subprocess and parsing concerns separate and independently testable
