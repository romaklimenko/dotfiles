#!/bin/bash
# ============================================================================
# Linux/WSL Dotfiles Installation Script
# Author: Roman Klimenko (@romaklimenko)
# ============================================================================

set -e

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

print_info "============================================================================"
print_info "Installing dotfiles for Linux/WSL..."
print_info "============================================================================"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Detect environment
# -----------------------------------------------------------------------------

print_info "[1/9] Detecting environment..."
IS_WSL=false
if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
    print_success "WSL detected"
    IS_WSL=true
else
    print_success "Standalone Linux detected"
fi
echo ""

# -----------------------------------------------------------------------------
# Step 2: Clone or update dotfiles repository
# -----------------------------------------------------------------------------

DOTFILES_DIR="$HOME/dotfiles"
DOTFILES_REPO="https://github.com/romaklimenko/dotfiles.git"

print_info "[2/9] Setting up dotfiles repository..."
if [ ! -d "$DOTFILES_DIR" ]; then
    print_info "Cloning dotfiles repository..."
    if git clone "$DOTFILES_REPO" "$DOTFILES_DIR"; then
        print_success "Cloned dotfiles repository"
    else
        print_error "Failed to clone repository"
        print_info "Make sure Git is installed and you have internet connection"
        exit 1
    fi
else
    print_info "Dotfiles repository already exists, updating..."
    cd "$DOTFILES_DIR"
    if git pull; then
        print_success "Updated dotfiles repository"
    else
        print_warning "Failed to update repository"
        print_warning "Continuing with existing files..."
    fi
fi

cd "$DOTFILES_DIR"
echo ""

# -----------------------------------------------------------------------------
# Step 3: Initialize Neovim submodule
# -----------------------------------------------------------------------------

print_info "[3/9] Setting up Neovim configuration..."
if git submodule init && git submodule update --remote; then
    print_success "Neovim configuration ready"
else
    print_warning "Failed to initialize Neovim submodule"
    print_warning "You may need to initialize it manually later"
fi
echo ""

# -----------------------------------------------------------------------------
# Helper function for backing up and linking files
# -----------------------------------------------------------------------------

backup_file() {
    local file=$1
    if [ -e "$file" ] || [ -L "$file" ]; then
        local backup="$file.backup-$(date +%Y%m%d-%H%M%S)"
        print_warning "Backing up existing file to:"
        print_warning "  $backup"
        mv "$file" "$backup"
    fi
}

link_file() {
    local source=$1
    local target=$2

    backup_file "$target"

    if ln -sf "$source" "$target"; then
        print_success "Linked: $target -> $source"
    else
        print_error "Failed to link: $target"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Step 4: Link shell configuration files
# -----------------------------------------------------------------------------

print_info "[4/9] Installing shell configuration files..."

link_file "$DOTFILES_DIR/linux/.bashrc" "$HOME/.bashrc"
link_file "$DOTFILES_DIR/linux/.bash_aliases" "$HOME/.bash_aliases"
link_file "$DOTFILES_DIR/linux/.zshrc" "$HOME/.zshrc"
link_file "$DOTFILES_DIR/linux/.profile" "$HOME/.profile"

print_success "Shell configuration files installed"
echo ""

# -----------------------------------------------------------------------------
# Step 5: Link Neovim configuration
# -----------------------------------------------------------------------------

print_info "[5/9] Installing Neovim configuration..."

# Create .config directory if it doesn't exist
mkdir -p "$HOME/.config"

# Backup and remove existing Neovim config
NVIM_CONFIG="$HOME/.config/nvim"
if [ -d "$NVIM_CONFIG" ] || [ -L "$NVIM_CONFIG" ]; then
    backup="$NVIM_CONFIG.backup-$(date +%Y%m%d-%H%M%S)"
    print_warning "Backing up existing Neovim config to:"
    print_warning "  $backup"
    mv "$NVIM_CONFIG" "$backup"
fi

# Create symlink
if ln -sf "$DOTFILES_DIR/nvim" "$NVIM_CONFIG"; then
    print_success "Neovim configuration symlinked to:"
    print_success "  $NVIM_CONFIG"
else
    print_error "Failed to symlink Neovim configuration"
fi
echo ""

# -----------------------------------------------------------------------------
# Step 6: Set file permissions
# -----------------------------------------------------------------------------

print_info "[6/9] Installing Claude Code configuration..."
CLAUDE_CONFIG_DIR="$HOME/.claude"

# Create .claude directory if it doesn't exist
mkdir -p "$CLAUDE_CONFIG_DIR"

# Install settings.json
CLAUDE_SETTINGS_SOURCE="$DOTFILES_DIR/claude/settings.json"
CLAUDE_SETTINGS_TARGET="$CLAUDE_CONFIG_DIR/settings.json"
if [ -f "$CLAUDE_SETTINGS_TARGET" ]; then
    backup_file "$CLAUDE_SETTINGS_TARGET"
fi
cp "$CLAUDE_SETTINGS_SOURCE" "$CLAUDE_SETTINGS_TARGET"
print_success "Claude Code settings installed to:"
print_success "  $CLAUDE_SETTINGS_TARGET"

# Install CLAUDE.md
CLAUDE_MD_SOURCE="$DOTFILES_DIR/claude/CLAUDE.md"
CLAUDE_MD_TARGET="$CLAUDE_CONFIG_DIR/CLAUDE.md"
if [ -f "$CLAUDE_MD_TARGET" ]; then
    backup_file "$CLAUDE_MD_TARGET"
fi
cp "$CLAUDE_MD_SOURCE" "$CLAUDE_MD_TARGET"
print_success "Global CLAUDE.md installed to:"
print_success "  $CLAUDE_MD_TARGET"

# Install commands directory (symlink)
CLAUDE_COMMANDS_SOURCE="$DOTFILES_DIR/claude/commands"
CLAUDE_COMMANDS_TARGET="$CLAUDE_CONFIG_DIR/commands"
if [ -d "$CLAUDE_COMMANDS_TARGET" ] && [ ! -L "$CLAUDE_COMMANDS_TARGET" ]; then
    backup_file "$CLAUDE_COMMANDS_TARGET"
fi
ln -sfn "$CLAUDE_COMMANDS_SOURCE" "$CLAUDE_COMMANDS_TARGET"
print_success "Claude Code commands symlinked to:"
print_success "  $CLAUDE_COMMANDS_TARGET"

# Install hooks directory (symlink). The hooks are Node.js scripts.
if ! command -v node &> /dev/null; then
    print_warning "node was not found. The Claude Code hooks need Node.js 20 or newer to run."
fi
CLAUDE_HOOKS_SOURCE="$DOTFILES_DIR/claude/hooks"
CLAUDE_HOOKS_TARGET="$CLAUDE_CONFIG_DIR/hooks"
if [ -d "$CLAUDE_HOOKS_TARGET" ] && [ ! -L "$CLAUDE_HOOKS_TARGET" ]; then
    backup_file "$CLAUDE_HOOKS_TARGET"
fi
ln -sfn "$CLAUDE_HOOKS_SOURCE" "$CLAUDE_HOOKS_TARGET"
print_success "Claude Code hooks symlinked to:"
print_success "  $CLAUDE_HOOKS_TARGET"

# Install global git ignore. Git reads ~/.config/git/ignore when
# core.excludesFile is unset. It keeps LESSONS.md, written by the Claude Code
# lessons hook, out of every repository unless a project opts in.
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

print_success "Claude Code configuration installed"
echo ""

# -----------------------------------------------------------------------------
# Step 7: Set file permissions
# -----------------------------------------------------------------------------

print_info "[7/9] Setting file permissions..."

chmod 644 "$HOME/.bashrc" 2>/dev/null || true
chmod 644 "$HOME/.bash_aliases" 2>/dev/null || true
chmod 644 "$HOME/.zshrc" 2>/dev/null || true
chmod 644 "$HOME/.profile" 2>/dev/null || true

print_success "File permissions set"
echo ""

# -----------------------------------------------------------------------------
# Step 8: Verify installation
# -----------------------------------------------------------------------------

print_info "[8/9] Verifying installation..."
ISSUES=()

[ ! -f "$HOME/.bashrc" ] && ISSUES+=("~/.bashrc not found")
[ ! -f "$HOME/.bash_aliases" ] && ISSUES+=("~/.bash_aliases not found")
[ ! -f "$HOME/.zshrc" ] && ISSUES+=("~/.zshrc not found")
[ ! -f "$HOME/.profile" ] && ISSUES+=("~/.profile not found")
[ ! -d "$NVIM_CONFIG" ] && ISSUES+=("Neovim config not found at $NVIM_CONFIG")
[ ! -f "$CLAUDE_CONFIG_DIR/settings.json" ] && ISSUES+=("Claude Code settings not found at $CLAUDE_CONFIG_DIR/settings.json")
[ ! -d "$CLAUDE_CONFIG_DIR/commands" ] && ISSUES+=("Claude Code commands not found at $CLAUDE_CONFIG_DIR/commands")
[ ! -d "$CLAUDE_CONFIG_DIR/hooks" ] && ISSUES+=("Claude Code hooks not found at $CLAUDE_CONFIG_DIR/hooks")
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
# Step 9: Next steps
# -----------------------------------------------------------------------------

print_info "[9/9] Installation complete!"
echo ""
print_success "============================================================================"
print_success "Dotfiles installed successfully!"
print_success "============================================================================"
echo ""
print_info "Next steps:"
echo "  1. Restart your shell or run: source ~/.bashrc"
echo "  2. Test aliases: ll, gs, dots, etc."
echo "  3. Try navigating with: dots"
echo ""

if command -v nvim &> /dev/null; then
    print_info "Neovim detected! Test with: nvim"
else
    print_warning "Neovim not found. Install it to use the Neovim configuration:"
    if [ "$IS_WSL" = true ] || command -v apt &> /dev/null; then
        print_warning "  sudo apt update && sudo apt install neovim"
    else
        print_warning "  See: https://neovim.io/"
    fi
fi

echo ""
print_info "For more information, visit:"
print_info "  https://github.com/romaklimenko/dotfiles"
echo ""
