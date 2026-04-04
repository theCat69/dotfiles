<!-- Demonstrates the idempotent symlink install script pattern from install.sh -->

```zsh
#!/usr/bin/zsh
# install.sh — Dotfiles symlink installer
#
# Pattern: simple symlink-based installation using ln -sf (force-overwrite).
# ln -sf makes this idempotent — safe to re-run on the same machine.
# $(pwd) captures the repo root at runtime, so paths stay correct
# regardless of where the repo is cloned.
#
# Usage:
#   zsh install.sh

# needed dependencies:
# zsh, oh-my-zsh, rust, starship, neovim, node, gitui, zoxide, nvm, sjvm

# .zshrc — symlink from $HOME to repo
ln -sf $(pwd)/.zshrc ~/.zshrc

# ghostty terminal config — symlink entire directory
ln -sf $(pwd)/.config/ghostty ~/.config/

# starship prompt config
ln -sf $(pwd)/.config/starship.toml ~/.config/starship.toml

# nvim config directory
ln -sf $(pwd)/.config/nvim ~/.config/

# gitui config directory
ln -sf $(pwd)/.config/gitui ~/.config/

# opencode config directory
ln -sf $(pwd)/.config/opencode ~/.config/

# NOTE: .gitconfig is commented out — uncomment only on your own machine
# ln -sf $(pwd)/.gitconfig ~/.gitconfig
```
