# TODO

## High Priority

- [ ] Test installation scripts on fresh Windows machine
- [ ] Test installation scripts on fresh Ubuntu installation
- [ ] Test installation scripts in WSL environment
- [ ] Verify Neovim configuration works on both platforms
- [ ] Test all PowerShell aliases and functions
- [ ] Test all Bash aliases and functions
- [ ] Verify GitHub Pages deployment
- [ ] Configure DNS for custom domain (klimenko.dk)

## Medium Priority

- [ ] Add more PowerShell aliases based on usage patterns
- [ ] Configure Zsh with Oh-My-Zsh (optional)
- [ ] Add tmux configuration
- [ ] Create backup/restore scripts
- [ ] Add shared git configuration (.gitconfig)
- [ ] Create update scripts (update.ps1 and update.sh)
- [ ] Add uninstall scripts for both platforms
- [ ] Add Windows Terminal settings
- [ ] Test on PowerShell Core (pwsh) vs Windows PowerShell

## Low Priority

- [ ] Add VSCode settings sync
- [ ] Document common workflows in docs/
- [ ] Add screenshot/demo to README
- [ ] Create CHANGELOG.md
- [ ] Add automated testing (PSScriptAnalyzer, shellcheck)
- [ ] Consider adding pre-commit hooks to scan for secrets
- [ ] Add GitHub Actions for script validation
- [ ] Create dotfiles bootstrapping for fresh OS installs
- [ ] Add theme management (terminal colors, etc.)

## Completed

- [x] Create .gitignore with security patterns
- [x] Add security warnings to CLAUDE.md
- [x] Create comprehensive README.md
- [x] Create TODO.md for task tracking
- [x] Create directory structure
- [x] Plan repository architecture

## Ideas / Future Enhancements

- Consider adding SSH config management (with care for security)
- Explore GNU Stow for dotfiles management
- Add automated backup to cloud storage
- Create installation script for macOS
- Add diff tool for comparing local configs with repo
- Create bootstrap script that installs prerequisites (Git, Neovim, etc.)
- Add support for different themes/color schemes
- Consider adding Docker configuration files
- Add Kubernetes config templates (kubectl aliases, etc.)
- Create a CLI tool for managing dotfiles
- Add support for multiple profiles (work, personal, etc.)

## Notes

- Always test changes in a safe environment before deploying
- Keep security as the top priority
- Document any breaking changes
- Consider backward compatibility for existing installations
