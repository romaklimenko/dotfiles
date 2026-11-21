# ============================================================================
# .zprofile - zsh login shells
# Author: Roman Klimenko (@romaklimenko)
#
# Installed as a link: ~/.zprofile -> $DOTFILES_HOME/shell/.zprofile
#
# On macOS every new terminal window and tmux pane is a login shell. Before
# this file runs, /etc/zprofile calls path_helper, which moves the system
# folders to the front of PATH. env.sh puts Homebrew, cargo and ~/.local/bin
# back in front. Tools that run commands in a login shell without .zshrc get
# the same PATH and DEV_HOME.
# ============================================================================

_dotfiles_shell="${${(%):-%x}:A:h}"
export DOTFILES_HOME="${DOTFILES_HOME:-${_dotfiles_shell:h}}"
source "$_dotfiles_shell/env.sh"
unset _dotfiles_shell
