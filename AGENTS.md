# AGENTS.md

This file is the entry point for AI agents (Codex, OpenAI, etc.) working on this dotfiles repository.

## Repository Overview

This is a **developer dotfiles and configuration repository** for Kubuntu. It manages:
- **Neovim** configuration (Lua, lazy.nvim plugin manager)
- **Zsh** shell configuration (Oh My Zsh, aliases, PATH)
- **Dotfiles installation** (`install.sh` — idempotent symlink creation)
- **opencode** AI coding tool configuration + TypeScript plugin (Bun runtime)
- **Starship**, **Ghostty**, **gitui**, **k9s**, and other tool configs

## Detailed Guidelines

All detailed coding, build, test, documentation, and security guidelines live in:

```
.opencode/skills/
├── project-coding/SKILL.md        — Coding style, naming, patterns, architecture
├── project-build/SKILL.md         — Install commands, prerequisites, environment setup
├── project-test/SKILL.md          — Testing with BATS, bun test, ShellCheck
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
