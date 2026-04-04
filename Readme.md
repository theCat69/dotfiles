# 🐱 theCat's dotfiles on Kubuntu

My personal developer environment, carefully tuned over time for a polyglot workflow (Java, Kotlin, Rust, TypeScript, Go, Python, Scala, and more). I'm picky about my setup — every tool here has earned its place. If you're the kind of person who spends a weekend getting your cursor blink animation just right, we're the same kind of person.

Everything is managed via idempotent symlinks from this repo into `~/.config/`.

---

## 📦 Contents

| Tool | What it is |
|---|---|
| **Neovim** | Full IDE-grade editor config via lazy.nvim (LSP, DAP, Treesitter, AI) |
| **Zsh** | Shell config: Oh My Zsh + Starship prompt, smart aliases, PATH management |
| **Ghostty** | Fast GPU-accelerated terminal emulator |
| **Starship** | Cross-shell prompt with custom modules (Quarkus, Zsh icon, time) |
| **gitui** | Terminal-based git client with Catppuccin themes |
| **k9s** | Kubernetes TUI with Gruvbox skin and custom resource aliases |
| **opencode** | AI coding assistant with custom agents, MCP servers, and plugins |
| **bat** | `cat` replacement with syntax highlighting |
| **IdeaVim** | Vim emulation config for JetBrains IDEs |

---

## ✅ Prerequisites

These must be installed before running `install.sh`. Most are available via your distro's package manager or their official install scripts.

- [zsh](https://www.zsh.org/)
- [Oh My Zsh](https://ohmyz.sh/)
- [Neovim](https://neovim.io/) (0.10+, install into `/opt/nvim`)
- [Starship](https://starship.rs/)
- [Ghostty](https://ghostty.org/)
- [gitui](https://github.com/extrawurst/gitui)
- [zoxide](https://github.com/ajeetdsouza/zoxide)
- [eza](https://github.com/eza-community/eza) — modern `ls`
- [ripgrep](https://github.com/BurntSushi/ripgrep) — fast `grep`
- [bat / batcat](https://github.com/sharkdp/bat) — syntax-highlighted `cat`
- [Bun](https://bun.sh/) — JS runtime (for opencode plugins)
- [nvm](https://github.com/nvm-sh/nvm) — Node version manager
- [Rust](https://www.rust-lang.org/tools/install) (via rustup)
- [Go](https://go.dev/dl/) (installed to `/usr/local/go`)
- [k9s](https://k9scli.io/)
- [opencode](https://opencode.ai/)
- [sjvm](https://github.com/theCat69/sjvm) — custom Rust-based JVM switcher (not in this repo)
- [Ollama](https://ollama.com/) — optional, enables in-editor AI completions via `gen.nvim`

> **Note:** [zsh-autosuggestions](https://github.com/zsh-users/zsh-autosuggestions) and [zsh-syntax-highlighting](https://github.com/zsh-users/zsh-syntax-highlighting) must be installed as Oh My Zsh custom plugins.

---

## 🚀 Install

```sh
git clone https://github.com/theCat69/dotfiles.git ~/dev-conf/dotfiles
cd ~/dev-conf/dotfiles
zsh install.sh
```

The script creates symlinks using `ln -s`. If you re-run it, remove existing symlinks first — otherwise the script will error on already-linked targets.

### What gets symlinked

| Source | Target |
|---|---|
| `.zshrc` | `~/.zshrc` |
| `.config/ghostty/` | `~/.config/ghostty` |
| `.config/starship.toml` | `~/.config/starship.toml` |
| `.config/nvim/` | `~/.config/nvim` |
| `.config/gitui/` | `~/.config/gitui` |
| `.config/opencode/` | `~/.config/opencode` |

> **Note:** `.config/k9s/`, `.config/bat/`, and `.config/ideavimrc/` are present in this repo but are **not** wired into `install.sh`. Copy or symlink them manually if you want them.

> **Note:** `.gitconfig` is intentionally **not** symlinked — it contains personal identity info. Uncomment the relevant line in `install.sh` if you know what you're doing (i.e., if you are me).

> **Note:** Secrets (API keys, tokens) are **not** stored in this repo. They live in `~/.secrets` which is sourced by `.zshrc` at shell startup. Create that file yourself and keep it gitignored.

---

## 🛠 Tools & Configs

### Neovim

A full IDE-grade setup built on [lazy.nvim](https://github.com/folke/lazy.nvim). The entire config lives in `.config/nvim/lua/` and is organised by category (`lsp/`, `ui/`, `git/`, `ai/`, etc.).

- **Theme:** Gruvbox Dark (auto-detects light/dark terminal background, transparent background, mode-coloured blinking cursor)
- **LSP:** 20+ servers managed by Mason with auto-update — `clangd`, `rust_analyzer`, `pyright`, `lua_ls`, `ts_ls`, `gopls`, `kotlin_language_server`, `angularls`, `tailwindcss`, `zls`, `solidity_ls`, `yamlls`, `bashls`, `dockerls`, and more
- **Language extras:** rust-tools, nvim-metals (Scala), nvim-dap + dapui (debug adapter), Jenkinsfile linter
- **Completion:** nvim-cmp + LuaSnip + friendly-snippets
- **Treesitter:** full parse-tree highlighting + context + textobjects
- **UI:** noice.nvim + nvim-notify (command line overhaul), nvim-tree, dropbar (breadcrumbs), lualine (macro-recording indicator)
- **Git:** gitsigns, vim-fugitive, vim-rhubarb
- **Navigation:** Telescope (fzf-native + ui-select), arrow.nvim configured for AZERTY keyboards
- **AI:** gen.nvim connecting to a local Ollama instance — lazy-loads only when `ollama` is detected on `$PATH`

### Zsh

Oh My Zsh-based config with Starship overriding the prompt entirely.

- **Plugins:** `git`, `vi-mode`, `docker`, `docker-compose`, `zsh-autosuggestions`, `zsh-syntax-highlighting`
- **Smart aliases:** `ls` → `eza`, `ll` → `eza -la`, `lt` → `eza -la` sorted by modified time, `grep` → `rg`, `cat` → `batcat`, `vim` → `nvim`
- **Suffix aliases:** `.md`, `.rs`, `.yaml`, `.json` files open directly in the right viewer when typed as a command
- **Global aliases:** `C` pipes to clipboard (`clipcopy`), `H` pages `--help` output through bat
- **Functions:** `ij [path]` launches IntelliJ IDEA detached from the terminal
- **History:** 5000 entries, shared across sessions, deduplicated

### Ghostty

A GPU-accelerated terminal emulator that starts fast and stays fast.

- Theme: **Gruvbox Dark Hard**
- Font size: 12
- Pane resize: `Alt+Ctrl+Shift+Arrows`

### Starship

A highly informative prompt that stays out of the way when you don't need it.

- Timestamp on line 1, everything else below
- Custom modules: **Quarkus** 🏃 (detects `pom.xml`/`build.gradle` with `io.quarkus`), **🐧 Linux** indicator, **Zsh shell** icon
- All standard modules (git, language versions, Kubernetes context, etc.) use a consistent `[symbol version]` bracket style

### gitui

A terminal UI for git that makes staging hunks and browsing history actually pleasant.

- Ships with all four **Catppuccin** theme variants (frappe, latte, macchiato, mocha)
- Custom keybindings for muscle-memory consistency

### k9s

Kubernetes cluster management from the terminal, the way it should be.

- Skin: **Gruvbox Dark**
- Custom resource aliases: `dp` (deployments), `sec` (secrets), `jo` (jobs), `cr` (clusterroles), `crb` (clusterrolebindings), `ro` (roles), `rb` (rolebindings), `np` (networkpolicies)
- Log tail: 10,000 lines

### opencode

An AI coding assistant with a full custom agent pipeline and tool configuration.

- **Runtime:** Bun
- **Plugins:** `cc-safety-net` (commit guardrails), `@slkiser/opencode-quota` (token tracking), `@mohak34/opencode-notifier` (desktop notifications)
- **MCP servers:**
  - `context7` — up-to-date library documentation
  - `youtube-transcript` — fetch video transcripts as context
  - `github` — read-only GitHub access (repos, security advisories, Actions)
- **Custom agents:** 11 agents including Orchestrator, Planner, Coder, Reviewer, Security Reviewer, Feature Designer, Librarian, and more — a full AI-assisted development pipeline
- **Custom LSP:** `jdtls-lombok` — Java language server with Lombok annotation processing pre-wired

### bat

Used as the default `cat` replacement throughout the shell config (including help paging). Config lives in `.config/bat/`.

### IdeaVim

Vim emulation for IntelliJ IDEA and other JetBrains IDEs. Config is in `.config/ideavimrc/`.

---

## ⚠️ Notes & Caveats

- **`.gitconfig` is not symlinked** — it contains my name, email, and signing key. You'll need your own.
- **`~/.secrets` is not in this repo** — create it yourself and put your API keys / tokens there. It's sourced automatically by `.zshrc` if it exists.
- **`sjvm`** (my custom JVM version switcher) is a separate Rust project at `~/projects/rust/sjvm`. It's not included here.
- **Ollama** is optional — `gen.nvim` only loads if `ollama` is on your `$PATH`. No Ollama, no AI features, no errors.
- **AZERTY layout** — `arrow.nvim` navigation is tuned for an AZERTY keyboard. QWERTY users will want to remap.
- **IntelliJ Toolbox paths** are hardcoded in `.zshrc`. Adjust the `PATH` entries if your Toolbox is installed elsewhere.

---
