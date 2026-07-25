# Neovim

Full IDE-grade editor config for Neovim 0.12+, tuned for a polyglot workflow on Kubuntu. Plugins are installed and loaded with native `vim.pack`; the entire config lives in `lua/` and is organised by category (`lsp/`, `ui/`, `git/`, `ai/`, etc.).

## Theme

Gruvbox Dark — auto-detects light/dark terminal background, transparent background, mode-coloured blinking cursor.

## LSP

20+ language servers installed by [Mason](https://github.com/williamboman/mason.nvim) and configured with native `vim.lsp.config()` / `vim.lsp.enable()`:
`clangd`, `rust_analyzer`, `pyright`, `lua_ls`, `ts_ls`, `gopls`, `kotlin_language_server`, `angularls`, `tailwindcss`, `zls`, `solidity_ls`, `yamlls`, `bashls`, `dockerls`, and more.

On a fresh setup Mason installs missing servers in the background. Restart Neovim after installation completes before opening buffers that need those servers.

## Language Extras

- **Scala:** nvim-metals
- **Debug:** nvim-dap + dapui (visual debug adapter for most languages)
- **Jenkins:** Jenkinsfile linter

## Completion

nvim-cmp + LuaSnip + friendly-snippets.

## Treesitter

Full parse-tree highlighting, context display, and text-object selection.
Install the configured parsers with `:TSInstallConfigured` after the first plugin installation.

## UI

- [noice.nvim](https://github.com/folke/noice.nvim) + nvim-notify — command line and notification overhaul
- nvim-tree — file explorer
- dropbar — breadcrumb navigation
- lualine — status line with macro-recording indicator

## Git

gitsigns (inline diff), vim-fugitive, vim-rhubarb (GitHub integration).

## Navigation

[Telescope](https://github.com/nvim-telescope/telescope.nvim) with ui-select. [arrow.nvim](https://github.com/otavioschwanck/arrow.nvim) configured for AZERTY keyboards.

## AI

[gen.nvim](https://github.com/David-Kunz/gen.nvim) connecting to a local [Ollama](https://ollama.com/) instance. It is configured only when `ollama` is detected on `$PATH`.
