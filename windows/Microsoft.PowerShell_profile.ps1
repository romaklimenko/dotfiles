# Set custom HOME directory - MUST be first line
$env:HOME = "C:\home"

# ============================================================================
# PowerShell Profile for Windows
# Author: Roman Klimenko (@romaklimenko)
# ============================================================================

# -----------------------------------------------------------------------------
# Aliases
# -----------------------------------------------------------------------------

# List commands
Set-Alias -Name ll -Value Get-ChildItem
Set-Alias -Name la -Value Get-ChildItem

# Editor
if (Get-Command nvim -ErrorAction SilentlyContinue) {
    Set-Alias -Name vim -Value nvim
    Set-Alias -Name vi -Value nvim
}

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------

# Navigation shortcuts
function cdh { Set-Location $env:HOME }
function dots { Set-Location "$env:HOME\dotfiles" }
function .. { Set-Location .. }
function ... { Set-Location ..\.. }
function .... { Set-Location ..\..\.. }

# Git shortcuts
function gs { git status $args }
function ga { git add $args }
function gc { git commit -m $args }
function gp { git push $args }
function gl { git log --oneline --graph --decorate $args }
function gd { git diff $args }
function gco { git checkout $args }
function gb { git branch $args }
function gpl { git pull $args }

# WSL integration
function ubuntu { wsl -d Ubuntu $args }
function wslh { wsl ~ }

# Utility functions
function which ($command) {
    Get-Command -Name $command -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Path -ErrorAction SilentlyContinue
}

function touch ($file) {
    if (Test-Path $file) {
        (Get-Item $file).LastWriteTime = Get-Date
    } else {
        New-Item -ItemType File -Path $file | Out-Null
    }
}

function grep {
    param(
        [Parameter(Mandatory=$true, Position=0)]
        [string]$Pattern,
        [Parameter(ValueFromPipeline=$true)]
        [string]$InputObject
    )

    if ($InputObject) {
        $InputObject | Select-String -Pattern $Pattern
    } else {
        Select-String -Pattern $Pattern $args
    }
}

# Enhanced ls function with colors
function lsa {
    Get-ChildItem -Force $args
}

# Show directory sizes
function du {
    param([string]$Path = ".")
    Get-ChildItem $Path -Recurse |
        Measure-Object -Property Length -Sum |
        Select-Object @{Name="Size(MB)";Expression={[math]::Round($_.Sum / 1MB, 2)}}, Count
}

# Quick directory navigation
function mkcd {
    param([string]$Path)
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    Set-Location $Path
}

# Open current directory in Windows Explorer
function explore {
    param([string]$Path = ".")
    explorer.exe (Resolve-Path $Path)
}

# -----------------------------------------------------------------------------
# Environment Configuration
# -----------------------------------------------------------------------------

# PSReadLine configuration for better command line editing
if (Get-Module -ListAvailable -Name PSReadLine) {
    Import-Module PSReadLine
    Set-PSReadLineOption -EditMode Windows
    Set-PSReadLineOption -PredictionSource History
    Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
    Set-PSReadLineKeyHandler -Key UpArrow -Function HistorySearchBackward
    Set-PSReadLineKeyHandler -Key DownArrow -Function HistorySearchForward
}

# -----------------------------------------------------------------------------
# Custom Prompt (Optional - uncomment to use)
# -----------------------------------------------------------------------------

# function prompt {
#     $location = Get-Location
#     $gitBranch = git rev-parse --abbrev-ref HEAD 2>$null
#
#     Write-Host "PS " -NoNewline -ForegroundColor Green
#     Write-Host "$location" -NoNewline -ForegroundColor Cyan
#
#     if ($gitBranch) {
#         Write-Host " [$gitBranch]" -NoNewline -ForegroundColor Yellow
#     }
#
#     return "> "
# }

# -----------------------------------------------------------------------------
# Welcome Message (Optional - uncomment to use)
# -----------------------------------------------------------------------------

# Write-Host "PowerShell Profile Loaded" -ForegroundColor Green
# Write-Host "HOME: $env:HOME" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# Load local overrides (if exists)
# -----------------------------------------------------------------------------

$localProfile = Join-Path $PSScriptRoot "profile.local.ps1"
if (Test-Path $localProfile) {
    . $localProfile
}
