# needed dependencies : 
# zsh, o-my-zsh, rust, starship, neovim, node, gitui, 
# zoxide, nvm, sjvm

# .zshrc
rm -f ~/.zshrc
ln -s $(pwd)/.zshrc ~/.zshrc

# gitconfig
rm -f ~/.gitconfig
ln -s $(pwd)/.gitconfig ~/.gitconfig

# ghostty
rm -rf ~/.config/ghostty
ln -s $(pwd)/.config/ghostty/ ~/.config/

# starship
rm -f ~/.config/starship.toml
ln -s $(pwd)/.config/starship.toml ~/.config/starship.toml

# nvim
rm -rf ~/.config/nvim
ln -s $(pwd)/.config/nvim/ ~/.config/

# gitui
rm -rf ~/.config/gitui
ln -s $(pwd)/.config/gitui/ ~/.config/

# hyprland
rm -rf ~/.config/hypr
ln -s $(pwd)/.config/hypr/ ~/.config/

# waybar
rm -rf ~/.config/waybar
ln -s $(pwd)/.config/waybar/ ~/.config/
