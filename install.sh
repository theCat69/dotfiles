#!/usr/bin/zsh

# needed dependencies : 
# zsh, o-my-zsh, rust, starship, neovim, node, gitui, 
# zoxide, nvm, sjvm

# .zshrc
ln -s $(pwd)/.zshrc ~/.zshrc

# gitconfig
ln -s $(pwd)/.gitconfig ~/.gitconfig

# ghostty
ln -s $(pwd)/.config/ghostty/ ~/.config/

# starship
ln -s $(pwd)/.config/starship.toml ~/.config/starship.toml

# nvim
ln -s $(pwd)/.config/nvim/ ~/.config/

# gitui
ln -s $(pwd)/.config/gitui ~/.config/
