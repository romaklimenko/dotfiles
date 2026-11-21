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
├── claude/           # Claude settings
│   ├── CLAUDE.md     # One-line @AGENTS.md include
│   └── settings.json # Global settings
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
├── tests/            # Agent config sync tests (npm test)
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
- Node.js 20 or newer (for the agent config sync)
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

`agents/AGENTS.md` is the shared source for writing style, code, git, security
and workspace guidance. Installation copies it to `~/.claude/AGENTS.md`
and `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`). Claude's global
`CLAUDE.md` contains only `@AGENTS.md`. Repository instructions use the same
layout but remain separate from global preferences.

The writing rules separate chat replies, which stay terse, from documents
other people read, such as guides, wiki pages and READMEs. Those follow the
"Writing for readers" section: a named reader, an example after every rule,
the reader's own words, and a list of patterns that mark text as generated.

The installer and `dotsync` call `scripts/sync-agent-config.mjs`. To update
only agent configuration, run the manual-install command above. The sync
merges managed Claude settings, retains unrelated settings, hooks and local
commands, and backs up changed managed files. Identical repeated syncs do not
rewrite files. It does not edit Codex `config.toml`, authentication, or
`notify`. `--codex-home` can select a different Codex home explicitly.

Codex loads global AGENTS instructions in fresh sessions. A nonempty
`AGENTS.override.md` can supersede them. Project discovery normally starts at
the Git root, so the shared instructions also load applicable outer workspace
guidance when working in an independent nested clone.
[Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

### What the sync installs

- **Settings:** the defaults in `claude/settings.json` merge into `~/.claude/settings.json`. Local values win, and missing defaults are added. The permission rules stop Claude from reading `.env` files. Hooks that still run the retired lessons scripts are removed
- **Custom commands and hooks:** files in `claude/commands/` and `claude/hooks/` are copied to `~/.claude/commands/` and `~/.claude/hooks/`. The repository ships none at the moment. Local commands and hooks with other names are left alone
- **Global git ignore:** the patterns in `git/ignore` are installed into `~/.config/git/ignore`, which git reads when `core.excludesFile` is unset. An existing file is kept and only missing patterns are appended. It ignores `.claude/settings.local.json` in every repository, and `LESSONS.md`, the notes a retired Claude Code hook used to write. Tracked files are unaffected
- **Existing links:** Sync keeps commands/hooks directory links that already point to this repo. Other destinations use per-file copies; copied files need another sync after source changes. Links to unrelated directories are refused before writing
  - Check which you have with `ls -l ~/.claude/hooks`

### Configuration Paths

| Platform | Claude | Codex instructions |
|----------|--------|--------------------|
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
