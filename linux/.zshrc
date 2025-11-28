# ============================================================================
# .zshrc - Zsh configuration
# Author: Roman Klimenko (@romaklimenko)
# ============================================================================

# Path to your oh-my-zsh installation (if installed)
# export ZSH="$HOME/.oh-my-zsh"

# -----------------------------------------------------------------------------
# Theme
# -----------------------------------------------------------------------------

# Set oh-my-zsh theme (if oh-my-zsh is installed)
# ZSH_THEME="robbyrussell"

# -----------------------------------------------------------------------------
# History Configuration
# -----------------------------------------------------------------------------

HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000

# Share history across all sessions
setopt SHARE_HISTORY

# Append to history file immediately
setopt INC_APPEND_HISTORY

# Don't record duplicate commands
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS

# Remove older duplicate entries from history
setopt HIST_EXPIRE_DUPS_FIRST

# Don't record commands that start with a space
setopt HIST_IGNORE_SPACE

# Remove superfluous blanks from each command line
setopt HIST_REDUCE_BLANKS

# -----------------------------------------------------------------------------
# Environment Variables
# -----------------------------------------------------------------------------

# Set default editor to Neovim
export EDITOR=nvim
export VISUAL=nvim

# Enable colors for ls
export CLICOLOR=1

# Less configuration
export LESS='-R -F -X'
export LESSHISTFILE=-

# -----------------------------------------------------------------------------
# Zsh Options
# -----------------------------------------------------------------------------

# Enable auto-cd (type directory name to cd into it)
setopt AUTO_CD

# Correct minor spelling errors in commands
setopt CORRECT

# Correct spelling errors in arguments
# setopt CORRECT_ALL

# Enable extended globbing
setopt EXTENDED_GLOB

# Don't beep on errors
setopt NO_BEEP

# Allow comments in interactive mode
setopt INTERACTIVE_COMMENTS

# -----------------------------------------------------------------------------
# Completion Configuration
# -----------------------------------------------------------------------------

# Enable completion system
autoload -Uz compinit
compinit

# Case-insensitive completion
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'

# Use menu for completion
zstyle ':completion:*' menu select

# Cache completions
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path ~/.zsh/cache

# Colorful completion
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

# -----------------------------------------------------------------------------
# WSL-Specific Configuration
# -----------------------------------------------------------------------------

# Detect if running in WSL
if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
    # Set DISPLAY for GUI applications (WSL2)
    if [ -z "$DISPLAY" ]; then
        export DISPLAY=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):0
    fi

    # WSL-specific aliases
    alias explorer='explorer.exe'
    alias cmd='cmd.exe'
    alias powershell='powershell.exe'

    # Navigate to Windows home
    alias winhome='cd /mnt/c/Users/$USER'
fi

# -----------------------------------------------------------------------------
# Key Bindings
# -----------------------------------------------------------------------------

# Use emacs key bindings (or use "bindkey -v" for vi mode)
bindkey -e

# History search with arrow keys
bindkey '^[[A' history-search-backward
bindkey '^[[B' history-search-forward

# Delete key
bindkey '^[[3~' delete-char

# Home and End keys
bindkey '^[[H' beginning-of-line
bindkey '^[[F' end-of-line

# -----------------------------------------------------------------------------
# Oh-My-Zsh Configuration (uncomment if using oh-my-zsh)
# -----------------------------------------------------------------------------

# Plugins (uncomment and modify as needed)
# plugins=(
#     git
#     docker
#     docker-compose
#     kubectl
#     python
#     pip
#     virtualenv
#     command-not-found
#     zsh-autosuggestions
#     zsh-syntax-highlighting
# )

# Load oh-my-zsh (uncomment if installed)
# source $ZSH/oh-my-zsh.sh

# -----------------------------------------------------------------------------
# Prompt Configuration (if not using oh-my-zsh)
# -----------------------------------------------------------------------------

# Load version control info for prompt
autoload -Uz vcs_info
precmd() { vcs_info }

# Format the vcs_info_msg_0_ variable
zstyle ':vcs_info:git:*' formats ' [%b]'

# Enable substitution in the prompt
setopt PROMPT_SUBST

# Set prompt (simple colored prompt)
PROMPT='%F{green}%n@%m%f:%F{blue}%~%f%F{yellow}${vcs_info_msg_0_}%f$ '

# -----------------------------------------------------------------------------
# Aliases
# -----------------------------------------------------------------------------

# Source bash aliases (they work in Zsh too)
if [ -f ~/dotfiles/linux/.bash_aliases ]; then
    source ~/dotfiles/linux/.bash_aliases
elif [ -f ~/.bash_aliases ]; then
    source ~/.bash_aliases
fi

# Zsh-specific aliases
alias -g L='| less'
alias -g G='| grep'
alias -g H='| head'
alias -g T='| tail'

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------

# Make directory and cd into it
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# Quick navigation to dotfiles
dots() {
    cd ~/dotfiles
}

# -----------------------------------------------------------------------------
# Local Overrides
# -----------------------------------------------------------------------------

# Source local zshrc if it exists (gitignored)
if [ -f ~/.zshrc.local ]; then
    source ~/.zshrc.local
fi

# -----------------------------------------------------------------------------
# Performance Optimization
# -----------------------------------------------------------------------------

# Skip global compinit for faster startup (uncomment if needed)
# skip_global_compinit=1
