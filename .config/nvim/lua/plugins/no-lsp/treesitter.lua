local M = {}

local filetypes = {
  "c",
  "cpp",
  "go",
  "lua",
  "py",
  "rs",
  "ts",
  "java",
  "scala",
  "yaml",
  "kt",
  "tsx",
  "sh",
  "groovy",
  "zig",
  "solidity",
  "gitcommit",
  "zsh",
  "css",
  "scss",
  "angular",
  "html",
  "regex",
}

local parsers = {
  "c",
  "cpp",
  "go",
  "lua",
  "python",
  "rust",
  "typescript",
  "java",
  "scala",
  "yaml",
  "kotlin",
  "tsx",
  "bash",
  "groovy",
  "zig",
  "solidity",
  "gitcommit",
  "zsh",
  "css",
  "scss",
  "angular",
  "html",
  "regex",
}

local function select_textobject(query)
  return function()
    require("nvim-treesitter-textobjects.select").select_textobject(query, "textobjects")
  end
end

function M.setup()
  vim.api.nvim_create_autocmd("FileType", {
    pattern = filetypes,
    callback = function()
      vim.treesitter.start()
    end,
  })

  require("treesitter-context").setup({ multiwindow = true })

  vim.keymap.set({ "x", "o" }, "af", select_textobject("@function.outer"), { desc = "Select outer function" })
  vim.keymap.set({ "x", "o" }, "if", select_textobject("@function.inner"), { desc = "Select inner function" })
  vim.keymap.set({ "x", "o" }, "ac", select_textobject("@class.outer"), { desc = "Select outer class" })
  vim.keymap.set({ "x", "o" }, "ic", select_textobject("@class.inner"), { desc = "Select inner class" })
  vim.keymap.set({ "x", "o" }, "as", select_textobject("@local.scope"), { desc = "Select local scope" })
  vim.api.nvim_create_user_command("TSInstallConfigured", function()
    require("nvim-treesitter").install(parsers)
  end, { desc = "Install configured Treesitter parsers" })
end

return M
