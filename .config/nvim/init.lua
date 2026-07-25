require("before")
require("file-autocmd")

if vim.fn.has("nvim-0.12") == 0 then
  error("This configuration requires Neovim 0.12 or newer")
end

require("packages").setup()
