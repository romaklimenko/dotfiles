# ============================================================================
# .profile - login shells on Ubuntu (bash, sh)
# Author: Roman Klimenko (@romaklimenko)
#
# Installed as a link: ~/.profile -> $DOTFILES_HOME/shell/.profile
# Keep it POSIX: sh and dash read it too. zsh reads .zprofile instead.
# ============================================================================

# The folder this file really lives in, through the ~/.profile link.
_dotfiles_shell=$(dirname "$(readlink -f "$HOME/.profile" 2>/dev/null || echo "$HOME/.profile")")
[ -r "$_dotfiles_shell/env.sh" ] || _dotfiles_shell="${DOTFILES_HOME:-${DEV_HOME:-$HOME/Work}/dotfiles}/shell"
[ -n "$DOTFILES_HOME" ] || DOTFILES_HOME=$(dirname "$_dotfiles_shell")
export DOTFILES_HOME

# DEV_HOME, PATH and EDITOR.
[ -r "$_dotfiles_shell/env.sh" ] && . "$_dotfiles_shell/env.sh"
unset _dotfiles_shell

# Machine-specific settings, kept out of this public repository.
[ -r "$HOME/.profile.local" ] && . "$HOME/.profile.local"

# bash reads .bashrc only in shells that aren't login shells, so load it here.
if [ -n "$BASH_VERSION" ] && [ -r "$HOME/.bashrc" ]; then
    . "$HOME/.bashrc"
fi
