# dotfiles

Cross-platform dotfiles configuration for Windows and Ubuntu (WSL/standalone) by Roman Klimenko ([@romaklimenko](https://github.com/romaklimenko)).

## Features

- **PowerShell Profile:** Custom Windows PowerShell configuration with:
  - `$env:HOME` set to `C:\home`
  - Useful aliases and functions
  - Git shortcuts
  - WSL integration helpers

- **Bash/Zsh Configuration:** Linux shell setup with:
  - Enhanced aliases
  - Improved history management
  - Git shortcuts
  - WSL detection and configuration

- **Neovim Configuration:** Modern Neovim setup (from [romaklimenko/nvim](https://github.com/romaklimenko/nvim))
  - Integrated as git submodule
  - Shared across Windows and Linux

- **Automated Installation:** One-line setup for new machines via [dotfiles.klimenko.dk](https://dotfiles.klimenko.dk)

## Quick Start

### Windows (PowerShell)

```powershell
irm dotfiles.klimenko.dk/install.ps1 | iex
```

### Linux / WSL

```bash
curl -fsSL dotfiles.klimenko.dk/install.sh | bash
```

**Security Note:** Always review scripts before running them. View the source at [github.com/romaklimenko/dotfiles](https://github.com/romaklimenko/dotfiles).

## Manual Installation

### Windows

1. Clone the repository:
```powershell
git clone https://github.com/romaklimenko/dotfiles.git C:\home\dotfiles
cd C:\home\dotfiles
```

2. Initialize Neovim submodule:
```powershell
git submodule init
git submodule update --remote
```

3. Link PowerShell profile:
```powershell
Copy-Item .\windows\Microsoft.PowerShell_profile.ps1 $PROFILE -Force
```

4. Link Neovim config (requires admin or Developer Mode):
```powershell
New-Item -ItemType SymbolicLink -Path "$env:LOCALAPPDATA\nvim" -Target "C:\home\dotfiles\nvim" -Force
```

5. Reload profile:
```powershell
. $PROFILE
```

### Linux / WSL

1. Clone the repository:
```bash
git clone https://github.com/romaklimenko/dotfiles.git ~/dotfiles
cd ~/dotfiles
```

2. Initialize Neovim submodule:
```bash
git submodule init
git submodule update --remote
```

3. Link dotfiles:
```bash
ln -sf ~/dotfiles/linux/.bashrc ~/.bashrc
ln -sf ~/dotfiles/linux/.bash_aliases ~/.bash_aliases
ln -sf ~/dotfiles/linux/.zshrc ~/.zshrc
ln -sf ~/dotfiles/linux/.profile ~/.profile
mkdir -p ~/.config
ln -sf ~/dotfiles/nvim ~/.config/nvim
```

4. Reload shell:
```bash
source ~/.bashrc
```

## Repository Structure

```
dotfiles/
├── .github/          # GitHub Actions workflows
│   └── workflows/
│       └── pages.yml # GitHub Pages deployment
├── install/          # Installation scripts and GitHub Pages
│   ├── install.ps1   # Windows installer
│   ├── install.sh    # Linux installer
│   └── index.html    # Landing page
├── windows/          # Windows-specific configurations
│   └── Microsoft.PowerShell_profile.ps1
├── linux/            # Linux/WSL configurations
│   ├── .bashrc
│   ├── .bash_aliases
│   ├── .zshrc
│   └── .profile
├── nvim/             # Neovim config (git submodule)
└── .gitignore        # Security patterns
```

## Updating

### Update Dotfiles

```bash
# In dotfiles directory
git pull
```

### Update Neovim Configuration

```bash
# Update submodule to latest commit
git submodule update --remote nvim

# Commit the submodule update (optional)
git add nvim
git commit -m "Update nvim configuration"
```

## Customization

Feel free to fork this repository and customize it for your needs:

1. Fork the repository
2. Clone your fork
3. Modify configurations
4. Update installation scripts to point to your fork
5. Set up your own GitHub Pages

### Local Overrides

For machine-specific configurations that shouldn't be committed:

**Windows:**
Create `C:\home\dotfiles\windows\profile.local.ps1` (gitignored) and source it from your profile.

**Linux:**
Create `~/.bashrc.local` (gitignored) and source it from `.bashrc`.

## Security

**WARNING:** Never commit sensitive information (API keys, passwords, tokens) to this repository.

- Review `.gitignore` to ensure sensitive files are excluded
- Use environment variables for secrets
- Consider using a separate, private repository for sensitive configurations
- Regularly audit commits for accidentally committed secrets
- See CLAUDE.md for detailed security guidelines

## Supported Environments

- **Windows:** Windows 10/11 with PowerShell 5.1+
- **Linux:** Ubuntu 20.04+ (WSL2 or standalone)
- **Shell:** Bash 4.0+, Zsh 5.0+

## Prerequisites

- Git
- PowerShell (Windows)
- Bash/Zsh (Linux)
- Neovim (optional, for nvim config)

## Troubleshooting

### Windows: PowerShell Execution Policy

If you get an execution policy error, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Linux: Permission Denied

Ensure install script is executable:
```bash
chmod +x install.sh
```

### Windows: Symbolic Links

Creating symbolic links on Windows requires either:
- Administrator privileges, or
- Developer Mode enabled (Settings → Update & Security → For developers)

### WSL: File Permissions

If you encounter file permission issues in WSL, ensure your files have correct permissions:
```bash
chmod 644 ~/.bashrc ~/.bash_aliases ~/.zshrc ~/.profile
```

## PowerShell Profile Features

The Windows PowerShell profile includes:

- **Custom HOME:** `$env:HOME` set to `C:\home`
- **Aliases:**
  - `ll`, `la` - List files
  - `vim`, `vi` - Opens Neovim (if installed)
- **Navigation Shortcuts:**
  - `cdh` - Go to HOME directory
  - `hh` - Go to HOME directory (if set)
  - `dots` - Go to dotfiles directory
  - `..`, `...`, `....` - Go up 1, 2, or 3 directories
- **Git Shortcuts:**
  - `gs` - git status
  - `ga` - git add
  - `gc` - git commit
  - `gp` - git push
  - `gl` - git log (oneline, graph, decorate)
  - `gd` - git diff
  - `gco` - git checkout
  - `gb` - git branch
  - `gpl` - git pull
- **Databricks Shortcuts:**
  - `d` - databricks
  - `db` - databricks bundle
  - `dbd` - databricks bundle deploy
  - `dbv` - databricks bundle validate
  - `dbr` - databricks bundle run
  - `dbs` - databricks bundle sync
  - `dw` - databricks workspace
  - `dj` - databricks jobs
  - `dc` - databricks clusters
  - `dfs` - databricks fs
- **WSL Integration:**
  - `ubuntu` - Launch WSL Ubuntu
  - `wslh` - Open WSL in home directory
- **Utility Functions:**
  - `pp` - Reload PowerShell profile
  - `which` - Find command location
  - `touch` - Create or update file timestamp
  - `grep` - Search text with patterns
  - `lsa` - List all files (including hidden)
  - `du` - Show directory size
  - `mkcd` - Create directory and cd into it
  - `explore` - Open directory in Windows Explorer

## Bash/Zsh Features

The Linux shell configuration includes:

- **Aliases:** Similar to PowerShell profile
- **History:** Enhanced history management (10,000 commands)
- **Editor:** Neovim set as default (`$EDITOR` and `$VISUAL`)
- **WSL Detection:** Automatically detects and configures WSL-specific settings
- **Git Integration:** Useful git aliases and shortcuts

## License

MIT License - see LICENSE file for details.

## Author

Roman Klimenko - [@romaklimenko](https://github.com/romaklimenko)

## Contributing

This is a personal dotfiles repository, but feel free to:
- Open issues for bugs or suggestions
- Fork and adapt for your own use
- Submit pull requests for improvements
