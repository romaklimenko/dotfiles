# ============================================================================
# Windows Dotfiles Installation Script
# Author: Roman Klimenko (@romaklimenko)
# ============================================================================

param(
    [switch]$SkipBackup,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Remove a directory symlink or junction without following it, or a real
# directory with its contents. Windows PowerShell 5.1 follows links on
# Remove-Item -Recurse and would wipe the dotfiles repository behind them.
function Remove-LinkOrDirectory($path) {
    if (-not (Test-Path $path)) { return }
    $item = Get-Item $path -Force
    if ($item.Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint)) {
        [System.IO.Directory]::Delete($path)
    } else {
        Remove-Item $path -Recurse -Force
    }
}

Write-Info "============================================================================"
Write-Info "Installing dotfiles for Windows..."
Write-Info "============================================================================"
Write-Host ""

# -----------------------------------------------------------------------------
# Step 1: Create C:\home if it doesn't exist
# -----------------------------------------------------------------------------

Write-Info "[1/8] Checking C:\home directory..."
if (-not (Test-Path "C:\home")) {
    Write-Warning "Creating C:\home directory..."
    try {
        New-Item -ItemType Directory -Path "C:\home" -Force | Out-Null
        Write-Success "Created C:\home directory"
    } catch {
        Write-Error "Failed to create C:\home directory: $_"
        Write-Warning "You may need to run this script as Administrator"
        exit 1
    }
} else {
    Write-Success "C:\home directory exists"
}
Write-Host ""

# -----------------------------------------------------------------------------
# Step 2: Clone or update dotfiles repository
# -----------------------------------------------------------------------------

$dotfilesPath = "C:\home\dotfiles"
Write-Info "[2/8] Setting up dotfiles repository..."

if (-not (Test-Path $dotfilesPath)) {
    Write-Info "Cloning dotfiles repository..."
    try {
        git clone https://github.com/romaklimenko/dotfiles.git $dotfilesPath
        Write-Success "Cloned dotfiles repository"
    } catch {
        Write-Error "Failed to clone repository: $_"
        Write-Info "Make sure Git is installed and you have internet connection"
        exit 1
    }
} else {
    Write-Info "Dotfiles repository already exists, updating..."
    Push-Location $dotfilesPath
    try {
        git pull
        Write-Success "Updated dotfiles repository"
    } catch {
        Write-Warning "Failed to update repository: $_"
        Write-Warning "Continuing with existing files..."
    }
    Pop-Location
}

Set-Location $dotfilesPath
Write-Host ""

# -----------------------------------------------------------------------------
# Step 3: Initialize Neovim submodule
# -----------------------------------------------------------------------------

Write-Info "[3/8] Setting up Neovim configuration..."
try {
    git submodule init
    git submodule update --remote
    Write-Success "Neovim configuration ready"
} catch {
    Write-Warning "Failed to initialize Neovim submodule: $_"
    Write-Warning "You may need to initialize it manually later"
}
Write-Host ""

# -----------------------------------------------------------------------------
# Step 4: Backup and install PowerShell profile
# -----------------------------------------------------------------------------

Write-Info "[4/8] Installing PowerShell profile..."
$profilePath = $PROFILE

# Create profile directory if it doesn't exist
$profileDir = Split-Path $profilePath
if (-not (Test-Path $profileDir)) {
    Write-Info "Creating PowerShell profile directory..."
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Backup existing profile
if ((Test-Path $profilePath) -and -not $SkipBackup) {
    $backupPath = "$profilePath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Warning "Backing up existing profile to:"
    Write-Warning "  $backupPath"
    Copy-Item $profilePath $backupPath
}

# Copy PowerShell profile
$sourcePath = "$dotfilesPath\windows\Microsoft.PowerShell_profile.ps1"
try {
    Copy-Item $sourcePath $profilePath -Force
    Write-Success "PowerShell profile installed to:"
    Write-Success "  $profilePath"
} catch {
    Write-Error "Failed to install PowerShell profile: $_"
    exit 1
}
Write-Host ""

# -----------------------------------------------------------------------------
# Step 5: Install Neovim configuration
# -----------------------------------------------------------------------------

Write-Info "[5/8] Installing Neovim configuration..."
$nvimConfigPath = "$env:LOCALAPPDATA\nvim"

# Backup existing Neovim config
if ((Test-Path $nvimConfigPath) -and -not $SkipBackup) {
    $backupPath = "$nvimConfigPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Warning "Backing up existing Neovim config to:"
    Write-Warning "  $backupPath"
    Move-Item $nvimConfigPath $backupPath
}

# Create symlink (requires admin or Developer Mode)
try {
    New-Item -ItemType SymbolicLink -Path $nvimConfigPath -Target "$dotfilesPath\nvim" -Force | Out-Null
    Write-Success "Neovim configuration symlinked to:"
    Write-Success "  $nvimConfigPath"
} catch {
    Write-Warning "Failed to create symlink: $_"
    Write-Warning ""
    Write-Warning "To create symbolic links on Windows, you need either:"
    Write-Warning "  1. Run PowerShell as Administrator, or"
    Write-Warning "  2. Enable Developer Mode (Settings → Update & Security → For developers)"
    Write-Warning ""
    Write-Warning "Alternatively, you can manually copy the nvim folder:"
    Write-Warning "  Copy-Item '$dotfilesPath\nvim' '$nvimConfigPath' -Recurse -Force"
}
Write-Host ""

# -----------------------------------------------------------------------------
# Step 6: Verify installation
# -----------------------------------------------------------------------------

Write-Info "[6/8] Installing Claude Code configuration..."
$claudeConfigPath = "$env:USERPROFILE\.claude"

# Create .claude directory if it doesn't exist
if (-not (Test-Path $claudeConfigPath)) {
    Write-Info "Creating .claude directory..."
    New-Item -ItemType Directory -Path $claudeConfigPath -Force | Out-Null
}

# Install settings.json
$claudeSettingsSource = "$dotfilesPath\claude\settings.json"
$claudeSettingsTarget = "$claudeConfigPath\settings.json"
if (Test-Path $claudeSettingsTarget) {
    if (-not $SkipBackup) {
        $backupPath = "$claudeSettingsTarget.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Warning "Backing up existing Claude Code settings to:"
        Write-Warning "  $backupPath"
        Copy-Item $claudeSettingsTarget $backupPath
    }
}
try {
    Copy-Item $claudeSettingsSource $claudeSettingsTarget -Force
    Write-Success "Claude Code settings installed to:"
    Write-Success "  $claudeSettingsTarget"
} catch {
    Write-Warning "Failed to install Claude Code settings: $_"
}

# Install CLAUDE.md
$claudeMdSource = "$dotfilesPath\claude\CLAUDE.md"
$claudeMdTarget = "$claudeConfigPath\CLAUDE.md"
if (Test-Path $claudeMdTarget) {
    if (-not $SkipBackup) {
        $backupPath = "$claudeMdTarget.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Warning "Backing up existing global CLAUDE.md to:"
        Write-Warning "  $backupPath"
        Copy-Item $claudeMdTarget $backupPath
    }
}
try {
    Copy-Item $claudeMdSource $claudeMdTarget -Force
    Write-Success "Global CLAUDE.md installed to:"
    Write-Success "  $claudeMdTarget"
} catch {
    Write-Warning "Failed to install global CLAUDE.md: $_"
}

# Install commands directory
$claudeCommandsSource = "$dotfilesPath\claude\commands"
$claudeCommandsTarget = "$claudeConfigPath\commands"
if ((Test-Path $claudeCommandsTarget) -and -not (Get-Item $claudeCommandsTarget).Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint)) {
    if (-not $SkipBackup) {
        $backupPath = "$claudeCommandsTarget.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Warning "Backing up existing Claude Code commands to:"
        Write-Warning "  $backupPath"
        Move-Item $claudeCommandsTarget $backupPath
    } else {
        Remove-Item $claudeCommandsTarget -Recurse -Force
    }
}
try {
    if (Test-Path $claudeCommandsTarget) {
        Remove-LinkOrDirectory $claudeCommandsTarget
    }
    New-Item -ItemType SymbolicLink -Path $claudeCommandsTarget -Target $claudeCommandsSource -Force | Out-Null
    Write-Success "Claude Code commands symlinked to:"
    Write-Success "  $claudeCommandsTarget"
} catch {
    Write-Warning "Failed to create symlink for Claude Code commands: $_"
    Write-Warning "Falling back to copy..."
    try {
        Remove-LinkOrDirectory $claudeCommandsTarget
        Copy-Item $claudeCommandsSource $claudeCommandsTarget -Recurse -Force
        Write-Success "Claude Code commands copied to:"
        Write-Success "  $claudeCommandsTarget"
    } catch {
        Write-Warning "Failed to copy Claude Code commands: $_"
    }
}

# Install hooks directory
$claudeHooksSource = "$dotfilesPath\claude\hooks"
$claudeHooksTarget = "$claudeConfigPath\hooks"
if ((Test-Path $claudeHooksTarget) -and -not (Get-Item $claudeHooksTarget).Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint)) {
    if (-not $SkipBackup) {
        $backupPath = "$claudeHooksTarget.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Warning "Backing up existing Claude Code hooks to:"
        Write-Warning "  $backupPath"
        Move-Item $claudeHooksTarget $backupPath
    } else {
        Remove-Item $claudeHooksTarget -Recurse -Force
    }
}
try {
    if (Test-Path $claudeHooksTarget) {
        Remove-LinkOrDirectory $claudeHooksTarget
    }
    New-Item -ItemType SymbolicLink -Path $claudeHooksTarget -Target $claudeHooksSource -Force | Out-Null
    Write-Success "Claude Code hooks symlinked to:"
    Write-Success "  $claudeHooksTarget"
} catch {
    Write-Warning "Failed to create symlink for Claude Code hooks: $_"
    Write-Warning "Falling back to copy..."
    try {
        Remove-LinkOrDirectory $claudeHooksTarget
        Copy-Item $claudeHooksSource $claudeHooksTarget -Recurse -Force
        Write-Success "Claude Code hooks copied to:"
        Write-Success "  $claudeHooksTarget"
    } catch {
        Write-Warning "Failed to copy Claude Code hooks: $_"
    }
}

# Install global git ignore. Git reads ~/.config/git/ignore when
# core.excludesFile is unset. It keeps LESSONS.md, written by the Claude Code
# lessons hook, out of every repository unless a project opts in.
$gitIgnoreSource = "$dotfilesPath\git\ignore"
$gitConfigHome = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { "$env:USERPROFILE\.config" }
$gitIgnoreTarget = "$gitConfigHome\git\ignore"
$gitExcludesFile = git config --global --get core.excludesFile 2>$null
if ($gitExcludesFile) {
    Write-Warning "core.excludesFile is set to $gitExcludesFile"
    Write-Warning "  Add the patterns from $gitIgnoreSource to it yourself"
} else {
    try {
        New-Item -ItemType Directory -Path (Split-Path $gitIgnoreTarget) -Force | Out-Null
        if (-not (Test-Path $gitIgnoreTarget)) {
            Copy-Item $gitIgnoreSource $gitIgnoreTarget -Force
        } else {
            # Keep whatever is there. Append only the patterns that are missing.
            $existing = @(Get-Content $gitIgnoreTarget)
            $missing = @(Get-Content $gitIgnoreSource | Where-Object { $_ -and -not $_.StartsWith('#') -and ($existing -notcontains $_) })
            if ($missing.Count -gt 0) {
                Add-Content $gitIgnoreTarget -Value (@('', '# Added from dotfiles (git/ignore)') + $missing)
            }
        }
        Write-Success "Global git ignore installed to:"
        Write-Success "  $gitIgnoreTarget"
    } catch {
        Write-Warning "Failed to install global git ignore: $_"
    }
}

Write-Success "Claude Code configuration installed"
Write-Host ""

# -----------------------------------------------------------------------------
# Step 7: Verify installation
# -----------------------------------------------------------------------------

Write-Info "[7/8] Verifying installation..."
$issues = @()

if (-not (Test-Path $profilePath)) {
    $issues += "PowerShell profile not found at $profilePath"
}

if (-not (Test-Path "$dotfilesPath\nvim")) {
    $issues += "Neovim configuration not found at $dotfilesPath\nvim"
}

if (-not (Test-Path "$claudeConfigPath\settings.json")) {
    $issues += "Claude Code settings not found at $claudeConfigPath\settings.json"
}

if (-not (Test-Path "$claudeConfigPath\commands")) {
    $issues += "Claude Code commands not found at $claudeConfigPath\commands"
}

if (-not (Test-Path "$claudeConfigPath\hooks")) {
    $issues += "Claude Code hooks not found at $claudeConfigPath\hooks"
}

if (-not $gitExcludesFile -and -not (Test-Path $gitIgnoreTarget)) {
    $issues += "Global git ignore not found at $gitIgnoreTarget"
}

if ($issues.Count -eq 0) {
    Write-Success "All checks passed!"
} else {
    Write-Warning "Some issues were detected:"
    foreach ($issue in $issues) {
        Write-Warning "  - $issue"
    }
}
Write-Host ""

# -----------------------------------------------------------------------------
# Step 8: Next steps
# -----------------------------------------------------------------------------

Write-Info "[8/8] Installation complete!"
Write-Host ""
Write-Success "============================================================================"
Write-Success "Dotfiles installed successfully!"
Write-Success "============================================================================"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. Restart PowerShell or run: . `$PROFILE"
Write-Host "  2. Verify `$env:DEV_HOME is C:\home and `$env:DOTFILES_HOME is C:\home\dotfiles"
Write-Host "  3. Test aliases: ll, gs, dots, etc."
Write-Host ""

if (Get-Command nvim -ErrorAction SilentlyContinue) {
    Write-Info "Neovim detected! Test with: nvim"
} else {
    Write-Warning "Neovim not found. Install it to use the Neovim configuration:"
    Write-Warning "  winget install Neovim.Neovim"
    Write-Warning "  or visit: https://neovim.io/"
}

Write-Host ""
Write-Info "For more information, visit:"
Write-Info "  https://github.com/romaklimenko/dotfiles"
Write-Host ""
