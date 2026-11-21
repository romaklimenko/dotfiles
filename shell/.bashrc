# ============================================================================
# .bashrc - bash on Ubuntu, and on macOS when bash is started by hand
# Author: Roman Klimenko (@romaklimenko)
#
# Installed as a link: ~/.bashrc -> $DOTFILES_HOME/shell/.bashrc
# ============================================================================

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# The folder this file really lives in, through the ~/.bashrc link.
_dotfiles_shell=$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")
[ -r "$_dotfiles_shell/env.sh" ] || _dotfiles_shell="${DOTFILES_HOME:-${DEV_HOME:-$HOME/Work}/dotfiles}/shell"
[ -n "$DOTFILES_HOME" ] || DOTFILES_HOME=$(dirname "$_dotfiles_shell")
export DOTFILES_HOME

# DEV_HOME, PATH and EDITOR.
[ -r "$_dotfiles_shell/env.sh" ] && . "$_dotfiles_shell/env.sh"

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
  elif [ -n "$HOMEBREW_PREFIX" ] && [ -f "$HOMEBREW_PREFIX/etc/profile.d/bash_completion.sh" ]; then
    . "$HOMEBREW_PREFIX/etc/profile.d/bash_completion.sh"
  fi
fi

# -----------------------------------------------------------------------------
# Aliases
# -----------------------------------------------------------------------------

# Shared with zsh: workspaces, ws, dotsync, Databricks.
[ -r "$_dotfiles_shell/aliases.sh" ] && . "$_dotfiles_shell/aliases.sh"

# The oh-my-zsh names for git, ls and the rest, so bash matches zsh.
[ -r "$_dotfiles_shell/.bash_aliases" ] && . "$_dotfiles_shell/.bash_aliases"

# ws completes the workspaces in $DEV_HOME, and the folders here.
_ws() {
    local IFS=$'\n'
    COMPREPLY=($(cd "$DEV_HOME" 2>/dev/null && compgen -d -- "${COMP_WORDS[COMP_CWORD]}"))
}
complete -o dirnames -F _ws ws

unset _dotfiles_shell

# -----------------------------------------------------------------------------
# Local Overrides
# -----------------------------------------------------------------------------

# Machine-specific settings and secrets, kept out of this public repository.
if [ -f ~/.bashrc.local ]; then
    . ~/.bashrc.local
fi
