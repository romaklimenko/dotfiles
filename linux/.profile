# ============================================================================
# .profile - Login shell configuration (POSIX-compliant)
# Author: Roman Klimenko (@romaklimenko)
# ============================================================================

# This file is executed by the command interpreter for login shells.
# It should be kept POSIX-compliant for maximum compatibility.

# -----------------------------------------------------------------------------
# PATH Configuration
# -----------------------------------------------------------------------------

# Add user's private bin if it exists
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi

# Add user's local bin if it exists
if [ -d "$HOME/.local/bin" ] ; then
    PATH="$HOME/.local/bin:$PATH"
fi

# -----------------------------------------------------------------------------
# Shell-Specific Configuration
# -----------------------------------------------------------------------------

# If running bash, source .bashrc
if [ -n "$BASH_VERSION" ]; then
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi
fi

# If running zsh (and not already sourced)
if [ -n "$ZSH_VERSION" ]; then
    if [ -f "$HOME/.zshrc" ]; then
        . "$HOME/.zshrc"
    fi
fi

# -----------------------------------------------------------------------------
# Environment Variables (applicable to all shells)
# -----------------------------------------------------------------------------

# Set default editor
export EDITOR=nvim
export VISUAL=nvim

# Set language environment
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# -----------------------------------------------------------------------------
# XDG Base Directory Specification
# -----------------------------------------------------------------------------

export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"

# -----------------------------------------------------------------------------
# Application-Specific Environment Variables
# -----------------------------------------------------------------------------

# Go
if [ -d "/usr/local/go/bin" ]; then
    export PATH="$PATH:/usr/local/go/bin"
fi
if [ -d "$HOME/go/bin" ]; then
    export PATH="$PATH:$HOME/go/bin"
fi

# Rust
if [ -d "$HOME/.cargo/bin" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Node.js (nvm)
export NVM_DIR="$HOME/.nvm"

# -----------------------------------------------------------------------------
# Local Overrides
# -----------------------------------------------------------------------------

# Source local profile if it exists (gitignored)
if [ -f "$HOME/.profile.local" ]; then
    . "$HOME/.profile.local"
fi
