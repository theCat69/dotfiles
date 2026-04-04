<!-- Demonstrates the local M = {} module pattern used for utility modules in this project -->

```lua
-- lua/plugins/lazy-utils.lua
-- Pattern: M-module — encapsulate utilities in a local table, return it

---Helper to integrate plugin files into lazy setup
---@class LazyUtils             -- LuaDoc class annotation for lua_ls
local M = {}

local plugins = {}             -- private state — not exposed directly

---Register one or more plugins
---@param plug LazyPluginSpec|LazyPluginSpec[]   -- typed parameter
function M.register_plugin(plug)
  local pluginSpec = unpack(plug)
  -- this means the file returned a LazyPluginSpec (not an array)
  if type(pluginSpec) ~= "table" then
    table.insert(plugins, plug)
  else -- assuming a LazyPluginSpec[] otherwise
    M.append_tables_array(plugins, plug)
  end
end

---@return LazyPluginSpec[]
function M.get_plugins()
  return plugins              -- expose via method, not direct field access
end

return M                      -- always return M at the end
```
