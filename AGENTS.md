# AGENTS.md

This file is the entry point for AI agents (Codex, OpenAI, etc.) working on this dotfiles repository.

## Repository Overview

This is a **developer dotfiles and configuration repository** for Kubuntu. It manages:
- **Neovim** configuration (Lua, lazy.nvim plugin manager)
- **Zsh** shell configuration (Oh My Zsh, aliases, PATH)
- **Dotfiles installation** (`install.sh` — idempotent symlink creation)
- **opencode** AI coding tool configuration + TypeScript plugin (Bun runtime)
  - Agents/skills/slash commands/hooks are provided by the external `la-briguade` opencode plugin
  - Cache-control tooling is provided by the external `@thecat69/cache-ctrl` package
- **Starship**, **Ghostty**, **gitui**, **k9s**, and other tool configs

## External AI Packages

The opencode AI pipeline in this repo depends on external packages:

- [`la-briguade`](https://github.com/theCat69/la-briguade) — opencode plugin that provides production-grade agents, skills, slash commands, and hooks used by this setup
  ```bash
  npm install la-briguade && npx la-briguade install
  ```
- [`@thecat69/cache-ctrl`](https://github.com/theCat69/cache-ctrl) — CLI + native OpenCode integration that provides cache-ctrl functionality
  ```bash
  npm install -g @thecat69/cache-ctrl && cache-ctrl install
  ```

## Detailed Guidelines

All detailed coding, build, test, documentation, and security guidelines live in:

```
.opencode/skills/
├── project-coding/SKILL.md        — Coding style, naming, patterns, architecture
├── project-build/SKILL.md         — Install commands, prerequisites, environment setup
├── project-test/SKILL.md          — Testing with BATS, bun, ShellCheck
├── project-documentation/SKILL.md — Comment style, README format, changelog
├── project-security/SKILL.md      — Secrets, input validation, dependency security
└── project-code-examples/SKILL.md — Index of code pattern examples
```

Code pattern examples (real snippets from the project):
```
.code-examples-for-ai/
├── lua-plugin-spec.md
├── lua-module-pattern.md
├── lua-keymaps.md
├── lua-autocmd.md
├── zsh-aliases-and-path.md
└── shell-install-script.md
```

## Key Conventions (Quick Reference)

- **Lua formatter**: StyLua — 2-space indent, 140 col width, double quotes (`.config/nvim/.stylua.toml`)
- **Shell linter**: ShellCheck + shfmt
- **TypeScript runtime**: Bun (in `.config/opencode/`)
- **Commit format**: `<version> / <ai|human> / <purpose> : <summary>`
- **Install**: `zsh install.sh` from repo root — creates symlinks via `ln -sf`
- **Neovim plugins**: each file in `lua/plugins/*/` returns a `LazyPluginSpec` or `LazyPluginSpec[]`
- **No secrets in repo**: secrets sourced from `~/.secrets` (gitignored)
- **opencode dependency versions**: `@opencode-ai/*` packages and opencode plugins (e.g. `@mohak34/*`, `@slkiser/*`) must **never** be version-pinned — always use `"latest"`. Pinned versions in this context are always wrong.

## Auto-Managed Files (Do Not Commit)

The following files are automatically updated at runtime and should **never** be committed by AI agents:

- `.config/opencode/package.json` — opencode auto-updates the `@opencode-ai/plugin` version on every run. Any version bump in this file is runtime noise, not an agent change. Do not revert, pin, or commit this file unless explicitly instructed by the user.
- `.config/opencode/plugins/index.js` — installed/updated by `npx la-briguade install`.
- `.config/opencode/tools/cache_ctrl.ts` — installed/updated by `cache-ctrl install`.
- `.config/opencode/skills/cache-ctrl-*/` — installed/updated by `cache-ctrl install`.
