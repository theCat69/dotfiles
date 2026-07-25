local keymap = "<leader>rr"

local function config()
  require('refactoring').setup({
    show_success_message = true
  })

  vim.keymap.set("v", keymap, function()
    require("refactoring").select_refactor()
  end, { desc = "Select refactoring" })
end

local M = {}

function M.setup()
  config()
end

return M
