local M = {}

function M.setup_when_requested()
  vim.keymap.set("n", "<leader>mt", function()
    vim.pack.add({ { src = "https://github.com/milanglacier/minuet-ai.nvim" } })
    M.setup()
    vim.cmd("Minuet virtualtext enable")
  end, { desc = "Enable Minuet completion" })
end

function M.setup()
  if M.is_configured then
    return
  end

  require("minuet").setup({
    provider = "openai_fim_compatible",
    n_completions = 1,
    context_window = 1024,
    throttle = 400,
    debounce = 300,
    cmp = {
      enable_auto_complete = false,
    },
    blink = {
      enable_auto_complete = false,
    },
    provider_options = {
      openai_fim_compatible = {
        api_key = "TERM",
        name = "Ollama",
        end_point = "http://127.0.0.1:11434/v1/completions",
        model = "qwen2.5-coder:3b",
        optional = {
          max_tokens = 36,
          stop = { "\n" },
          top_p = 0.9,
        },
      },
    },
    virtualtext = {
      auto_trigger_ft = { "*" },
      auto_trigger_ignore_ft = { "TelescopePrompt", "help", "markdown", "text" },
      keymap = {
        accept = "<M-a>",
        accept_line = "<Tab>",
        accept_n_lines = "<leader><Tab>",
        prev = "<M-f>",
        next = "<M-d>",
        dismiss = "<M-e>",
      },
    },
  })

  M.is_configured = true
end

return M
