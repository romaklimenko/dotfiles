# ============================================================================
# .zshrc - zsh on macOS and Ubuntu, with oh-my-zsh
# Author: Roman Klimenko (@romaklimenko)
#
# Installed as a link: ~/.zshrc -> $DOTFILES_HOME/shell/.zshrc
# ============================================================================

# The folder this file really lives in, through the ~/.zshrc link.
_dotfiles_shell="${${(%):-%x}:A:h}"
export DOTFILES_HOME="${DOTFILES_HOME:-${_dotfiles_shell:h}}"

# DEV_HOME, PATH and EDITOR. .zprofile has loaded it already in login shells;
# loading it again covers shells that aren't login shells.
source "$_dotfiles_shell/env.sh"

# -----------------------------------------------------------------------------
# oh-my-zsh
# -----------------------------------------------------------------------------

export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"

plugins=(git common-aliases extract gh uv rust npm python codex)
if [[ $OSTYPE == darwin* ]]; then
    plugins+=(macos brew)
elif [[ -r /etc/os-release ]] && grep -q '^ID=ubuntu' /etc/os-release; then
    plugins+=(ubuntu)
fi

# Completions that Homebrew installs, such as databricks and gh. They have to
# be on fpath before oh-my-zsh runs compinit.
if [[ -n $HOMEBREW_PREFIX && -d $HOMEBREW_PREFIX/share/zsh/site-functions ]]; then
    fpath=("$HOMEBREW_PREFIX/share/zsh/site-functions" $fpath)
fi

if [[ -r $ZSH/oh-my-zsh.sh ]]; then
    source "$ZSH/oh-my-zsh.sh"
else
    print -u2 "oh-my-zsh is missing. Install it with: bash $DOTFILES_HOME/install/install.sh --local"
    autoload -Uz compinit && compinit
fi

# -----------------------------------------------------------------------------
# Options on top of oh-my-zsh
# -----------------------------------------------------------------------------

setopt CORRECT              # Offer a fix for a mistyped command name
setopt HIST_IGNORE_ALL_DUPS # Keep only the newest copy of a repeated command
setopt HIST_REDUCE_BLANKS
setopt NO_BEEP

# common-aliases makes rm, cp and mv ask before they delete or overwrite.
# Claude Code runs its commands with this shell's aliases and can't answer
# the question, so rm would quietly keep the file.
unalias rm cp mv 2>/dev/null

# -----------------------------------------------------------------------------
# Aliases and functions shared with bash: workspaces, ws, Databricks
# -----------------------------------------------------------------------------

source "$_dotfiles_shell/aliases.sh"

# ws completes the workspaces in $DEV_HOME, and the folders here.
_ws() {
    _alternative \
        "workspaces:workspace:_path_files -W ${(q)DEV_HOME} -/" \
        'folders:folder:_path_files -/'
}
(( $+functions[compdef] )) && compdef _ws ws

unset _dotfiles_shell

# -----------------------------------------------------------------------------
# Local overrides
# -----------------------------------------------------------------------------

# Machine-specific settings and secrets, kept out of this public repository.
[[ -r ~/.zshrc.local ]] && source ~/.zshrc.local
