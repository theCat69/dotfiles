<!-- Demonstrates the local M = {} module pattern used for plugin setup modules in this project -->

```lua
-- lua/plugins/ui/example.lua
local M = {}

function M.setup()
  require("example").setup({})
end

return M
```
