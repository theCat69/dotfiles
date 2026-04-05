<!-- Demonstrates the lazy.nvim plugin spec pattern with filetype-based lazy loading -->

```lua
-- lua/plugins/lsp/lsp.lua
-- Pattern: LazyPluginSpec[] — a file returning multiple plugin specs
-- with filetype + command triggers for lazy loading

-- filetypes that trigger loading these plugins
local ft = {
  "lua", "sql", "rust", "xml", "json", "solidity", "typescript", "javascript", "html", "css",
  "python", "kotlin", "zig", "docker", "toml", "yaml", "c", "bash", "go", "typescriptreact", "sh"
}

-- Commands that also trigger loading
local cmd = { "MasonUpdate", "MasonUpdateAll" }

-- servers automatically installed by mason
local servers = { 'clangd', 'rust_analyzer', 'pyright', 'lua_ls', 'yamlls', 'lemminx', 'emmet_ls',
  'kotlin_language_server', 'html', 'cssls', 'bashls', 'jsonls', 'tailwindcss', 'zls', 'dockerls', 'solidity_ls',
  'taplo', 'angularls', 'ts_ls', 'gopls' }

local function config()
  require("mason-lspconfig").setup {
    ensure_installed = servers,
    automatic_installation = true,
  }
end

---@type LazyPluginSpec[]   -- annotate the return type for lua_ls
return {
  {
    config = config,
    ft = ft,           -- lazy: load only when one of these filetypes opens
    cmd = cmd,         -- lazy: also load when one of these commands is run
    "neovim/nvim-lspconfig",
    dependencies = {
      {
        "williamboman/mason.nvim",
        opts = {}
      },
      "williamboman/mason-lspconfig.nvim",
    }
  },
  {
    -- Single-filetype lazy loading
    "simrat39/rust-tools.nvim",
    ft = "rust"
  },
}
```
