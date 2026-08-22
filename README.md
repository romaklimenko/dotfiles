# dotfiles

Cross-platform dotfiles configuration for Windows and Ubuntu (WSL/standalone) by Roman Klimenko ([@romaklimenko](https://github.com/romaklimenko)).

## Features

<!-- sync:features:start -->
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

- **Claude Code Configuration:** Shared [Claude Code](https://claude.ai/claude-code) settings across machines
  - Global `CLAUDE.md` instructions
  - Global settings (`settings.json`)
  - Custom slash commands

- **Automated Installation:** One-line setup for new machines via [dotfiles.klimenko.dk](https://dotfiles.klimenko.dk)
  - Landing page with light and dark themes, matching the design of [klimenko.dk](https://klimenko.dk)
<!-- sync:features:end -->

## Quick Start

<!-- sync:quick-start:start -->
### Windows (PowerShell)

```powershell
irm dotfiles.klimenko.dk/install.ps1 | iex
```

### Linux / WSL

```bash
curl -fsSL dotfiles.klimenko.dk/install.sh | bash
```

**Security Note:** Always review scripts before running them. View the source at [github.com/romaklimenko/dotfiles](https://github.com/romaklimenko/dotfiles).
<!-- sync:quick-start:end -->

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

5. Install Claude Code configuration:
```powershell
Copy-Item .\claude\settings.json "$env:USERPROFILE\.claude\settings.json" -Force
Copy-Item .\claude\CLAUDE.md "$env:USERPROFILE\.claude\CLAUDE.md" -Force
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\commands" -Target "C:\home\dotfiles\claude\commands" -Force
```

6. Reload profile:
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

4. Install Claude Code configuration:
```bash
mkdir -p ~/.claude
cp ~/dotfiles/claude/settings.json ~/.claude/settings.json
cp ~/dotfiles/claude/CLAUDE.md ~/.claude/CLAUDE.md
ln -sf ~/dotfiles/claude/commands ~/.claude/commands
```

5. Reload shell:
```bash
source ~/.bashrc
```

## Repository Structure

```
dotfiles/
├── .github/          # GitHub Actions workflows
│   └── workflows/
│       └── pages.yml # GitHub Pages deployment
├── claude/           # Claude Code configuration
│   ├── CLAUDE.md     # Global instructions for all projects
│   ├── settings.json # Global settings
│   └── commands/     # Custom slash commands
├── install/          # Installation scripts and GitHub Pages
│   ├── install.ps1   # Windows installer
│   ├── install.sh    # Linux/macOS installer
│   └── index.html    # Landing page
├── windows/          # Windows-specific configurations
│   └── Microsoft.PowerShell_profile.ps1
├── linux/            # Linux/macOS/WSL configurations
│   ├── .bashrc
│   ├── .bash_aliases
│   ├── .zshrc
│   └── .profile
├── nvim/             # Neovim config (git submodule)
└── .gitignore        # Security patterns
```

## Docs Sync

`README.md` is the source of truth for shared install documentation.
`install/index.html` is partially generated from marker blocks in this README.

### Sync Commands

```bash
npm run sync:docs       # Generate install/index.html from README.md
npm run sync:docs:check # Verify generated content is up to date
```

### Marker Blocks

The generator currently syncs these marker ranges in `README.md`:

- `<!-- sync:quick-start:start --> ... <!-- sync:quick-start:end -->`
- `<!-- sync:features:start --> ... <!-- sync:features:end -->`
- `<!-- sync:powershell-reference:start --> ... <!-- sync:powershell-reference:end -->`

### Git Hook Setup (Recommended)

Set repository hooks path once to auto-sync before each commit:

```bash
git config core.hooksPath .githooks
```

## Updating

### Update Dotfiles (PowerShell)

Use the built-in profile commands:

```powershell
dotpull   # Pull from remote and apply (profile + Claude Code config)
dotsync   # Apply from local repo without pulling (for testing changes)
```

Or manually:

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
- **macOS:** macOS with Bash/Zsh (uses linux/ configs)
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

<!-- sync:powershell-reference:start -->
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
  - `gpsh` - git push
  - `gl` - git log (oneline, graph, decorate)
  - `gd` - git diff
  - `gco` - git checkout
  - `gb` - git branch
  - `gpll` - git pull
- **Databricks Shortcuts:**
  - `dbcfg` - Open `.databrickscfg` in editor
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
- **Dotfiles Management:**
  - `dotsync` - Apply dotfiles from local repo to system (for testing without committing)
  - `dotpull` - Pull latest from remote repo and apply
- **Utility Functions:**
  - `pp` - Reload PowerShell profile
  - `which` - Find command location
  - `touch` - Create or update file timestamp
  - `grep` - Search text with patterns
  - `lsa` - List all files (including hidden)
  - `du` - Show directory size
  - `mkcd` - Create directory and cd into it
  - `myip` - Show external IPv4 address
  - `myip6` - Show external IPv6 address
  - `explore` - Open directory in Windows Explorer
<!-- sync:powershell-reference:end -->

## Claude Code Configuration

The Claude Code configuration is shared across all platforms:

- **Global CLAUDE.md:** Instructions that apply to all projects, copied to `~/.claude/CLAUDE.md`
- **Settings:** Global `settings.json` copied to `~/.claude/settings.json`
  - `denyRead` rules to prevent reading `.env` files
- **Custom Commands:** Slash commands symlinked to `~/.claude/commands/`
  - `/commit-message` - Analyzes staged changes and suggests a commit message
  - `/pr` - Generates a PR title and description in markdown vs main/master
  - `/remember` - Saves a project-level preference to CLAUDE.md for future sessions
  - `/remember-always` - Saves a global preference to ~/.claude/CLAUDE.md for all projects

### Configuration Paths

| Platform | Config directory |
|----------|-----------------|
| Windows  | `%USERPROFILE%\.claude\` |
| macOS    | `~/.claude/` |
| Linux    | `~/.claude/` |

### Adding Custom Commands

Create `.md` files in `claude/commands/` to add new slash commands. See the [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for the command format.

## Bash/Zsh Features

The Linux shell configuration includes:

- **Aliases:** Similar to PowerShell profile
- **History:** Enhanced history management (10,000 commands)
- **Editor:** Neovim set as default (`$EDITOR` and `$VISUAL`)
- **WSL Detection:** Automatically detects and configures WSL-specific settings
- **Git Integration:** Useful git aliases and shortcuts
- **Network Utilities:** `myip`, `myip6`, `localip`, `ports`, `ping`

## License

MIT License - see LICENSE file for details.

## Author

Roman Klimenko - [@romaklimenko](https://github.com/romaklimenko)

## Contributing

This is a personal dotfiles repository, but feel free to:
- Open issues for bugs or suggestions
- Fork and adapt for your own use
- Submit pull requests for improvements
