---
name: project-build
description: Project-specific build commands, prerequisites, environment setup, and CI/CD pipeline
---

# Project Build Guidelines

This is a **dotfiles/configuration repository** — there is no compiled application. "Building" means installing symlinks and ensuring tools are available. The TypeScript opencode plugin uses Bun.

---

## Prerequisites

Required tools (as documented in `install.sh`):
- `zsh` — shell (Oh My Zsh recommended)
- `neovim` — text editor (install to `/opt/nvim` or add to PATH)
- `starship` — prompt
- `rust` + cargo
- `node` + `nvm`
- `gitui` — TUI git client
- `zoxide` — directory jumper
- `sjvm` — custom JVM switcher
- `bun` — JS/TS runtime (for opencode plugin)
- `la-briguade` — external opencode plugin (agents/skills/slash commands/hooks)
- `@thecat69/cache-ctrl` — cache-control CLI + opencode integration

Optional but used:
- `eza` (replaces `ls`), `rg` (replaces `grep`), `batcat` (replaces `cat`), `jless`
- `ng` (Angular CLI — for shell completion)
- Homebrew (Linux: `/home/linuxbrew/.linuxbrew/bin/brew`)
- JetBrains Toolbox + IntelliJ IDEA

---

## Environment Setup

### XDG / Path configuration (from `.zshrc`)
```zsh
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export PATH=~/.local/bin:$PATH
export PATH=/opt/nvim:$PATH
export NVM_DIR="$HOME/.config/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
```

### Neovim plugins (lazy.nvim)
Plugins are auto-installed on first Neovim start. lazy.nvim is bootstrapped from `lua/plugins/lazy.lua`.
- Plugin lock file: `.config/nvim/lazy-lock.json` — **commit this file** for reproducibility
- Plugin data path: `vim.fn.stdpath("data") .. "/lazy/"` (typically `~/.local/share/nvim/lazy/`)

### opencode plugin (TypeScript / Bun)
```bash
# Install dependencies
cd .config/opencode
bun install

# Run plugin
bun run src/index.ts
```

---

## Build Commands

### Dotfiles installation
```bash
# From repo root — creates symlinks in $HOME and $XDG_CONFIG_HOME
zsh install.sh

# Install external opencode agent pipeline
npm install la-briguade && npx la-briguade install

# Install cache-control CLI and opencode integration
npm install -g @thecat69/cache-ctrl && cache-ctrl install
```

Symlinks created:
- `~/.zshrc` → `$(pwd)/.zshrc`
- `~/.config/ghostty` → `$(pwd)/.config/ghostty`
- `~/.config/starship.toml` → `$(pwd)/.config/starship.toml`
- `~/.config/nvim` → `$(pwd)/.config/nvim`
- `~/.config/gitui` → `$(pwd)/.config/gitui`
- `~/.config/opencode` → `$(pwd)/.config/opencode`

> Note: `.gitconfig` symlink is commented out — enable manually if this is your machine.

### Neovim: format Lua files
```bash
# From .config/nvim/
stylua .
# Or check without writing:
stylua --check .
```

### opencode plugin: type-check
```bash
cd .config/opencode
bun run typecheck   # or: bunx tsc --noEmit
```

### opencode plugin: lint/format (if Biome configured)
```bash
cd .config/opencode
bunx biome check --write ./src
```

---

## Development Server

No application server. For Neovim iterative development:
- Open Neovim and `:checkhealth` to verify plugin health
- `:Lazy` to manage plugin updates
- `:Mason` to manage LSP server installs
- Use `lazy-lock.json` diffs to track plugin version changes

---

## CI/CD Pipeline

No CI/CD currently configured. Recommended additions:
1. ShellCheck: `shellcheck install.sh .zshrc`
2. shfmt: `shfmt -d install.sh` (format check)
3. StyLua: `stylua --check .config/nvim/`
4. Bun type-check: `cd .config/opencode && bun run typecheck`
5. BATS tests for install.sh verification (see project-test skill)

To run ShellCheck manually:
```bash
shellcheck -x install.sh
shellcheck -x .zshrc
```
