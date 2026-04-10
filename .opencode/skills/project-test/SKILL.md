---
name: project-test
description: Project-specific testing guidelines, test framework conventions, patterns, and coverage requirements
---

# Project Test Guidelines

This is a **dotfiles/configuration repository**. There is no application test suite yet. Testing is oriented around:
1. **Shell/install script correctness** — BATS tests
2. **Neovim health checks** — `:checkhealth` (manual)
3. **TypeScript type correctness** — Bun + tsc
4. **Shell static analysis** — ShellCheck + shfmt

---

## Test Framework

### Shell scripts: BATS (Bash Automated Testing System)
- BATS works for both Bash and Zsh scripts
- Install: `brew install bats-core` or `apt install bats`
- Alternative: `zunit` (Zsh-native unit test framework)

### TypeScript (opencode plugin): vitest via `bun run test`
- Test framework: **vitest** (configured in `package.json` scripts)
- Run via `bun run test` — delegates to `bunx vitest run` per the `test` script
- Import from `vitest`: `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`
- Any `*.test.ts` file under `tests/` is picked up automatically

### Neovim Lua: `:checkhealth`
- Run `:checkhealth` inside Neovim to validate plugin + LSP dependencies
- `lua_ls` (lua-language-server) provides type checking via `.luarc.json` + `lazydev.nvim`

---

## Test Location & File Naming

### Shell / install tests
```
dotfiles/
└── test/
    ├── test_install.bats        # tests for install.sh
    └── test_zshrc.bats          # tests for .zshrc sourcing
```

### TypeScript tests
```
.config/opencode/
├── src/
│   └── *.ts
└── tests/
    └── *.test.ts    # OR co-located: src/*.test.ts
```

---

## Writing Tests

### BATS pattern for install.sh verification
```bash
#!/usr/bin/env bats

setup() {
  # Create a temp HOME for isolated testing
  export TMPDIR="$(mktemp -d)"
  export HOME="$TMPDIR"
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "install.sh creates .zshrc symlink" {
  run zsh install.sh
  [ "$status" -eq 0 ]
  [ -L "$HOME/.zshrc" ]
}

@test "symlink points to correct target" {
  run zsh install.sh
  local target
  target="$(readlink -f "$HOME/.zshrc")"
  [[ "$target" == *"/.zshrc" ]]
}
```

### What to test for dotfiles
1. File exists at expected path after `install.sh`
2. Symlinks point to correct repo-relative target
3. File has correct permissions (e.g., `600` for SSH config)
4. Required binaries are available (existence checks)
5. Content matches source — `diff -q <(cat src) <(cat dest)`

### TypeScript (vitest) test pattern
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("MyFeature", () => {
  beforeEach(() => {
    // setup — e.g. mkdtemp, process.chdir
  });

  afterEach(() => {
    // teardown — e.g. process.chdir(origCwd)
  });

  it("should do something", () => {
    expect(someFunction()).toBe(expectedValue);
  });
});
```

### Mocking in vitest
```typescript
import { vi } from "vitest";

const mockFn = vi.fn(() => "mocked value");
const spy = vi.spyOn(someObject, "method");

// Always restore mocks after each test
afterEach(() => vi.restoreAllMocks());
```

---

## Mocking & Fixtures

- Shell tests: use `TMPDIR` + `mktemp -d` for isolated HOME environments
- vitest: use `vi.fn()` / `vi.spyOn()` from `vitest` for module mocking
- Neovim: no automated mocking — use `:checkhealth` and `lua_ls` type checking

---

## Coverage Requirements

There is no enforced coverage requirement (personal dotfiles). Recommended:
- All critical paths in `install.sh` (symlink creation, file existence) should have BATS tests
- TypeScript code in `.config/opencode/` should have type coverage via `tsc --noEmit`

---

## Running Tests

### Shell static analysis (run before committing)
```bash
# ShellCheck — catches ~80% of common shell bugs
shellcheck -x install.sh
shellcheck -x .zshrc

# shfmt — format check
shfmt -d install.sh
```

### BATS (when test/ directory is created)
```bash
# Run all BATS tests
bats test/

# Run a specific test file
bats test/test_install.bats
```

### TypeScript tests in this repo (opencode config)
```bash
cd .config/opencode

# Run all tests (delegates to bunx vitest run via package.json "test" script)
bun run test

# Watch mode (during development)
bun run test:watch
```

`@thecat69/cache-ctrl` tests are maintained and executed in the upstream repository, not in this dotfiles repo.

### Neovim health check (manual)
```
:checkhealth         " all health checks
:checkhealth lazy    " lazy.nvim status
:checkhealth mason   " mason.nvim status
```
