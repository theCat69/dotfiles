-- Put this somewhere in your config (e.g. lua/keymaps.lua)

local function prettier_available()
  if vim.fn.executable("prettierd") then
    return true
  end
  -- Check that npx exists
  if vim.fn.executable("npx") ~= 1 then
    return false
  end

  -- Check that prettier is available via npx
  local result = vim.fn.system({ "npx", "prettier", "--version" })
  return vim.v.shell_error == 0
end

local function format_with_prettier(bufnr)
  bufnr = bufnr or vim.api.nvim_get_current_buf()

  local filename = vim.api.nvim_buf_get_name(bufnr)
  if filename == "" then
    return
  end

  local text = table.concat(
    vim.api.nvim_buf_get_lines(bufnr, 0, -1, false),
    "\n"
  )

  vim.system(
    { "prettierd", "--stdin-filepath", filename },
    { stdin = text },
    function(result)
      if result.code ~= 0 then
        vim.notify(result.stderr, vim.log.levels.ERROR)
        return
      end

      local lines = vim.split(result.stdout, "\n", { plain = true })

      vim.schedule(function()
        vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
      end)
    end
  )
end

vim.api.nvim_create_autocmd("FileType", {
  pattern = {
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "html",
    "htmlangular",
    "css",
    "scss",
  },
  callback = function(args)
    if not prettier_available() then
      return
    end

    -- Buffer-local keymap
    vim.keymap.set(
      "n",
      "<A-l>",
      function()
        format_with_prettier(args.buf)
      end,
      {
        buffer = args.buf,
        desc = "Format with Prettier",
        silent = true,
      }
    )
  end,
})
