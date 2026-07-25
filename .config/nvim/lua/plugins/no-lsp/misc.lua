-- Enable Comment.nvim
-- "gc" to comment visual regions/lines

local function config_comment()
  require('Comment').setup()
end

local function config_autopairs()
  require("nvim-autopairs").setup({})
end

local M = {}

function M.setup()
  config_comment()
  config_autopairs()
end

return M
