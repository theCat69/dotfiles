<!-- Demonstrates Zsh alias definitions and PATH extension patterns from .zshrc -->

```zsh
# .zshrc
# Pattern: Replace standard commands with modern alternatives using aliases

# Drop-in replacements
alias ls="eza"                              # modern ls with color + icons
alias ll="eza -la"                          # long listing
alias lt="eza -la -t modified -s modified"  # sort by modified time
alias grep="rg"                             # ripgrep — faster grep
alias cat="batcat -p --pager=never"         # bat — syntax-highlighted cat
alias vim="nvim"

# Suffix aliases — auto-open file types with the right tool
alias -s md="batcat"                        # .md files → batcat
alias -s rs="$EDITOR"                       # .rs files → editor
alias -s yaml="batcat -l yaml"              # .yaml files → batcat with yaml highlighting
alias -s json="jless"                       # .json files → jless TUI

# Global aliases — pipe shortcuts
alias -g C="| clipcopy"                     # append to pipe with C
alias -g P="clippaste"                      # paste from clipboard
alias -g H="--help 2>&1 | batcat --language=help -p"  # pretty help

# PATH extensions — prepend tool-specific paths
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"        # bun runtime
export PATH=~/.local/bin:$PATH              # local user binaries
export PATH=/opt/nvim:$PATH                 # neovim binary

# Function alias (for tools that need background launch)
ij() {
  if [[ -n "$1" ]]; then
    idea "$1" &> /dev/null & disown         # open project in IntelliJ
  else
    idea &> /dev/null & disown              # open IntelliJ with no project
  fi
}
```
