---
name: project-coding
description: Project-specific coding guidelines, naming conventions, architecture patterns, and code examples
---

# Project Coding Guidelines

This is a **developer dotfiles/configuration repository** (Kubuntu). The codebase consists of:
- **Lua** — Neovim configuration via lazy.nvim
- **Zsh/Shell** — Shell config (`.zshrc`) and install scripts
- **TypeScript/JS** — opencode plugin code (Bun runtime)

---

## Code Style

### Lua (Neovim config)

Formatter: **StyLua** — always run before committing Lua files.

StyLua config (`.config/nvim/.stylua.toml`):
```toml
column_width = 140
indent_type = "Spaces"
indent_width = 2
quote_style = "AutoPreferDouble"
```

Rules:
- 2-space indentation, no tabs
- Column width: 140 characters
- Double quotes preferred; StyLua will auto-select when both are equivalent
- Every plugin spec file **returns a table** (`---@type LazyPluginSpec` or `---@type LazyPluginSpec[]`)
- Annotate return types with LuaDoc: `---@type LazyPluginSpec[]`
- Use `---` doc comments for module-level documentation; `--` for inline
- Use `-- stylua: ignore` only to preserve intentional alignment

### Zsh / Shell

- Shebang: `#!/usr/bin/zsh` (or `#!/bin/bash` for POSIX portable scripts)
- 2-space indentation
- Always quote variable expansions: `"$var"` — never bare `$var`
- Use `[[ ]]` (double brackets) for conditionals in Zsh/Bash
- Use `set -euo pipefail` + `IFS=$'\n\t'` safety header in non-interactive scripts

### TypeScript / opencode plugin (Bun)

Formatter/linter: **Biome** (if configured) — single config, 2-space indent, 100-char line width.

tsconfig key settings:
- `"strict": true`, `"verbatimModuleSyntax": true`, `"noEmit": true`
- Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`)
- `"module": "ESNext"`, `"moduleResolution": "bundler"` for Bun compatibility

---

## Naming Conventions

### Lua
| Kind | Convention | Example |
|---|---|---|
| Modules / files | `snake_case` | `lsp.lua`, `lazy-utils.lua` |
| Functions | `snake_case` | `config()`, `register_plugin()` |
| Constants | `UPPER_SNAKE_CASE` | `SERVERS`, `FT` |
| Local aliases | Short locals | `local M = {}` for module objects |
| Directories | `kebab-case` | `no-lsp/`, `lua-config-common/` |

### Zsh / Shell
| Kind | Convention | Example |
|---|---|---|
| Files | `lowercase_underscore.zsh` | `process_data.zsh` |
| Functions | `lowercase_underscore` | `validate_inputs()` |
| Constants | `UPPER_SNAKE_CASE` | `ZSH_THEME`, `BUN_INSTALL` |
| Local vars | Always `local` inside functions | `local src=$1` |

### TypeScript
| Kind | Convention | Example |
|---|---|---|
| Files | `camelCase` or `kebab-case` | `index.ts`, `my-plugin.ts` |
| Classes | `PascalCase` | `PluginManager` |
| Functions/vars | `camelCase` | `registerPlugin` |
| Constants | `UPPER_SNAKE_CASE` or `const camelCase` | `MAX_RETRIES` |
| Types/interfaces | `PascalCase` | `LazyPluginSpec` |

---

## Import Ordering

### Lua
```lua
-- 1. Local module aliases (top of file)
local M = {}
local colors = require("metadata.ui").get_colors()

-- 2. Plugin-local requires inside config() functions — not at module level
local function config()
  require("neodev").setup({})
  require("mason-lspconfig").setup {}
end
```

### TypeScript
```typescript
// 1. Type-only imports first
import type { SomeType } from "some-module";
// 2. Value imports
import { something } from "some-module";
// 3. Relative imports last
import { helper } from "./helpers";
```

---

## Error Handling

### Lua
- Use `pcall()` to wrap operations that may fail at runtime (parser detection, LSP calls)
- Guard optional features with `if pcall(require, "module") then ... end`
- For diagnostic disable: `---@diagnostic disable-next-line: undefined-field`

### Zsh
- Use `set -euo pipefail` to exit on unhandled errors
- For expected failures: `command || true`
- Cleanup: `trap 'cleanup_function' EXIT ERR INT TERM`
- Never use `eval` with user-controlled input

---

## Patterns & Architecture

### Neovim Plugin Module Pattern
Each plugin lives in its own file under `lua/plugins/<category>/`:
1. **Returns** a `LazyPluginSpec` or `LazyPluginSpec[]` table
2. Uses a local `config()` function for plugin setup
3. Registers via `lazy_utils.register_plugin(require("plugins.<category>.<name>"))` in `lazy.lua`
4. Uses `ft = {...}` for filetype-based lazy loading
5. Uses `event = "BufRead"` or `keys = {...}` for other lazy triggers

### Module (M pattern)
```lua
---@class MyModule
local M = {}

function M.my_function(arg)
  -- implementation
end

return M
```

### lazy.nvim Spec Pattern
```lua
---@type LazyPluginSpec
return {
  "author/plugin-name",
  ft = { "lua", "typescript" },   -- lazy load by filetype
  -- OR: event = "BufRead"
  -- OR: keys = { ... }
  -- OR: cmd = "CommandName"
  config = function()
    require("plugin-name").setup({})
  end,
}
```

### Zsh Install Script Pattern
- Check-before-symlink: use `ln -sf` (force-overwrite, idempotent)
- Use `$(pwd)` for relative-to-repo paths
- Separate concerns with comments: `# tool-name`

### Commit Message Format
```
<version> / <ai|human> / <purpose> : <summary>
```
Examples:
- `1.2.0 / human / feat : add telescope plugin`
- `1.1.3 / ai / fix : correct lsp server config`

---

## Code Examples

See `.code-examples-for-ai/` for concrete patterns extracted from this project:
- `lua-plugin-spec.md` — lazy.nvim plugin spec with filetype lazy loading
- `lua-module-pattern.md` — local `M = {}` module pattern
- `lua-keymaps.md` — `vim.keymap.set` with descriptors
- `lua-autocmd.md` — `vim.api.nvim_create_autocmd` usage
- `zsh-aliases-and-path.md` — Zsh alias and PATH extension patterns
- `shell-install-script.md` — Idempotent symlink install script pattern
