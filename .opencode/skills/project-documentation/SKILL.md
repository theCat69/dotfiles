---
name: project-documentation
description: Project-specific documentation standards for code, README, API docs, and changelog
---

# Project Documentation Guidelines

---

## Code Documentation

### Lua (Neovim config)
- Use `---` (triple-dash) for LuaDoc annotations visible to `lua_ls`:
  ```lua
  ---Helper to integrate files into lazy setup
  ---@class LazyUtils
  local M = {}

  ---Register one or more plugins
  ---@param plug LazyPluginSpec|LazyPluginSpec[]
  function M.register_plugin(plug)
    -- ...
  end
  ```
- Annotate return types on module returns: `---@type LazyPluginSpec` or `---@type LazyPluginSpec[]`
- Use section header comments for major logical groupings:
  ```lua
  -- [[ Setting options ]]
  -- [[ Basic Keymaps ]]
  -- === LSP servers ===
  ```
- Inline comments: explain *why*, not *what* the code does
- Always set `desc = "..."` on every `vim.keymap.set` call — required for which-key integration

### Zsh / Shell
Header block at top of every non-trivial script:
```zsh
#!/usr/bin/env zsh
# script-name.zsh — Brief one-line description
#
# Usage:
#   script-name.zsh <arg1> [arg2]
#
# Arguments:
#   arg1   description
#
# Environment Variables:
#   VAR   description (default: value)
#
# Examples:
#   script-name.zsh foo bar
```
- Parse `--help`/`-h` to print the header block
- Inline comments: explain non-obvious logic only — avoid restating what the code does
- Use `# === SECTION NAME ===` separators for large scripts

### TypeScript (opencode plugin)
- Use JSDoc comments for public APIs:
  ```typescript
  /**
   * Brief description of what this does.
   * @param name - Description of the parameter
   * @returns Description of the return value
   */
  export function myFunction(name: string): string {
  ```
- Prefer expressive TypeScript types over prose comments where possible
- Use `// reason:` style inline comments to explain non-obvious decisions

---

## README Format

Project `Readme.md` (repo root) should include:
1. **Overview** — What this repo is and who it's for
2. **Prerequisites** — Required tools (currently listed in `install.sh` comments)
3. **Installation** — `zsh install.sh` steps
4. **Tool Notes** — Per-tool config highlights (Neovim plugins, Zsh plugins, etc.)
5. **How to Update** — Re-running install.sh, updating plugins
6. **Testing** — How to verify installation is correct

Neovim-specific README (`.config/nvim/README.md`) should include:
- Plugin list with brief purpose for each
- Key mappings overview (or reference to `:WhichKey`)
- How to add new plugins

---

## API Documentation

No public API. For internal Lua module documentation:
- LuaDoc annotations (`---@class`, `---@param`, `---@return`, `---@type`) are the "API docs"
- These are consumed by `lua_ls` for IDE support
- `.luarc.json` configures the workspace library paths for full type checking

For TypeScript:
- TypeDoc can generate docs from JSDoc + TypeScript types: `bunx typedoc src/index.ts`
- Keep-a-Changelog format for any public-facing changes

---

## Changelog

No CHANGELOG.md currently exists. Changelog is implicit via git log.

**Commit message format** (project convention):
```
<version> / <ai|human> / <purpose> : <summary>
```
Examples:
```
1.2.0 / human / feat : add telescope-fzf-native plugin
1.1.3 / ai / fix : correct lsp server on-attach handler
1.1.2 / human / chore : update lazy-lock.json
```

For Neovim plugin updates: reference `lazy-lock.json` diffs in commit messages to document which plugin versions changed.

For tool config changes: prefix with the tool name — e.g., `nvim:`, `zsh:`, `gitui:`.
