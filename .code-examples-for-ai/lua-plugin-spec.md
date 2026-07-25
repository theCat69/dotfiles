<!-- Demonstrates the native vim.pack package registry and plugin setup pattern -->

```lua
-- lua/packages.lua
local M = {}

local packages = {
  "nvim-lua/plenary.nvim",
  "nvim-telescope/telescope.nvim",
}

function M.setup()
  vim.pack.add(vim.tbl_map(function(repository)
    return { src = "https://github.com/" .. repository }
  end, packages))

  require("plugins.jumping.telescope").setup()
end

return M
```
