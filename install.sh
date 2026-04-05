#!/usr/bin/zsh

# needed dependencies :
# zsh, o-my-zsh, rust, starship, neovim, node, gitui,
# zoxide, nvm, sjvm

# .zshrc
ln -sf $(pwd)/.zshrc ~/.zshrc

# gitconfig uncommented only if you are me
# ln -sf $(pwd)/.gitconfig ~/.gitconfig

# ghostty
ln -sf $(pwd)/.config/ghostty ~/.config/

# starship
ln -sf $(pwd)/.config/starship.toml ~/.config/starship.toml

# nvim
ln -sf $(pwd)/.config/nvim ~/.config/

# gitui
ln -sf $(pwd)/.config/gitui ~/.config/

# opencode
ln -sf $(pwd)/.config/opencode ~/.config/
