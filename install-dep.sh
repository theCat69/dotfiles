# Add repositories

# yay
sudo pacman -S --needed git base-devel
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
cd ..

# ghostty
sudo pacman -S zsh ghostty neovim waybar starship bat fzf zoxide gitui eza 

# rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
# sudo pacman -S zsh-autosuggestions zsh-syntax-highlighting

# nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# sjvm
# TODO i need to make a default configuration that i store also in dot files 
# TODO download a specific java version (21 ?)
# mkdir -p ~/projects/rust
# cd ~/projects/rust
# git clone https://github.com/theCat69/sjvm
# cd sjvm
# cargo build --release
