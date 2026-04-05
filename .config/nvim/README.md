# Neovim

Full IDE-grade editor config built on [lazy.nvim](https://github.com/folke/lazy.nvim), tuned for a polyglot workflow on Kubuntu. The entire config lives in `lua/` and is organised by category (`lsp/`, `ui/`, `git/`, `ai/`, etc.).

## Theme

Gruvbox Dark — auto-detects light/dark terminal background, transparent background, mode-coloured blinking cursor.

## LSP

20+ language servers managed by [Mason](https://github.com/williamboman/mason.nvim) with auto-update on startup:
`clangd`, `rust_analyzer`, `pyright`, `lua_ls`, `ts_ls`, `gopls`, `kotlin_language_server`, `angularls`, `tailwindcss`, `zls`, `solidity_ls`, `yamlls`, `bashls`, `dockerls`, and more.

## Language Extras

- **Rust:** rust-tools
- **Scala:** nvim-metals
- **Debug:** nvim-dap + dapui (visual debug adapter for most languages)
- **Jenkins:** Jenkinsfile linter

## Completion

nvim-cmp + LuaSnip + friendly-snippets.

## Treesitter

Full parse-tree highlighting, context display, and text-object selection.

## UI

- [noice.nvim](https://github.com/folke/noice.nvim) + nvim-notify — command line and notification overhaul
- nvim-tree — file explorer
- dropbar — breadcrumb navigation
- lualine — status line with macro-recording indicator

## Git

gitsigns (inline diff), vim-fugitive, vim-rhubarb (GitHub integration).

## Navigation

[Telescope](https://github.com/nvim-telescope/telescope.nvim) with fzf-native + ui-select. [arrow.nvim](https://github.com/otavioschwanck/arrow.nvim) configured for AZERTY keyboards.

## AI

[gen.nvim](https://github.com/David-Kunz/gen.nvim) connecting to a local [Ollama](https://ollama.com/) instance. Lazy-loads only when `ollama` is detected on `$PATH`.
