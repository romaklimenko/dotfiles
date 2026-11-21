# ============================================================================
# env.sh - environment shared by zsh and bash on macOS and Ubuntu
# Author: Roman Klimenko (@romaklimenko)
#
# Sourced by .zprofile, .zshrc, .profile and .bashrc. It runs more than once
# per shell, so everything in it must be safe to repeat.
# ============================================================================

# -----------------------------------------------------------------------------
# Personal roots
# -----------------------------------------------------------------------------

# DEV_HOME holds one folder per workspace, each a repository or a group of
# repositories. It is deliberately not HOME: git, ssh and most other tools
# read HOME, and they should keep using the real home folder.
export DEV_HOME="${DEV_HOME:-$HOME/Work}"
export DOTFILES_HOME="${DOTFILES_HOME:-$DEV_HOME/dotfiles}"

# -----------------------------------------------------------------------------
# PATH
# -----------------------------------------------------------------------------

# Move a folder to the front of PATH, removing it from anywhere else first.
# On macOS, /etc/zprofile runs path_helper, which puts the system folders
# back in front, so this has to move folders even when they are already on
# PATH. Otherwise /usr/bin/git wins over Homebrew's git.
_dotfiles_path_first() {
    [ -d "$1" ] || return 0
    _dotfiles_path=":$PATH:"
    while :; do
        case "$_dotfiles_path" in
            *":$1:"*) _dotfiles_path="${_dotfiles_path%%:"$1":*}:${_dotfiles_path#*:"$1":}" ;;
            *) break ;;
        esac
    done
    _dotfiles_path="${_dotfiles_path#:}"
    _dotfiles_path="${_dotfiles_path%:}"
    PATH="$1${_dotfiles_path:+:$_dotfiles_path}"
    unset _dotfiles_path
}

# Homebrew: Apple silicon, Intel Mac, or Homebrew on Linux.
for _dotfiles_brew in /opt/homebrew /usr/local /home/linuxbrew/.linuxbrew; do
    if [ -x "$_dotfiles_brew/bin/brew" ]; then
        export HOMEBREW_PREFIX="$_dotfiles_brew"
        export HOMEBREW_CELLAR="$_dotfiles_brew/Cellar"
        export HOMEBREW_REPOSITORY="$_dotfiles_brew"
        [ "$_dotfiles_brew" = /usr/local ] && export HOMEBREW_REPOSITORY=/usr/local/Homebrew
        [ "$_dotfiles_brew" = /home/linuxbrew/.linuxbrew ] && export HOMEBREW_REPOSITORY=/home/linuxbrew/.linuxbrew/Homebrew
        _dotfiles_path_first "$_dotfiles_brew/sbin"
        _dotfiles_path_first "$_dotfiles_brew/bin"
        # Homebrew's rustup is keg-only: cargo and rustc live in its own bin.
        _dotfiles_path_first "$_dotfiles_brew/opt/rustup/bin"
        break
    fi
done
unset _dotfiles_brew

# Rust (cargo install puts binaries such as husker here), then the user's own
# folders: ~/.local/bin holds claude and uv tools.
_dotfiles_path_first "$HOME/.cargo/bin"
_dotfiles_path_first "$HOME/bin"
_dotfiles_path_first "$HOME/.local/bin"
export PATH
unset -f _dotfiles_path_first

# -----------------------------------------------------------------------------
# Editor, pager, locale
# -----------------------------------------------------------------------------

export EDITOR=nvim
export VISUAL=nvim
export CLICOLOR=1
export LESS='-R -F -X'
export LESSHISTFILE=-
export LANG="${LANG:-en_US.UTF-8}"
