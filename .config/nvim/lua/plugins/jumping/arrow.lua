-- a replacement for harpoon
local function config()
  require('arrow').setup({
    show_icons = true,
    leader_key = ';', -- Recommended to be a single key
    window = {        -- controls the appearance and position of an arrow window (see nvim_open_win() for all options)
      width = 50,
      height = "auto",
      row = "auto",
      col = "auto",
      border = "double",
    },
    index_keys = "azrtyuiopAZERTYUIOP123456789"
  })
end

local M = {}

function M.setup()
  config()
end

return M
