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

Write-Info "============================================================================"
Write-Info "Installing dotfiles for Windows..."
Write-Info "============================================================================"
Write-Host ""

# -----------------------------------------------------------------------------
# Step 1: Create C:\home if it doesn't exist
# -----------------------------------------------------------------------------

Write-Info "[1/7] Checking C:\home directory..."
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
Write-Info "[2/7] Setting up dotfiles repository..."

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

Write-Info "[3/7] Setting up Neovim configuration..."
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

Write-Info "[4/7] Installing PowerShell profile..."
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

Write-Info "[5/7] Installing Neovim configuration..."
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

Write-Info "[6/7] Verifying installation..."
$issues = @()

if (-not (Test-Path $profilePath)) {
    $issues += "PowerShell profile not found at $profilePath"
}

if (-not (Test-Path "$dotfilesPath\nvim")) {
    $issues += "Neovim configuration not found at $dotfilesPath\nvim"
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
# Step 7: Next steps
# -----------------------------------------------------------------------------

Write-Info "[7/7] Installation complete!"
Write-Host ""
Write-Success "============================================================================"
Write-Success "Dotfiles installed successfully!"
Write-Success "============================================================================"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. Restart PowerShell or run: . `$PROFILE"
Write-Host "  2. Verify `$env:HOME is set to C:\home"
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
