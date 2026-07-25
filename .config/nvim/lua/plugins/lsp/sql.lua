local M = {}

function M.setup()
  vim.g.db_ui_use_nerd_fonts = 1
  vim.keymap.set("n", "<leader>sql", "<Cmd>DBUIToggle<CR>")
end

return M
