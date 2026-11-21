# dotfiles

Dotfiles for macOS and Ubuntu by Roman Klimenko ([@romaklimenko](https://github.com/romaklimenko)).

## Features

<!-- sync:features:start -->
- **Zsh with oh-my-zsh:** One shell setup for macOS and Ubuntu:
  - `DEV_HOME` (`~/Work`, one folder per workspace) and `DOTFILES_HOME` instead of overriding `HOME`
  - The standard oh-my-zsh aliases for git, ls and archives, plus Databricks shortcuts
  - Homebrew, cargo and `~/.local/bin` first on `PATH`, in login shells too
  - Tokens kept in the macOS Keychain and exported at shell start, never written to a file

- **tmux Configuration:** Made for running several coding agents side by side:
  - Ctrl+Space prefix, one session per workspace opened with `ws`, one window per agent
  - tmux windows and panes named after the agent's session, or after the folder at a shell prompt
  - Ctrl+Space, `w` lists every workspace and agent, so you can switch between them
  - Copied text goes to the system clipboard

- **Neovim Configuration:** VS Code-style editing shortcuts, multicursors, Telescope file tabs, and Git previews with Danish-keyboard alternatives (from [romaklimenko/nvim](https://github.com/romaklimenko/nvim))
  - Integrated as git submodule
  - Shared across macOS and Linux

- **Claude Code and Codex Configuration:** One maintained instruction source for both agents
  - Shared `AGENTS.md`, with a one-line Claude include
  - Settings sync preserves unrelated local settings, hooks and Codex notifications
  - Shared project, workspace and user lessons: Claude extracts them through hooks; Codex reads and records them through the portable lessons command
  - Custom Claude slash commands, including `/lessons` for locations and pipeline health

- **Automated Installation:** One-line setup for new machines via [dotfiles.klimenko.dk](https://dotfiles.klimenko.dk)
  - A Brewfile with the command-line tools for the Mac
  - Landing page with light and dark themes, matching the design of [klimenko.dk](https://klimenko.dk)
<!-- sync:features:end -->

## Quick Start

<!-- sync:quick-start:start -->
### macOS and Ubuntu

```bash
curl -fsSL dotfiles.klimenko.dk/install.sh | bash
```

The installer clones the repository to `~/Work/dotfiles`. On a new Mac, install the tools afterwards with `brew bundle --file ~/Work/dotfiles/Brewfile`.

**Security Note:** Always review scripts before running them. View the source at [github.com/romaklimenko/dotfiles](https://github.com/romaklimenko/dotfiles).
<!-- sync:quick-start:end -->

## Manual Installation

1. Clone the repository with the Neovim submodule:
```bash
git clone --recurse-submodules https://github.com/romaklimenko/dotfiles.git ~/Work/dotfiles
cd ~/Work/dotfiles
```

2. Install the tools. On macOS, with [Homebrew](https://brew.sh):
```bash
brew bundle --file Brewfile
```
On Ubuntu:
```bash
sudo apt update && sudo apt install zsh tmux neovim ripgrep fd-find git nodejs
chsh -s "$(command -v zsh)"
```

3. Install oh-my-zsh, if it isn't there yet:
```bash
git clone --depth=1 https://github.com/ohmyzsh/ohmyzsh.git ~/.oh-my-zsh
```

4. Link the configuration files. `ln -s` refuses to replace a file, so move existing ones out of the way first:
```bash
ln -s ~/Work/dotfiles/shell/.zshrc ~/.zshrc
ln -s ~/Work/dotfiles/shell/.zprofile ~/.zprofile
ln -s ~/Work/dotfiles/shell/.bashrc ~/.bashrc
ln -s ~/Work/dotfiles/shell/.profile ~/.profile
ln -s ~/Work/dotfiles/tmux/tmux.conf ~/.tmux.conf
mkdir -p ~/.config && ln -s ~/Work/dotfiles/nvim ~/.config/nvim
```

5. Install shared agent configuration and the global git ignore (Node.js 20+):
```bash
node ~/Work/dotfiles/scripts/sync-agent-config.mjs --repo ~/Work/dotfiles --home "$HOME"
mkdir -p ~/.config/git
touch ~/.config/git/ignore
while IFS= read -r pattern || [ -n "$pattern" ]; do
    grep -Fxq -- "$pattern" ~/.config/git/ignore || printf '\n%s\n' "$pattern" >> ~/.config/git/ignore
done < ~/Work/dotfiles/git/ignore
```

6. Open a new terminal, or run `exec zsh`.

`bash install/install.sh --local` does steps 3 to 5 in one go, and backs up the files it replaces.

To keep your workspaces somewhere other than `~/Work`, set `DEV_HOME` in `~/.zshenv` before you run the installer. The repository then goes to `$DEV_HOME/dotfiles`.

## Repository Structure

```
dotfiles/
├── .github/          # GitHub Actions workflows
│   └── workflows/
│       └── pages.yml # GitHub Pages deployment
├── AGENTS.md         # Repository development instructions
├── CLAUDE.md         # One-line @AGENTS.md include
├── Brewfile          # Command-line tools for the Mac (brew bundle)
├── agents/
│   └── AGENTS.md     # Global instructions installed for Claude and Codex
├── claude/           # Claude settings and shared lessons tools
│   ├── CLAUDE.md     # One-line @AGENTS.md include
│   ├── settings.json # Global settings
│   ├── commands/     # Custom slash commands
│   └── hooks/        # Shared reader/writer plus Claude extraction and compaction
├── git/
│   └── ignore        # Global git ignore, installed to ~/.config/git/ignore
├── install/          # Installation script and GitHub Pages
│   ├── install.sh    # macOS and Ubuntu installer
│   └── index.html    # Landing page
├── nvim/             # Neovim config (git submodule), linked to ~/.config/nvim
├── scripts/          # Shared agent sync and README-to-website generation
├── shell/            # zsh and bash, linked into the home folder
│   ├── env.sh        # DEV_HOME, DOTFILES_HOME, PATH and EDITOR for every shell
│   ├── aliases.sh    # Aliases and functions shared by zsh and bash
│   ├── .zshrc        # oh-my-zsh, options, ws completion
│   ├── .zprofile     # Login shells: PATH after macOS path_helper
│   ├── .bashrc
│   ├── .bash_aliases # bash versions of the oh-my-zsh aliases
│   └── .profile
├── tests/            # Isolated lessons and installer suites (npm test)
├── tmux/
│   └── tmux.conf     # tmux config, linked to ~/.tmux.conf
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
- `<!-- sync:shell-reference:start --> ... <!-- sync:shell-reference:end -->`

### Git Hook Setup (Recommended)

Set repository hooks path once to auto-sync before each commit:

```bash
git config core.hooksPath .githooks
```

## Updating

### Update Dotfiles

```bash
dotpull   # Pull from GitHub and apply: links, oh-my-zsh, agent config, git ignore
dotsync   # Apply the local repo without pulling (for testing changes)
```

The shell and tmux files are links into the repository, so a change applies in the next shell, or after Ctrl+Space, `r` in tmux. The Claude and Codex files are copies: run `dotsync` after you change `agents/`, `claude/` or `git/ignore`.

### Update Neovim Configuration

The Neovim submodule includes Ctrl+F for file search, Ctrl+D for multiple
selections, Ctrl+Z for undo, and Ctrl+W for closing tabs. Telescope opens file
results in tabs with Enter. Use F4 for project search, F6 for Git changes,
F7 for all matching selections, and F8/Shift+F8 to switch tabs when the
terminal captures Ctrl+Shift or Ctrl+Tab shortcuts. Press Space in normal mode
to see the shortcut menu. See the [Neovim shortcut guide](https://github.com/romaklimenko/nvim#everyday-shortcuts)
for the complete mappings and editing steps.

`~/.config/nvim` links to this submodule, so source changes are already
local. Restart Neovim after changes and install missing plugins with
`nvim --headless "+Lazy! install" +qa`. Plugin versions are pinned in the
submodule's `lazy-lock.json`. File icons need a
[Nerd Font](https://www.nerdfonts.com) in the terminal.

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

Machine-specific settings that shouldn't be committed go in files outside the repository:

- `~/.zshrc.local` for zsh. `.zshrc` loads it last, so it can override anything
- `~/.bashrc.local` and `~/.profile.local` for bash
- `~/.zshenv` for `DEV_HOME`, if your workspaces aren't in `~/Work`

### Tokens in the macOS Keychain

Tokens that tools read from environment variables, such as Husker's MCP access tokens, stay out of every file. Store each one in the login Keychain, then export it from `~/.zshrc.local`:

```bash
husker token --name labs-mac --list Labs | keychain-set HUSKER_ONLINE_TOKEN_LABS
```

```zsh
# ~/.zshrc.local
export HUSKER_ONLINE_URL="https://<app>.azurewebsites.net"
keychain-env HUSKER_ONLINE_TOKEN HUSKER_ONLINE_TOKEN_LABS
```

`keychain-set` passes the value to `security` on stdin, so it never shows up in the process list. Each lookup at shell start takes about 15 ms. To remove a token, run `security delete-generic-password -s NAME`, or search for its name in Keychain Access.

## Security

**WARNING:** Never commit sensitive information (API keys, passwords, tokens) to this repository.

- Review `.gitignore` to ensure sensitive files are excluded
- Use environment variables for secrets
- Consider using a separate, private repository for sensitive configurations
- Regularly audit commits for accidentally committed secrets
- See AGENTS.md for detailed security guidelines

## Supported Environments

- **macOS:** Apple silicon or Intel, with zsh (the default shell)
- **Linux:** Ubuntu 22.04 or newer, with zsh or bash
- **Shell:** Zsh 5.8+, Bash 4.0+

## Prerequisites

- Git
- Zsh (default on macOS, `sudo apt install zsh` on Ubuntu). bash works too, without oh-my-zsh
- Homebrew on macOS, for the Brewfile
- Node.js 20 or newer (for shared agent sync and lessons tools)
- Neovim 0.11.3 or newer and ripgrep (optional, for the nvim config)
- tmux (optional, for the tmux config)

## Troubleshooting

### macOS: commands come from /usr/bin instead of Homebrew

Every new terminal window and tmux pane on macOS starts a login shell. Its `/etc/zprofile` runs `path_helper`, which moves `/usr/bin` in front of everything else. `~/.zprofile` loads `shell/env.sh` again afterwards, which puts Homebrew, cargo and `~/.local/bin` back in front. If `which git` shows `/usr/bin/git`, check that `~/.zprofile` links to `shell/.zprofile`, then open a new terminal.

### Permission Denied

Run the installer with bash instead of executing it:
```bash
bash install/install.sh --local
```

## Shell Reference

The zsh configuration includes:

<!-- sync:shell-reference:start -->
- **Personal roots:** `DEV_HOME` is `~/Work` and `DOTFILES_HOME` is `~/Work/dotfiles`. `HOME` is left alone, because git, ssh and most other tools read it
- **Editor:** `EDITOR` and `VISUAL` are `nvim`. `vim` and `vi` open Neovim
- **oh-my-zsh:** robbyrussell theme with the `git`, `common-aliases`, `extract`, `gh`, `uv`, `rust`, `npm`, `python` and `codex` plugins, plus `macos` and `brew` on macOS or `ubuntu` on Ubuntu. bash gets the same alias names from `shell/.bash_aliases`. `rm`, `cp` and `mv` don't ask before they act, because coding agents run commands with these aliases and can't answer
- **Git Shortcuts (oh-my-zsh):**
  - `gst` - git status
  - `ga`, `gaa` - git add, git add --all
  - `gc` - git commit --verbose. `gcmsg "message"` commits with a message
  - `gp` - git push
  - `gl` - git pull
  - `gf` - git fetch
  - `gd`, `gds` - git diff, git diff --staged
  - `gco`, `gsw`, `gb`, `gba`, `gm` - git checkout, switch, branch, branch --all, merge
  - `grv` - git remote --verbose
  - `glog` - git log as a graph, one line per commit. `glol` adds dates and authors
- **Navigation Shortcuts:**
  - `cdh`, `hh` - Go to `$DEV_HOME`
  - `dots` - Go to `$DOTFILES_HOME`
  - `..`, `...`, `....` - Go up 1, 2, or 3 directories
  - `mkcd`, `take` - Create a directory and go into it
  - `ll`, `la`, `lt` - List files: long, with hidden files, newest first
- **Databricks Shortcuts:**
  - `dbcfg` - Open `~/.databrickscfg` in the editor
  - `d` - databricks. It replaces oh-my-zsh's `d`, which lists the directory stack
  - `db` - databricks bundle
  - `dbd` - databricks bundle deploy
  - `dbv` - databricks bundle validate
  - `dbr` - databricks bundle run
  - `dbs` - databricks bundle sync
  - `dw` - databricks workspace
  - `dj` - databricks jobs
  - `dc` - databricks clusters
  - `dfs` - databricks fs
- **tmux:**
  - `ws` - Open a workspace as a tmux session. `ws backstage` opens `~/Work/backstage`, and Tab completes workspace names
- **Dotfiles Management:**
  - `dotsync` - Apply dotfiles from local repo to system (for testing without committing)
  - `dotpull` - Pull latest from remote repo and apply
- **Secrets (macOS):**
  - `keychain-set NAME` - Store one line from stdin in the login Keychain
  - `keychain-env NAME...` - Export stored values as environment variables, from `~/.zshrc.local`
- **Utility Functions:**
  - `extract`, `x` - Unpack an archive of any common type
  - `myip`, `myip6` - Show external IPv4 or IPv6 address
  - `ofd` - Open the current folder in Finder (macOS)
  - `omz reload` - Reload zsh after a configuration change
<!-- sync:shell-reference:end -->

## tmux

The tmux config is for running several coding agents side by side, on macOS and Ubuntu. Install tmux with `brew install tmux` on macOS (it is in the Brewfile) or `sudo apt install tmux` on Ubuntu.

### Open one session per workspace

Give each workspace in `~/Work` its own tmux session, and give each agent its own window in that session. Open a workspace with `ws`:

```bash
ws backstage   # opens ~/Work/backstage as the session "backstage"
ws             # opens the current folder
```

`ws backstage` opens `./backstage` if there is one, and `$DEV_HOME/backstage` otherwise. Tab after `ws` completes the workspace names. Outside tmux, `ws` starts the session and attaches to it. Inside tmux, it switches your view to that session. If the session already exists, `ws` goes back to it.

In a session, press Ctrl+Space and then `c` to open a new window in the workspace folder, and start an agent there.

### Switch between agents with Ctrl+Space, w

Press Ctrl+Space, then `w`. A list opens with every session and its windows, one window per agent, named after the agent's session.

Each session is one workspace, and `(attached)` marks the one a terminal shows now. Under it are its windows, numbered `1:`, `2:` and so on, and `*` marks the window you are in. The list unfolds the window you are in, so its pane gets a line of its own that repeats the window's name: it is the same agent, once as the window and once as its pane. Each line starts with a key in brackets, such as `(3)`. Press that key to go there at once.

Use these keys in the list:

| Keys | Action |
| --- | --- |
| Up, Down | Move through the list |
| Enter | Go to the selected window or pane |
| The key in brackets, such as `3` | Go to that line at once |
| Left, Right | Fold or unfold a session or window |
| `v` | Show or hide a preview of the selected window |
| `x` | Close the selected window, after you confirm |
| Esc or `q` | Close the list |

Ctrl+Space, `s` shows only the sessions, one per workspace. Both lists open without the preview.

### Keys

The prefix is Ctrl+Space. Press it, release it, and then press the key in the table. Ctrl+Space, `?` lists every key.

| Keys | Action |
| --- | --- |
| Ctrl+Space, `w` | List sessions and windows, and switch |
| Ctrl+Space, `s` | List sessions, and switch |
| Ctrl+Space, `(` or `)` | Go to the previous or next session |
| Ctrl+Space, `1` to `9` | Go to that window |
| Ctrl+Space, `n` or `p` | Go to the next or previous window |
| Ctrl+Space, `c` | Open a new window in the current pane's folder |
| Ctrl+Space, `,` | Rename the window. The name stays until you rename it again |
| Ctrl+Space, `&` | Close the window, after you confirm |
| Ctrl+Space, `"` | Split the pane into top and bottom, in the same folder |
| Ctrl+Space, `%` | Split the pane into left and right, in the same folder |
| Ctrl+Space, `h` `j` `k` `l` | Move to the pane on the left, below, above or on the right |
| Ctrl+Space, `z` | Zoom the pane to the full window, or back |
| Ctrl+Space, `!` | Move the pane to a window of its own |
| Ctrl+Space, `x` | Close the pane, after you confirm |
| Ctrl+Space, `[` | Scroll back through the pane's output and copy text, as described in "Copy text" below. `q` leaves. The mouse wheel scrolls too |
| Ctrl+Space, `]` | Paste the text you copied last in tmux |
| Ctrl+Space, `$` | Rename the session |
| Ctrl+Space, `d` | Detach. The session keeps running, and `ws` brings it back |
| Ctrl+Space, `r` | Reload the config |
| Ctrl+Space, `:` | Type a tmux command, such as `kill-session` |
| Ctrl+Space, Ctrl+Space | Send Ctrl+Space to the program in the pane |

These commands work in any shell:

| Command | Action |
| --- | --- |
| `tmux ls` | List the running sessions |
| `ws backstage` | Open or go back to a workspace's session |
| `tmux kill-session -t backstage` | Close one session and everything running in it |
| `tmux kill-server` | Close every session |

On macOS, Ctrl+Space also switches the input source when you have more than one keyboard layout. If Ctrl+Space changes the layout instead of reaching tmux, turn off "Select the previous input source" in System Settings, Keyboard, Keyboard Shortcuts, Input Sources.

### Copy text

Copied text goes to the system clipboard, so you can paste it anywhere with Cmd+V. tmux hands the text to the terminal (OSC 52), which also works in a tmux on another machine over ssh. On macOS it also passes the text to `pbcopy`, for terminals that ignore OSC 52, such as Terminal.app.

To copy with the mouse, drag over the text in a shell pane. The text is copied when you release the button.

Some programs take the mouse for themselves, and Claude Code can be one of them. If a drag selects nothing, use one of these instead:

- Let the terminal select the text itself: hold Option while you drag in iTerm2 or Terminal.app, or Shift in Ghostty and most Linux terminals. Copy with Cmd+C. This selects what is on the screen, so with split panes the selection can run into the next pane.
- Press Ctrl+Space, then `[`, and then drag. In copy mode tmux handles the mouse, whatever program runs in the pane.

To copy older output, scroll up with the mouse wheel first. Scrolling puts the pane in copy mode, and you can drag there. If the program in the pane takes the mouse wheel too, press Ctrl+Space, then `[`, and scroll up with PgUp.

To copy with the keyboard:

1. Press Ctrl+Space, then `[`. The pane's view stops following new output, and a cursor appears that you can move.
2. Move to the start of the text with the arrow keys, PgUp and PgDn.
3. Press Space to start the selection, and move to the end of the text.
4. Press Enter. tmux copies the text and leaves copy mode.

In copy mode, Esc clears a selection you started, and `q` leaves without copying. Copy mode uses vi keys, so `/` searches forward and `?` searches back.

### How panes get their names

Claude Code sets the terminal title to its session name, with a status symbol in front, such as `✳ Translate recent articles to Danish`. The config shows that title without the symbol. The same name appears in the status bar, in the terminal's tab title after the session name, and in Ctrl+Space, `w`.

Other panes are named this way:

- A pane at a shell prompt shows its folder name, such as `backstage`.
- A program that sets no title shows its command name, such as `nvim`.
- Codex puts the folder name in the title, so a Codex pane shows the folder, not the task.

### Restore sessions after a restart

Sessions don't survive a reboot or `tmux kill-server`. Run `ws` for each workspace to open them again. To restore sessions automatically, use [tmux-resurrect](https://github.com/tmux-plugins/tmux-resurrect). This repository doesn't install it.

### Config files

| File in this repository | Installed to | Used by |
| --- | --- | --- |
| `tmux/tmux.conf` | `~/.tmux.conf` (link) | tmux |

The installer links the file, so a change in the repository applies at the next reload.

## Claude Code and Codex Configuration

`agents/AGENTS.md` is the shared source for writing style, code, git, security,
workspace guidance and lessons. Installation copies it to `~/.claude/AGENTS.md`
and `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`). Claude's global
`CLAUDE.md` contains only `@AGENTS.md`. Repository instructions use the same
layout but remain separate from global preferences.

The writing rules separate chat replies, which stay terse, from documents
other people read, such as guides, wiki pages and READMEs. Those follow the
"Writing for readers" section: a named reader, an example after every rule,
the reader's own words, and a list of patterns that mark text as generated.

The installer and `dotsync` call `scripts/sync-agent-config.mjs`. To update
only agent configuration, run the manual-install command above. The sync
merges managed Claude lesson hooks, retains unrelated settings/hooks and local
commands, and backs up changed managed files. Identical repeated syncs do not
rewrite files. It does not edit Codex `config.toml`, authentication, or
`notify`. `--codex-home` can select a different Codex home explicitly.

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
  - The worker calls `claude -p` with `--tools ""`, `--setting-sources ""`, `--no-session-persistence` and hooks disabled. It clears `CLAUDECODE` from the child environment and passes the prompt on stdin. Without the first the CLI refuses to start as a nested session. Passing the prompt on stdin keeps a long transcript clear of the command-line length limit
  - Runtime state lives in `~/.claude/lessons/` (queue, cursors, `lessons.log`), outside this repository. `npm test` runs the pipeline and portable writer/install tests against isolated fixtures and a fake `claude`
- **Global git ignore:** the patterns in `git/ignore` are installed into `~/.config/git/ignore`, which git reads when `core.excludesFile` is unset. An existing file is kept and only missing patterns are appended. It ignores `LESSONS.md` and `.claude/settings.local.json` in every repository. Tracked files are unaffected. The worker also pins `LESSONS.md` in each repository's `.git/info/exclude`
- **Existing links:** Sync keeps commands/hooks directory links that already point to this repo. Other destinations use per-file copies; copied files need another sync after source changes. Links to unrelated directories are refused before writing
  - Check which you have with `ls -l ~/.claude/hooks`

### Configuration Paths

| Platform | Claude and shared lessons | Codex instructions |
|----------|---------------------------|--------------------|
| macOS    | `~/.claude/` | `~/.codex/AGENTS.md` |
| Linux    | `~/.claude/` | `~/.codex/AGENTS.md` |

`CODEX_HOME` or the sync command's `--codex-home` option overrides the default
Codex location. Authentication and other Codex configuration remain client-owned.

### Adding Custom Commands

Create `.md` files in `claude/commands/` to add new slash commands. See the [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for the command format.

## License

MIT License - see LICENSE file for details.

## Author

Roman Klimenko - [@romaklimenko](https://github.com/romaklimenko)

## Contributing

This is a personal dotfiles repository, but feel free to:
- Open issues for bugs or suggestions
- Fork and adapt for your own use
- Submit pull requests for improvements
