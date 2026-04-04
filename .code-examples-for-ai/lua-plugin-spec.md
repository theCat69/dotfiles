<!-- Demonstrates the lazy.nvim plugin spec pattern with filetype-based lazy loading -->

```lua
-- lua/plugins/lsp/lsp.lua
-- Pattern: LazyPluginSpec[] — a file returning multiple plugin specs
-- with filetype + command triggers for lazy loading

-- filetypes that trigger loading these plugins
local ft = {
  "lua", "sql", "rust", "xml", "json", "typescript", "javascript",
  "html", "css", "python", "kotlin", "zig", "bash", "go", "sh"
}

-- Commands that also trigger loading
local cmd = { "MasonUpdate", "MasonUpdateAll" }

local function config()
  require("mason-lspconfig").setup {
    ensure_installed = { "lua_ls", "ts_ls", "rust_analyzer" },
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
      { "williamboman/mason.nvim", opts = {} },
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
