# dotfiles

Cross-platform dotfiles configuration for Windows and Ubuntu (WSL/standalone) by Roman Klimenko ([@romaklimenko](https://github.com/romaklimenko)).

## Features

<!-- sync:features:start -->
- **PowerShell Profile:** Custom Windows PowerShell configuration with:
  - `$env:DEV_HOME` and `$env:DOTFILES_HOME` instead of overriding `$env:HOME`
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

- **Claude Code Configuration:** Shared [Claude Code](https://claude.ai/) settings across machines
  - Global `CLAUDE.md` instructions
  - Global settings (`settings.json`)
  - Custom slash commands
  - Session notes: a hook writes lessons from every session to `LESSONS.md` files and reads them back at session start. `/lessons` shows where they are

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

5. Install Claude Code configuration and the global git ignore:
```powershell
Copy-Item .\claude\settings.json "$env:USERPROFILE\.claude\settings.json" -Force
Copy-Item .\claude\CLAUDE.md "$env:USERPROFILE\.claude\CLAUDE.md" -Force
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\commands" -Target "C:\home\dotfiles\claude\commands" -Force
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\hooks" -Target "C:\home\dotfiles\claude\hooks" -Force
New-Item -ItemType Directory -Path "$env:USERPROFILE\.config\git" -Force
Copy-Item .\git\ignore "$env:USERPROFILE\.config\git\ignore" -Force
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

4. Install Claude Code configuration and the global git ignore:
```bash
mkdir -p ~/.claude ~/.config/git
cp ~/dotfiles/claude/settings.json ~/.claude/settings.json
cp ~/dotfiles/claude/CLAUDE.md ~/.claude/CLAUDE.md
ln -sfn ~/dotfiles/claude/commands ~/.claude/commands
ln -sfn ~/dotfiles/claude/hooks ~/.claude/hooks
cp ~/dotfiles/git/ignore ~/.config/git/ignore
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
│   ├── commands/     # Custom slash commands
│   └── hooks/        # Session notes: SessionStart reader, enqueue hook, worker
├── git/
│   └── ignore        # Global git ignore, installed to ~/.config/git/ignore
├── tests/            # node --test suite for the hooks (npm test)
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
- Node.js 20 or newer (for the Claude Code hooks)
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
- **Personal roots:** `$env:DEV_HOME` is `C:\home` and `$env:DOTFILES_HOME` is `C:\home\dotfiles`. `$env:HOME` is deliberately left alone, because setting it on Windows redirects git, ssh and gnupg away from the user profile
- **Aliases:**
  - `ll`, `la` - List files
  - `vim`, `vi` - Opens Neovim (if installed)
- **Navigation Shortcuts:**
  - `cdh`, `hh` - Go to `$env:DEV_HOME`
  - `dots` - Go to `$env:DOTFILES_HOME`
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
  - Writing style, human-readable output rules, code style, git, and security guidelines
- **Settings:** Global `settings.json` copied to `~/.claude/settings.json`
  - `denyRead` rules to prevent reading `.env` files
- **Custom Commands:** Slash commands symlinked to `~/.claude/commands/`
  - `/lessons` - Shows which `LESSONS.md` files apply to the current directory and whether the pipeline is healthy. `/lessons tidy <path>` merges one file while you watch
- **Hooks:** Session notes, symlinked to `~/.claude/hooks/`
  - `SessionStart` runs `lessons-context.mjs`. It injects every `LESSONS.md` that applies to the working directory: the directory itself, each parent up to the root, the project's out-of-tree copy under `~/.claude/lessons/projects/`, then `~/.claude/LESSONS.md`. Big files are clipped to head and tail. Files without the marker, or reached through a symlink, are listed by path but not injected. `SessionStart` also wakes the worker so it can sweep
  - `Stop` (at most once per 30 minutes per session), `PreCompact` and `SessionEnd` run `enqueue-lesson.mjs`. It queues a job and detaches `extract-lessons.mjs`
  - The worker reads the part of the transcript it has not seen, asks a cheap model for at most three lessons per chunk, and appends them as `- [date] lesson` bullets. Global lessons go to `~/.claude/LESSONS.md`, project lessons to `<repo>/LESSONS.md`. The evidence for each bullet goes to `~/.claude/lessons/log.jsonl`
  - The worker also sweeps `~/.claude/projects/` for transcripts that went quiet without a `SessionEnd`, so a killed window still gets its retrospective
  - A project file is written in-tree only when git is proven to ignore it or the project already tracks it. Otherwise it goes to `~/.claude/lessons/projects/<slug>/LESSONS.md`. A `LESSONS.md` without the `<!-- claude-code lessons, auto-written -->` marker is never touched
  - Nothing is curated into any `CLAUDE.md`. To share a project's notes with a team, run `git add -f LESSONS.md` once. From then on Claude commits changes to it in a commit of their own. Everything the worker appends to a tracked file gets committed, so track a file only where that is fine
  - A failed model call is retried with a growing backoff (one hour per attempt) and given up after five attempts; the log says which lines were skipped
  - Escape hatches: `CC_LESSONS_DISABLE=1` skips a session (the sweep honours it too), `CC_LESSONS_MODEL` (default `haiku`), `CC_LESSONS_MIN_TURNS` (default `6`, for `Stop`), `CC_LESSONS_MIN_TURNS_FINAL` (default `3`, for `SessionEnd`, `PreCompact` and the sweep), `CC_LESSONS_STOP_MINUTES` (default `30`)
  - The worker calls `claude -p` with `--tools ""`, `--setting-sources ""`, `--no-session-persistence` and hooks disabled. It clears `CLAUDECODE` from the child environment and passes the prompt on stdin. Without the first the CLI refuses to start as a nested session. Without the second a long transcript exceeds the Windows command-line limit and the spawn fails with `ENAMETOOLONG`
  - Runtime state lives in `~/.claude/lessons/` (queue, cursors, `lessons.log`), outside this repository. `npm test` runs the pipeline against a fake `claude`
- **Global git ignore:** the patterns in `git/ignore` are installed into `~/.config/git/ignore`, which git reads when `core.excludesFile` is unset. An existing file is kept and only missing patterns are appended. It ignores `LESSONS.md` and `.claude/settings.local.json` in every repository. Tracked files are unaffected. The worker also pins `LESSONS.md` in each repository's `.git/info/exclude`
- **Symlink fallback:** On Windows, `dotsync` symlinks `commands/` and `hooks/` only when Developer Mode is on or the shell is elevated. Otherwise it copies them. A copied directory means edits in this repository do not go live until `dotsync` runs again
  - Check which you have with `Get-Item ~/.claude/hooks | Select-Object LinkType`

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
