# ============================================================================
# aliases.sh - aliases and functions shared by zsh and bash
# Author: Roman Klimenko (@romaklimenko)
#
# zsh gets the standard aliases from oh-my-zsh: git (gst, gp, gl, glog),
# ls (ll, la), extract, mkcd and take. bash gets the same names from
# .bash_aliases. This file holds only what oh-my-zsh doesn't have.
# ============================================================================

# -----------------------------------------------------------------------------
# Editor
# -----------------------------------------------------------------------------

if command -v nvim >/dev/null 2>&1; then
    alias vim='nvim'
    alias vi='nvim'
fi

# -----------------------------------------------------------------------------
# Workspaces
# -----------------------------------------------------------------------------

alias cdh='cd "$DEV_HOME"'
alias hh='cd "$DEV_HOME"'
alias dots='cd "$DOTFILES_HOME"'

# tmux: open a workspace as a session named after its folder, one session per
# workspace. "ws" opens the current folder, "ws backstage" opens ./backstage,
# or $DEV_HOME/backstage if there is no ./backstage. tmux/ws.sh does the work,
# so :ws in the tmux command prompt behaves the same.
ws() {
    sh "$DOTFILES_HOME/tmux/ws.sh" "$@"
}

# -----------------------------------------------------------------------------
# Dotfiles
# -----------------------------------------------------------------------------

# dotsync applies the local repository: links, oh-my-zsh, agent config and
# the global git ignore. dotpull pulls from GitHub first, then applies.
dotsync() {
    bash "$DOTFILES_HOME/install/install.sh" --local
}

dotpull() {
    bash "$DOTFILES_HOME/install/install.sh"
}

# -----------------------------------------------------------------------------
# Databricks
# -----------------------------------------------------------------------------

alias dbcfg='${EDITOR:-vi} ~/.databrickscfg'
alias d='databricks'
alias db='databricks bundle'
alias dbd='databricks bundle deploy'
alias dbv='databricks bundle validate'
alias dbr='databricks bundle run'
alias dbs='databricks bundle sync'
alias dw='databricks workspace'
alias dj='databricks jobs'
alias dc='databricks clusters'
alias dfs='databricks fs'

# -----------------------------------------------------------------------------
# Network
# -----------------------------------------------------------------------------

alias myip='curl -fsS https://ifconfig.me/ip; echo'
alias myip6='curl -fsS https://ipv6.ifconfig.me; echo'

# -----------------------------------------------------------------------------
# Secrets in the macOS login Keychain
# -----------------------------------------------------------------------------

# Keep tokens out of files: store each one in the login Keychain and export
# it at shell start from ~/.zshrc.local, which stays out of this repository.
#
#   husker token --name labs-mac --list Labs | keychain-set HUSKER_ONLINE_TOKEN_LABS
#   keychain-env HUSKER_ONLINE_TOKEN HUSKER_ONLINE_TOKEN_LABS
if [ "$(uname -s)" = Darwin ]; then
    # Export each named secret. A name that isn't in the Keychain is skipped.
    keychain-env() {
        local name value
        for name in "$@"; do
            value=$(security find-generic-password -a "$USER" -s "$name" -w 2>/dev/null) &&
                export "$name=$value"
        done
    }

    # Store one line from stdin as NAME, replacing an existing value.
    keychain-set() {
        local value
        if [ -z "$1" ]; then
            echo "Usage: keychain-set NAME < value" >&2
            return 2
        fi
        IFS= read -r value || [ -n "$value" ] || { echo "keychain-set: nothing on stdin" >&2; return 1; }
        case "$value" in
            *[[:space:]\"\\]*) echo "keychain-set: the value must not contain spaces, quotes or backslashes" >&2; return 1 ;;
        esac
        # security -i reads the command from stdin, so the value stays out of
        # the process list.
        printf 'add-generic-password -U -a "%s" -s "%s" -w "%s"\n' "$USER" "$1" "$value" | security -i >/dev/null
    }
fi
