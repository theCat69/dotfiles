local M = {}

local packages = {
  "morhetz/gruvbox",
  "nvim-lualine/lualine.nvim",
  "nvim-tree/nvim-web-devicons",
  "nvim-tree/nvim-tree.lua",
  "nvim-lua/plenary.nvim",
  "nvim-telescope/telescope.nvim",
  "nvim-telescope/telescope-ui-select.nvim",
  "Bekaboo/dropbar.nvim",
  "MunifTanjim/nui.nvim",
  "rcarriga/nvim-notify",
  "folke/noice.nvim",
  "otavioschwanck/arrow.nvim",
  "lewis6991/gitsigns.nvim",
  "tpope/vim-fugitive",
  "tpope/vim-rhubarb",
  "nvim-treesitter/nvim-treesitter",
  "nvim-treesitter/nvim-treesitter-context",
  "nvim-treesitter/nvim-treesitter-textobjects",
  "lewis6991/async.nvim",
  "ThePrimeagen/refactoring.nvim",
  "hrsh7th/nvim-cmp",
  "hrsh7th/cmp-nvim-lsp",
  "L3MON4D3/LuaSnip",
  "saadparwaiz1/cmp_luasnip",
  "theCat69/friendly-snippets",
  "numToStr/Comment.nvim",
  "windwp/nvim-autopairs",
  "neovim/nvim-lspconfig",
  "williamboman/mason.nvim",
  "theHamsta/nvim-dap-virtual-text",
  "nvim-neotest/nvim-nio",
  "rcarriga/nvim-dap-ui",
  "mfussenegger/nvim-dap",
  "ckipp01/nvim-jenkinsfile-linter",
  "chr4/nginx.vim",
  "kristijanhusak/vim-dadbod",
  "kristijanhusak/vim-dadbod-completion",
  "kristijanhusak/vim-dadbod-ui",
  "scalameta/nvim-metals",
  "David-Kunz/gen.nvim",
}

local eager_setups = {
  "plugins.ui.theme",
  "plugins.ui.lualine",
  "plugins.ui.nvim-tree",
  "plugins.jumping.telescope",
  "plugins.ui.dropbar",
  "plugins.jumping.arrow",
  "plugins.git.git",
  "plugins.no-lsp.treesitter",
  "plugins.no-lsp.refactoring",
  "plugins.no-lsp.cmp",
  "plugins.no-lsp.misc",
}

function M.setup()
  vim.pack.add(vim.tbl_map(function(repository)
    return { src = "https://github.com/" .. repository }
  end, packages))

  for _, module_name in ipairs(eager_setups) do
    require(module_name).setup()
  end

  require("plugins.ui.noice").setup_when_idle()
  require("plugins.lsp.lsp").setup()
  require("plugins.lsp.sql").setup()
  require("plugins.lsp.nvim-metals").setup()
  require("plugins.ai.gen").setup()
end

return M
