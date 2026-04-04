<!-- Demonstrates vim.keymap.set usage patterns from this project's remap.lua -->

```lua
-- lua/before/remap.lua
-- Pattern: vim.keymap.set with multiple modes, expr, and silent options

-- Simple normal-mode mapping
vim.keymap.set({ 'n', 'v' }, '<Space>', '<Nop>', { silent = true })

-- Expression mapping (evaluates the RHS as vimscript expression)
vim.keymap.set('n', 'k', "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })

-- Mapping to a Lua function (preferred over vimscript strings)
vim.keymap.set('n', '<A-j>', function()
  vim.diagnostic.jump({ count = 1, float = true })
end)

-- With desc for which-key integration (always set desc on non-trivial mappings)
vim.keymap.set('n', '<leader>web', function()
  -- ... implementation ...
end, { desc = "Append string to the end of the buffer" })

-- OS-conditional mapping (cross-platform)
if string.find(vim.loop.os_uname().sysname, "NT") then
  vim.keymap.set("v", '<C-b>', '"*y')   -- Windows clipboard
else
  vim.keymap.set("v", '<C-b>', '"+y')   -- Linux/Mac clipboard
end
```
