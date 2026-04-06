---
name: project-code-examples
description: Catalog of project code examples — what patterns exist and where to find them in .code-examples-for-ai/
---

# Project Code Examples

These examples demonstrate the coding patterns used in this project.

## Available Examples

| File | Pattern demonstrated |
|---|---|
| `lua-plugin-spec.md` | lazy.nvim `LazyPluginSpec[]` with `ft` + `cmd` lazy loading triggers |
| `lua-module-pattern.md` | Local `M = {}` module pattern with LuaDoc annotations for `lua_ls` |
| `lua-keymaps.md` | `vim.keymap.set` with multiple modes, `expr`, `silent`, and `desc` |
| `lua-autocmd.md` | `vim.api.nvim_create_autocmd` with named augroup (`clear = true`) |
| `zsh-aliases-and-path.md` | Zsh alias types (drop-in, suffix, global, function) and `PATH` extension |
| `shell-install-script.md` | Idempotent `ln -sf` symlink installer with `$(pwd)`-relative paths |
| `typescript-input-validation-guard.md` | Path-traversal guard with `Result<void>` — reusable input validator in `src/utils/` |
| `typescript-result-pattern.md` | `Result<T, E>` discriminated union with `ErrorCode` enum — no-throw error propagation |
| `typescript-zod-safeparse-boundary.md` | Zod `safeParse()` at I/O boundaries — replaces unsafe `as T` casts when reading JSON from disk |
| `typescript-zod-write-validation.md` | Zod `safeParse()` at write boundary — field injection, mismatch guard, and `Result<T>` error surfacing |
| `typescript-cli-help-printer.md` | Data-driven `printHelp(command?)` using `Record<CommandName, CommandHelp>` — plain-text CLI help with testable stdout spy pattern |
| `typescript-per-path-merge-write.md` | Per-path array merge during cache write — read existing, filter submitted paths, evict deleted, merge, write-replace |
| `typescript-subprocess-graceful-degradation.md` | Async `execFile` + `promisify` with silent `catch → []` fallback — optional subprocess integration (e.g. git) that degrades gracefully |

## Location

`.code-examples-for-ai/`

## Maintenance

This index is maintained by the AI. Developers may add entries manually. One file per pattern.

When adding a new pattern:
1. Create `.code-examples-for-ai/<pattern-name>.md` (kebab-case filename)
2. Add a one-line description comment at the top of the file
3. Include a real code snippet from the project (not invented)
4. Add an entry to the table above
