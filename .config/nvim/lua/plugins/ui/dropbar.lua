local function config()
  vim.keymap.set('n', '<leader>db', require('dropbar.api').pick)
end

local M = {}

function M.setup()
  config()
end

return M
