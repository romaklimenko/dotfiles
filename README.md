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

- **Claude Code and Codex Configuration:** One maintained instruction source for both agents
  - Shared `AGENTS.md`, with a one-line Claude include
  - Settings sync preserves unrelated local settings, hooks and Codex notifications
  - Shared project, workspace and user lessons: Claude extracts them through hooks; Codex reads and records them through the portable lessons command
  - Custom Claude slash commands, including `/lessons` for locations and pipeline health

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

5. Install shared agent configuration and the global git ignore (Node.js 20+):
```powershell
node .\scripts\sync-agent-config.mjs --repo . --home $env:USERPROFILE
New-Item -ItemType Directory -Path "$env:USERPROFILE/.config/git" -Force
$globalIgnore = "$env:USERPROFILE/.config/git/ignore"
foreach ($pattern in Get-Content .\git\ignore) {
    if (-not (Test-Path $globalIgnore) -or $pattern -notin @(Get-Content $globalIgnore)) {
        Add-Content -LiteralPath $globalIgnore -Value $pattern
    }
}
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

4. Install shared agent configuration and the global git ignore (Node.js 20+):
```bash
node ~/dotfiles/scripts/sync-agent-config.mjs --repo ~/dotfiles --home "$HOME"
mkdir -p ~/.config/git
touch ~/.config/git/ignore
while IFS= read -r pattern || [ -n "$pattern" ]; do
    grep -Fxq -- "$pattern" ~/.config/git/ignore || printf '\n%s\n' "$pattern" >> ~/.config/git/ignore
done < ~/dotfiles/git/ignore
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
├── AGENTS.md         # Repository development instructions
├── CLAUDE.md         # One-line @AGENTS.md include
├── agents/
│   └── AGENTS.md     # Global instructions installed for Claude and Codex
├── claude/           # Claude settings and shared lessons tools
│   ├── CLAUDE.md     # One-line @AGENTS.md include
│   ├── settings.json # Global settings
│   ├── commands/     # Custom slash commands
│   └── hooks/        # Shared reader/writer plus Claude extraction and compaction
├── git/
│   └── ignore        # Global git ignore, installed to ~/.config/git/ignore
├── scripts/          # Shared agent sync and README-to-website generation
├── tests/            # Isolated lessons and installer suites (npm test)
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
dotpull   # Pull from remote and apply (profile + shared agent config)
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
- See AGENTS.md for detailed security guidelines

## Supported Environments

- **Windows:** Windows 10/11 with PowerShell 5.1+
- **macOS:** macOS with Bash/Zsh (uses linux/ configs)
- **Linux:** Ubuntu 20.04+ (WSL2 or standalone)
- **Shell:** Bash 4.0+, Zsh 5.0+

## Prerequisites

- Git
- PowerShell (Windows)
- Bash/Zsh (Linux)
- Node.js 20 or newer (for shared agent sync and lessons tools)
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

## Claude Code and Codex Configuration

`agents/AGENTS.md` is the shared source for writing style, code, git, security,
workspace guidance and lessons. Installation copies it to `~/.claude/AGENTS.md`
and `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`). Claude's global
`CLAUDE.md` contains only `@AGENTS.md`. Repository instructions use the same
layout but remain separate from global preferences.

Both full installers and PowerShell `dotsync` call
`scripts/sync-agent-config.mjs`. To update only agent configuration, run the
manual-install command above. The sync merges managed Claude lesson hooks,
retains unrelated settings/hooks and local commands, and backs up changed
managed files. Identical repeated syncs do not rewrite files. It does not edit
Codex `config.toml`, authentication, plugins, or `notify`. `--codex-home` can
select a different Codex home explicitly.

Codex loads global AGENTS instructions in fresh sessions. A nonempty
`AGENTS.override.md` can supersede them. Project discovery normally starts at
the Git root, so the shared instructions also load applicable outer workspace
guidance when working in an independent nested clone.
[Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

### Portable lessons for both agents

The store stays under `~/.claude/lessons/`, with user lessons in
`~/.claude/LESSONS.md`; both agents use the same files. The legacy
`<!-- claude-code lessons, auto-written -->` marker remains valid. No migration
or duplicate Codex store is needed.

The shared instructions tell Codex to run the context command at task start and
record observable, durable lessons before finishing each task. This is an
agent-invoked workflow, not background Codex transcript extraction. It works
without a Claude CLI/model call and without installing Codex hooks or changing
notifications. Newer Codex clients offer hooks, but this setup also supports
clients that do not. [Codex hooks](https://learn.chatgpt.com/docs/hooks)

```powershell
# PowerShell; run from the task's repository.
node "$env:USERPROFILE/.claude/hooks/lessons.mjs" context
node "$env:USERPROFILE/.claude/hooks/lessons.mjs" report
```

```bash
# Bash/Zsh; run from the task's repository.
node "$HOME/.claude/hooks/lessons.mjs" context
node "$HOME/.claude/hooks/lessons.mjs" report
```

Both commands accept `--cwd <absolute-directory>`. Context includes the
project/workspace/global lessons, applicable out-of-tree files, and paths to
outer workspace guidance. Unmanaged or symlinked lesson files are listed rather
than injected.

`lessons.mjs record` accepts JSON on stdin:

```json
{
  "cwd": "<absolute task repository directory>",
  "agent": "codex",
  "lessons": [{
    "scope": "project",
    "lesson": "An observed environment fact that will still matter next time.",
    "evidence": "Exact short error or correction observed in the session.",
    "tags": ["tooling"]
  }]
}
```

Use `agent: claude` for immediate Claude recording. An optional `session`
identifies the session in the evidence log. No real transcript or model is read
by this command. The agent must select supported observations; a nonempty
`evidence` field alone cannot prove that the observation happened.

The writer allows at most three lessons (500 characters each; evidence up to
1000), requires evidence, rejects credential-like content, narrows scope,
deduplicates against applicable managed lessons, and uses the extraction and
compaction lock. It returns JSON with `recorded`, `skipped`, or `error`; errors
exit nonzero. A held lock returns `skipped` and must be retried after the other
writer finishes. No lesson/state writes occur for `CC_LESSONS_DISABLE`, worker
children, or temporary-directory tasks. This remains a supported file-reading
fallback if an agent has no hook facility; it cannot force a running client to
reload instructions.

Keep `LESSONS.md` ignored unless deliberately shared. The shared instructions
retain the existing separate-commit rule for already tracked lesson files,
subject to explicit user restrictions. Runtime state and evidence stay outside
this public repository. Do not record task summaries or duplicate facts already
in project instructions.

### Claude's background extraction

Existing Claude behavior is retained:

- **Settings:** Managed hooks merge into `~/.claude/settings.json`; existing local values are retained and missing defaults added
  - Permission rules include restrictions on reading `.env` files
- **Custom Commands:** Managed slash commands synced to `~/.claude/commands/`
  - `/lessons` - Shows which `LESSONS.md` files apply to the current directory and whether the pipeline is healthy. `/lessons compact <path>` merges one file now through the worker. `/lessons tidy <path>` merges one file while you watch
- **Hooks:** Session notes and shared tools synced to `~/.claude/hooks/`
  - Lessons live at three levels and each one is filed at the lowest level where it is still true. **Project** is the git repository. **Workspace** is the nearest directory above the repository that groups several repositories: it qualifies when it holds an `AGENTS.md`, a `CLAUDE.md`, a `.git`, a `*.code-workspace` file, or a `LESSONS.md` the hook wrote earlier. The home directory, anything above it and temp directories never qualify. **User** is `~/.claude/LESSONS.md`. A repository with no marked directory above it has no workspace, and its workspace-level lessons stay in the project
  - `SessionStart` runs `lessons-context.mjs`. It injects every `LESSONS.md` that applies to the working directory: the directory itself, each parent up to the root (which covers the project and the workspace), the out-of-tree copies under `~/.claude/lessons/projects/`, then `~/.claude/LESSONS.md`. A file over 12288 characters is shown as its header plus the newest bullets that fit, chosen by date, with a note saying how many older ones were left out. Files without the marker, or reached through a symlink, are listed by path but not injected. `SessionStart` also wakes the worker so it can sweep
  - `Stop` (at most once per 30 minutes per session), `PreCompact` and `SessionEnd` run `enqueue-lesson.mjs`. It queues a job and detaches `extract-lessons.mjs`
  - The worker reads the part of the transcript it has not seen, asks a cheap model for at most three lessons per chunk, each tagged `project`, `workspace` or `global`, and appends them as `- [date] lesson` bullets. The model sees the project and workspace paths and the bullets already on file for them. Whatever the model asked for, a lesson is then moved down: to the project when it names the project directory or a term in `~/.claude/lessons/private-terms.txt`, and to the workspace when it names the workspace directory, a hostname, or an absolute path outside the home directory. A path under the home directory describes this machine and stays global. The evidence for each bullet goes to `~/.claude/lessons/log.jsonl`
  - The worker also sweeps `~/.claude/projects/` for transcripts that went quiet without a `SessionEnd`, so a killed window still gets its retrospective
  - After each run the worker compacts the oversized files that apply to the directories it saw, not only the ones it appended to, so a project that goes quiet is still cleaned up. Over 10240 characters, at most once a day per file, a stronger model (`CC_LESSONS_COMPACT_MODEL`, default `sonnet`) merges bullets that say the same thing and drops the ones a later bullet made stale. The rewrite is refused when it adds bullets, keeps fewer than 40% of them, comes out longer than the file, loses more than 10% of the flags, identifiers, error constants and versions it was given, or earns nothing: it has to merge away at least 5% of the bullets or shrink the file by 10%. A refused file waits a week instead of a day. The bullets it replaced go to `~/.claude/lessons/compact.jsonl`. A file with hand-written lines between the bullets is never rewritten. `node ~/.claude/hooks/extract-lessons.mjs --compact <path>` compacts one file on demand, whatever its size, and exits non-zero if the model call fails
  - A project file is written in-tree only when git is proven to ignore it or the project already tracks it. Otherwise it goes to `~/.claude/lessons/projects/<slug>/LESSONS.md`, which is also where a project outside any repository keeps its notes. A workspace file follows the same proof inside a repository. A workspace outside any repository gets the file in place, because a directory only counts as a workspace when it was deliberately set up as one. A `LESSONS.md` without the `<!-- claude-code lessons, auto-written -->` marker is never touched
  - Nothing is curated into `AGENTS.md` or `CLAUDE.md`. To share a project's notes with a team, run `git add -f LESSONS.md` once. From then on either agent commits changes to it in a commit of their own, subject to explicit user restrictions. Everything the worker appends to a tracked file gets committed, so track a file only where that is fine
  - A failed model call is retried with a growing backoff (one hour per attempt) and given up after five attempts; the log says which lines were skipped
  - Escape hatches: `CC_LESSONS_DISABLE=1` skips a session (the sweep honours it too), `CC_LESSONS_MODEL` (default `haiku`), `CC_LESSONS_COMPACT_MODEL` (default `sonnet`), `CC_LESSONS_COMPACT_AT_CHARS` (default `10240`), `CC_LESSONS_COMPACT_HOURS` (default `24`), `CC_LESSONS_COMPACT_REJECT_HOURS` (default `168`), `CC_LESSONS_MIN_TURNS` (default `6`, for `Stop`), `CC_LESSONS_MIN_TURNS_FINAL` (default `3`, for `SessionEnd`, `PreCompact` and the sweep), `CC_LESSONS_STOP_MINUTES` (default `30`)
  - The worker calls `claude -p` with `--tools ""`, `--setting-sources ""`, `--no-session-persistence` and hooks disabled. It clears `CLAUDECODE` from the child environment and passes the prompt on stdin. Without the first the CLI refuses to start as a nested session. Without the second a long transcript exceeds the Windows command-line limit and the spawn fails with `ENAMETOOLONG`
  - Runtime state lives in `~/.claude/lessons/` (queue, cursors, `lessons.log`), outside this repository. `npm test` runs the pipeline and portable writer/install tests against isolated fixtures and a fake `claude`
- **Global git ignore:** the patterns in `git/ignore` are installed into `~/.config/git/ignore`, which git reads when `core.excludesFile` is unset. An existing file is kept and only missing patterns are appended. It ignores `LESSONS.md` and `.claude/settings.local.json` in every repository. Tracked files are unaffected. The worker also pins `LESSONS.md` in each repository's `.git/info/exclude`
- **Existing links:** Sync keeps commands/hooks directory links that already point to this repo. Other destinations use per-file copies; copied files need another sync after source changes. Links to unrelated directories are refused before writing
  - Check which you have with `Get-Item ~/.claude/hooks | Select-Object LinkType`

### Configuration Paths

| Platform | Claude and shared lessons | Codex instructions |
|----------|---------------------------|--------------------|
| Windows  | `%USERPROFILE%\.claude\` | `%USERPROFILE%\.codex\AGENTS.md` |
| macOS    | `~/.claude/` | `~/.codex/AGENTS.md` |
| Linux    | `~/.claude/` | `~/.codex/AGENTS.md` |

`CODEX_HOME` or the sync command's `--codex-home` option overrides the default
Codex location. Authentication and other Codex configuration remain client-owned.

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
