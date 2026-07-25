local M = {}

local servers = {
  "clangd",
  "rust_analyzer",
  "pyright",
  "lua_ls",
  "yamlls",
  "lemminx",
  "emmet_ls",
  "kotlin_language_server",
  "html",
  "cssls",
  "bashls",
  "jsonls",
  "tailwindcss",
  "zls",
  "dockerls",
  "solidity_ls",
  "taplo",
  "angularls",
  "ts_ls",
  "gopls",
}

local mason_packages = {
  clangd = "clangd",
  rust_analyzer = "rust-analyzer",
  pyright = "pyright",
  lua_ls = "lua-language-server",
  yamlls = "yaml-language-server",
  lemminx = "lemminx",
  emmet_ls = "emmet-language-server",
  kotlin_language_server = "kotlin-language-server",
  html = "html-lsp",
  cssls = "css-lsp",
  bashls = "bash-language-server",
  jsonls = "json-lsp",
  tailwindcss = "tailwindcss-language-server",
  zls = "zls",
  dockerls = "dockerfile-language-server",
  solidity_ls = "solidity-ls",
  taplo = "taplo",
  angularls = "angular-language-server",
  ts_ls = "typescript-language-server",
  gopls = "gopls",
}

local function install_missing_servers()
  local registry = require("mason-registry")
  registry.refresh(function()
    local missing_servers = {}

    for _, package_name in pairs(mason_packages) do
      if not registry.has_package(package_name) then
        vim.notify("Mason package not found: " .. package_name, vim.log.levels.WARN)
      else
        local package = registry.get_package(package_name)
        if not package:is_installed() then
          table.insert(missing_servers, package_name)
          package:install(nil, function(success, error_message)
            if not success then
              vim.schedule(function()
                vim.notify(
                  "Mason could not install " .. package_name .. ": " .. tostring(error_message),
                  vim.log.levels.ERROR
                )
              end)
            end
          end)
        end
      end
    end

    if #missing_servers > 0 then
      vim.notify(
        "Mason is installing language servers. Restart Neovim after installation completes.",
        vim.log.levels.INFO
      )
    end
  end)
end

function M.setup()
  require("mason").setup({
    registries = {
      "github:nvim-java/mason-registry",
      "github:mason-org/mason-registry",
    },
  })
  install_missing_servers()
  require("plugins.lsp.lsp-server-config").setup(servers)
  require("plugins.lsp.dap").setup()
end

return M
