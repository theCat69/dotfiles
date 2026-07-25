local M = {}

function M.setup()
  if vim.fn.executable("ollama") ~= 1 then
    return
  end

  require("gen").setup({ display_mode = "split" })
end

return M
