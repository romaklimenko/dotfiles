# ============================================================================
# .bashrc - Bash configuration
# Author: Roman Klimenko (@romaklimenko)
# ============================================================================

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# -----------------------------------------------------------------------------
# History Configuration
# -----------------------------------------------------------------------------

# Don't put duplicate lines or lines starting with space in the history
HISTCONTROL=ignoreboth

# Append to the history file, don't overwrite it
shopt -s histappend

# Set history size
HISTSIZE=10000
HISTFILESIZE=20000

# -----------------------------------------------------------------------------
# Shell Options
# -----------------------------------------------------------------------------

# Check the window size after each command and update LINES and COLUMNS
shopt -s checkwinsize

# Enable recursive globbing with **
shopt -s globstar 2>/dev/null

# Correct minor errors in directory spelling
shopt -s cdspell 2>/dev/null

# Autocorrect typos in path names when using cd
shopt -s dirspell 2>/dev/null

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
# Prompt Configuration
# -----------------------------------------------------------------------------

# Set a colored prompt if terminal supports it
case "$TERM" in
    xterm-color|*-256color) color_prompt=yes;;
esac

if [ "$color_prompt" = yes ]; then
    # Simple colored prompt: user@host:dir$
    PS1='\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
else
    PS1='\u@\h:\w\$ '
fi
unset color_prompt

# Set terminal title
case "$TERM" in
xterm*|rxvt*)
    PS1="\[\e]0;\u@\h: \w\a\]$PS1"
    ;;
*)
    ;;
esac

# -----------------------------------------------------------------------------
# Bash Completion
# -----------------------------------------------------------------------------

# Enable programmable completion features
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# -----------------------------------------------------------------------------
# Aliases
# -----------------------------------------------------------------------------

# Source bash aliases from separate file
if [ -f ~/dotfiles/linux/.bash_aliases ]; then
    . ~/dotfiles/linux/.bash_aliases
elif [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi

# -----------------------------------------------------------------------------
# Local Overrides
# -----------------------------------------------------------------------------

# Source local bashrc if it exists (gitignored)
if [ -f ~/.bashrc.local ]; then
    . ~/.bashrc.local
fi
