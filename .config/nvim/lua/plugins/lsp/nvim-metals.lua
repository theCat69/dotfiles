local M = {}

function M.setup()
  local metals_config = require("metals").bare_config()
  metals_config.on_attach = require("plugins.utils.lsp").on_attach
  vim.api.nvim_create_autocmd("FileType", {
    pattern = { "scala", "sbt", "java" },
    group = vim.api.nvim_create_augroup("nvim-metals", { clear = true }),
    callback = function()
      require("metals").initialize_or_attach(metals_config)
    end,
  })
end

return M
