<!-- Demonstrates vim.api.nvim_create_autocmd usage from set.lua -->

```lua
-- lua/before/set.lua
-- Pattern: nvim_create_autocmd with augroup for safe repeated sourcing

-- Create a named augroup with clear=true to prevent duplicate autocmds
-- when this file is re-sourced
local highlight_group = vim.api.nvim_create_augroup('YankHighlight', { clear = true })

vim.api.nvim_create_autocmd('TextYankPost', {
  callback = function()
    vim.highlight.on_yank()         -- Lua callback (preferred over vimscript)
  end,
  group = highlight_group,          -- always attach to a group
  pattern = '*',                    -- match all buffers
})

-- Pattern: autocmd to trigger plugin loading by FileType (from treesitter.lua)
vim.api.nvim_create_autocmd('FileType', {
  pattern = {
    'c', 'cpp', 'go', 'lua', 'py', 'rs', 'ts', 'java', 'scala',
    'yaml', 'kt', 'tsx', 'sh', 'groovy', 'zig', 'css', 'html',
  },
  callback = function()
    vim.treesitter.start()          -- start treesitter for the matched filetype
  end,
})
```
