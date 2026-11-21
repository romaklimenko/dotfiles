#!/bin/bash
# ============================================================================
# Dotfiles installation for macOS and Ubuntu
# Author: Roman Klimenko (@romaklimenko)
#
#   curl -fsSL dotfiles.klimenko.dk/install.sh | bash   # clone or pull, then apply
#   bash install/install.sh --local                     # apply this checkout as it is
#
# The repository goes to $DOTFILES_HOME, by default ~/Work/dotfiles.
# Running it again is safe: links that are already right are left alone.
# ============================================================================

set -e

LOCAL=false
for arg in "$@"; do
    case "$arg" in
        --local) LOCAL=true ;;
        *) echo "Usage: install.sh [--local]" >&2; exit 2 ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}$1${NC}"; }
print_info() { echo -e "${CYAN}$1${NC}"; }
print_warning() { echo -e "${YELLOW}$1${NC}"; }
print_error() { echo -e "${RED}$1${NC}"; }

# -----------------------------------------------------------------------------
# Step 1: Detect environment
# -----------------------------------------------------------------------------

print_info "[1/8] Detecting environment..."
OS=linux
if [ "$(uname -s)" = Darwin ]; then
    OS=macos
    print_success "macOS detected"
elif [ -r /etc/os-release ] && grep -q '^ID=ubuntu' /etc/os-release; then
    OS=ubuntu
    print_success "Ubuntu detected"
else
    print_warning "Linux detected. Only macOS and Ubuntu are tested"
fi
echo ""

# -----------------------------------------------------------------------------
# Step 2: Clone or update dotfiles repository
# -----------------------------------------------------------------------------

DOTFILES_REPO="https://github.com/romaklimenko/dotfiles.git"

print_info "[2/8] Setting up dotfiles repository..."
if [ "$LOCAL" = true ]; then
    DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    print_success "Using the local checkout in $DOTFILES_DIR"
else
    DEV_HOME="${DEV_HOME:-$HOME/Work}"
    DOTFILES_DIR="${DOTFILES_HOME:-$DEV_HOME/dotfiles}"
    if [ ! -d "$DOTFILES_DIR" ]; then
        print_info "Cloning dotfiles repository to $DOTFILES_DIR..."
        mkdir -p "$(dirname "$DOTFILES_DIR")"
        if git clone "$DOTFILES_REPO" "$DOTFILES_DIR"; then
            print_success "Cloned dotfiles repository"
        else
            print_error "Failed to clone repository"
            print_info "Make sure Git is installed and you have internet connection"
            exit 1
        fi
    else
        print_info "Dotfiles repository already exists, updating..."
        if git -C "$DOTFILES_DIR" pull; then
            print_success "Updated dotfiles repository"
        else
            print_warning "Failed to update repository"
            print_warning "Continuing with existing files..."
        fi
    fi
fi

cd "$DOTFILES_DIR"
echo ""

# -----------------------------------------------------------------------------
# Step 3: Neovim submodule and oh-my-zsh
# -----------------------------------------------------------------------------

print_info "[3/8] Setting up Neovim configuration and oh-my-zsh..."
if [ "$LOCAL" = true ]; then
    # Only fill an empty submodule; never move it to another commit.
    if [ ! -e nvim/init.lua ] && git submodule update --init; then
        print_success "Neovim configuration checked out"
    fi
elif git submodule update --init --remote; then
    print_success "Neovim configuration ready"
else
    print_warning "Failed to initialize Neovim submodule"
    print_warning "You may need to initialize it manually later"
fi

if [ -d "$HOME/.oh-my-zsh" ]; then
    print_success "oh-my-zsh is installed"
elif git clone --depth=1 https://github.com/ohmyzsh/ohmyzsh.git "$HOME/.oh-my-zsh"; then
    print_success "Installed oh-my-zsh to ~/.oh-my-zsh"
else
    print_warning "Failed to install oh-my-zsh. zsh works without it, minus the aliases"
fi
echo ""

# -----------------------------------------------------------------------------
# Helper function for backing up and linking files
# -----------------------------------------------------------------------------

link_file() {
    local source=$1
    local target=$2

    # Already linked to this source: nothing to do.
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
        print_success "Linked: $target"
        return 0
    fi

    if [ -e "$target" ] || [ -L "$target" ]; then
        local backup
        backup="$target.backup-$(date +%Y%m%d-%H%M%S)"
        print_warning "Backing up existing file to:"
        print_warning "  $backup"
        mv "$target" "$backup"
    fi

    mkdir -p "$(dirname "$target")"
    if ln -s "$source" "$target"; then
        print_success "Linked: $target -> $source"
    else
        print_error "Failed to link: $target"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Step 4: Link shell, tmux and Neovim configuration
# -----------------------------------------------------------------------------

print_info "[4/8] Linking shell, tmux and Neovim configuration..."

link_file "$DOTFILES_DIR/shell/.zshrc" "$HOME/.zshrc"
link_file "$DOTFILES_DIR/shell/.zprofile" "$HOME/.zprofile"
link_file "$DOTFILES_DIR/shell/.bashrc" "$HOME/.bashrc"
link_file "$DOTFILES_DIR/shell/.profile" "$HOME/.profile"
link_file "$DOTFILES_DIR/tmux/tmux.conf" "$HOME/.tmux.conf"
link_file "$DOTFILES_DIR/nvim" "$HOME/.config/nvim"

# Earlier versions linked these. .bashrc now loads .bash_aliases from the
# repository, and prefix + w replaced the pane picker.
for old in "$HOME/.bash_aliases" "$HOME/.config/tmux/pick-pane.sh"; do
    if [ -L "$old" ] && case "$(readlink "$old")" in "$DOTFILES_DIR"/*) true ;; *) false ;; esac; then
        rm "$old"
        print_success "Removed old link: $old"
    fi
done

print_success "Shell, tmux and Neovim configuration linked"
echo ""

# -----------------------------------------------------------------------------
# Step 5: Claude Code and Codex configuration
# -----------------------------------------------------------------------------

print_info "[5/8] Installing Claude Code and Codex configuration..."
CLAUDE_CONFIG_DIR="$HOME/.claude"
CODEX_CONFIG_DIR="${CODEX_HOME:-$HOME/.codex}"
if ! command -v node &> /dev/null; then
    print_error "Node.js 20 or newer is required to install the shared agent configuration."
    exit 1
fi
# Agent sync backs up changed managed files and retains unrelated settings.
node "$DOTFILES_DIR/scripts/sync-agent-config.mjs" --repo "$DOTFILES_DIR" --home "$HOME"

echo ""

# -----------------------------------------------------------------------------
# Step 6: Global git ignore
# -----------------------------------------------------------------------------

print_info "[6/8] Installing the global git ignore..."
# Git reads ~/.config/git/ignore when core.excludesFile is unset. It keeps
# local-only files such as .claude/settings.local.json out of every repository.
GIT_IGNORE_SOURCE="$DOTFILES_DIR/git/ignore"
GIT_IGNORE_TARGET="${XDG_CONFIG_HOME:-$HOME/.config}/git/ignore"
GIT_EXCLUDES_FILE="$(git config --global --get core.excludesFile 2>/dev/null || true)"
if [ -n "$GIT_EXCLUDES_FILE" ]; then
    print_warning "core.excludesFile is set to $GIT_EXCLUDES_FILE"
    print_warning "  Add the patterns from $GIT_IGNORE_SOURCE to it yourself"
else
    mkdir -p "$(dirname "$GIT_IGNORE_TARGET")"
    if [ ! -f "$GIT_IGNORE_TARGET" ]; then
        cp "$GIT_IGNORE_SOURCE" "$GIT_IGNORE_TARGET"
    else
        # Keep whatever is there. Append only the patterns that are missing.
        added=0
        while IFS= read -r pattern || [ -n "$pattern" ]; do
            case "$pattern" in ''|'#'*) continue ;; esac
            if ! grep -qxF -- "$pattern" "$GIT_IGNORE_TARGET"; then
                [ "$added" -eq 0 ] && printf '\n# Added from dotfiles (git/ignore)\n' >> "$GIT_IGNORE_TARGET"
                printf '%s\n' "$pattern" >> "$GIT_IGNORE_TARGET"
                added=1
            fi
        done < "$GIT_IGNORE_SOURCE"
    fi
    print_success "Global git ignore installed to:"
    print_success "  $GIT_IGNORE_TARGET"
fi
echo ""

# -----------------------------------------------------------------------------
# Step 7: Verify installation
# -----------------------------------------------------------------------------

print_info "[7/8] Verifying installation..."
ISSUES=()

for file in .zshrc .zprofile .bashrc .profile .tmux.conf; do
    [ ! -f "$HOME/$file" ] && ISSUES+=("~/$file not found")
done
[ ! -d "$HOME/.config/nvim" ] && ISSUES+=("Neovim config not found at ~/.config/nvim")
[ ! -f "$HOME/.oh-my-zsh/oh-my-zsh.sh" ] && ISSUES+=("oh-my-zsh not found at ~/.oh-my-zsh")
[ ! -f "$CLAUDE_CONFIG_DIR/settings.json" ] && ISSUES+=("Claude Code settings not found at $CLAUDE_CONFIG_DIR/settings.json")
[ ! -f "$CLAUDE_CONFIG_DIR/AGENTS.md" ] && ISSUES+=("Shared Claude instructions not found at $CLAUDE_CONFIG_DIR/AGENTS.md")
[ ! -f "$CODEX_CONFIG_DIR/AGENTS.md" ] && ISSUES+=("Shared Codex instructions not found at $CODEX_CONFIG_DIR/AGENTS.md")
[ -z "$GIT_EXCLUDES_FILE" ] && [ ! -f "$GIT_IGNORE_TARGET" ] && ISSUES+=("Global git ignore not found at $GIT_IGNORE_TARGET")

if [ ${#ISSUES[@]} -eq 0 ]; then
    print_success "All checks passed!"
else
    print_warning "Some issues were detected:"
    for issue in "${ISSUES[@]}"; do
        print_warning "  - $issue"
    done
fi
echo ""

# -----------------------------------------------------------------------------
# Step 8: Tools and next steps
# -----------------------------------------------------------------------------

print_info "[8/8] Checking tools..."
if [ "$OS" = macos ]; then
    if ! command -v brew &> /dev/null; then
        print_warning "Homebrew not found. Install it from https://brew.sh, then run:"
        print_warning "  brew bundle --file $DOTFILES_DIR/Brewfile"
    elif brew bundle check --file "$DOTFILES_DIR/Brewfile" &> /dev/null; then
        print_success "Everything in the Brewfile is installed"
    else
        print_warning "Some tools in the Brewfile are missing. Install them with:"
        print_warning "  brew bundle --file $DOTFILES_DIR/Brewfile"
    fi
else
    MISSING=()
    for tool in zsh tmux nvim rg git node; do
        command -v "$tool" &> /dev/null || MISSING+=("$tool")
    done
    if [ ${#MISSING[@]} -eq 0 ]; then
        print_success "zsh, tmux, Neovim, ripgrep, git and Node.js are installed"
    else
        print_warning "Missing: ${MISSING[*]}. On Ubuntu:"
        print_warning "  sudo apt update && sudo apt install zsh tmux neovim ripgrep fd-find git nodejs"
    fi
    if [ "$(basename "${SHELL:-}")" != zsh ] && command -v zsh &> /dev/null; then
        print_warning "Your login shell is ${SHELL:-unknown}. Switch to zsh with:"
        print_warning "  chsh -s $(command -v zsh)"
    fi
fi
echo ""

print_success "============================================================================"
print_success "Dotfiles installed. Open a new terminal, or run: exec zsh"
print_success "============================================================================"
echo ""
print_info "Try: ws (tmux session per workspace in ~/Work), dots, gst, glog"
print_info "More: https://github.com/romaklimenko/dotfiles"
echo ""
