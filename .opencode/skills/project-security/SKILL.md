---
name: project-security
description: Project-specific security guidelines for secrets, input validation, dependencies, auth, and common vulnerabilities
---

# Project Security Guidelines

---

## Secrets Management

### Shell / Zsh
- **Never commit secrets** (API keys, tokens, passwords) to the dotfiles repo
- Secrets are sourced from `~/.secrets` (not tracked by git):
  ```zsh
  if [[ -f ~/.secrets ]]; then
    source ~/.secrets
  fi
  ```
- `~/.secrets` must be in `.gitignore` (or equivalent — never in the dotfiles repo)
- Do **not** export secrets as environment variables visible in process listings (`/proc/<pid>/environ`)
- Use OS keychain / secret managers (1Password, GNOME Keyring) for sensitive credentials
- SSH private keys: never commit; use `chmod 600` on `~/.ssh/id_*` and `~/.ssh/config`

### Neovim (Lua)
- Never hardcode API keys or tokens in Lua config files
- Use `vim.env.MY_SECRET` to read from environment variables at runtime
- Never log or print objects that may contain secret values

### TypeScript (opencode plugin)
- Use `.env` files for local secrets — never commit `.env`
- Access via `process.env.SECRET_NAME` or `Bun.env.SECRET_NAME`
- `.env` must be in `.gitignore`
- Never serialize objects containing secret keys to logs or output

---

## Input Validation

### Shell scripts
```zsh
# Integer validation
typeset -i my_int_var

# String/regex validation before use
if [[ ! "$input" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "Invalid input" >&2
  exit 1
fi

# Sanitize paths to prevent path traversal
local safe_path
safe_path="$(realpath --canonicalize-missing -- "$input")"
```

- **Never use `eval`** with user-controlled input — command injection risk
- Always use `[[ ]]` (double brackets) with quoted variables in conditionals

### TypeScript
- Validate all external input with `zod` or equivalent schema validation
- Never trust data from `process.argv`, environment variables, or network without validation

---

## Dependency Security

### Neovim plugins (lazy.nvim)
- **Pin plugin versions** via `lazy-lock.json` — commit this file for reproducibility
- **Review plugin source** before installing — supply chain risk for shell/file-access plugins
- Disable unused built-in Neovim plugins to reduce attack surface:
  ```lua
  -- In lazy.nvim setup performance section:
  disabled_plugins = { "gzip", "matchit", "matchparen", "netrwPlugin", "tarPlugin", "tohtml", "tutor", "zipPlugin" }
  ```
- Use mason.nvim for LSP server management — avoids manual binary downloads from untrusted sources

### TypeScript / Bun
```bash
# Check for known vulnerabilities
bun audit

# Pin exact versions to prevent drift
bun add -E some-package
```

### Shell plugins (Oh My Zsh, zsh-autosuggestions, etc.)
- Review plugin source before sourcing in `.zshrc`
- Keep Oh My Zsh and plugins updated: `omz update`
- Be cautious with third-party Oh My Zsh plugins — they execute arbitrary code at shell startup

---

## Authentication & Authorization

Not applicable for a personal dotfiles repo. However:
- **Git commit signing** (recommended): use GPG or SSH key signing
  ```ini
  # .gitconfig
  [gpg]
    format = ssh
  [gpg "ssh"]
    program = op-ssh-sign   # 1Password agent
  [commit]
    gpgsign = true
  ```
- SSH config: use `~/.ssh/config` with `IdentityFile` per host — keep permissions `chmod 600`
- **1Password SSH agent** or similar: stores private keys in OS keychain, not on disk

---

## Common Vulnerabilities

### Shell scripts
| Vulnerability | Prevention |
|---|---|
| Command injection via `eval` | Never use `eval` with external input |
| Symlink attack on temp files | Use `mktemp -d` — never predict temp file names |
| Path traversal | Use `realpath` + validate before use |
| Unintentional `$IFS` word splitting | Always quote `"$variables"`, set `IFS=$'\n\t'` |
| Hardcoded credentials | Source from `~/.secrets`, use env vars |
| Insecure permissions | `chmod 700` scripts, `chmod 600` sensitive configs |

### Neovim / Lua
| Vulnerability | Prevention |
|---|---|
| Arbitrary code execution via plugins | Review plugins; pin versions in lazy-lock.json |
| Secrets in config | Use `vim.env.*` — never hardcode |
| Malicious LSP servers | Use mason.nvim from trusted registry only |

### TypeScript
| Vulnerability | Prevention |
|---|---|
| Dependency vulnerabilities | `bun audit` regularly |
| Prototype pollution | Validate external JSON before use |
| Type confusion | `strict: true` + `noUncheckedIndexedAccess: true` in tsconfig |
| Secrets in logs | Never serialize env objects containing tokens |

### Sensitive files that must never be committed
```
.env
*.pem
*.key
id_rsa
id_ed25519
.netrc
~/.secrets
```
