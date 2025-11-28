# dotfiles

This repository contains the [dotfiles](https://github.com/topics/dotfiles) configuration by Roman Klimenko ([@romaklimenko](https://github.com/romaklimenko)).

## Supported Environments

This setup supports the following environments:

- Windows
- Ubuntu (WSL or standalone)

## Development Guidelines

When making changes to this repository, ensure that README.md is updated accordingly to reflect any configuration modifications or new features.

## SECURITY WARNING

**CRITICAL:** Never commit sensitive information to this repository. This repository is intended to be public.

### Files That Should NEVER Be Committed:
- API keys, tokens, or passwords
- SSH private keys or certificates (`.ssh/id_*`, `*.key`, `*.pem`, `*.pfx`, `*.p12`)
- Cloud credentials (`.aws/credentials`, `.azure/credentials`, `.kube/config`)
- Database connection strings with credentials
- `.env` files with secrets (`.env`, `.env.local`, `.env.production`)
- Personal email addresses or phone numbers (if private)
- Company-specific or proprietary configurations
- Any file containing passwords or authentication tokens

### Best Practices:
1. **Review before committing:** Always use `git diff --staged` before every commit
2. **Use `.gitignore`:** Patterns for sensitive files are already configured
3. **Environment variables:** Store secrets in environment variables or secure vaults, never in files
4. **Placeholder values:** Use example values in configuration templates (e.g., `.env.example`)
5. **Regular audits:** Periodically review repository history for accidentally committed secrets
6. **Assume compromise:** If secrets are committed, assume they are compromised immediately:
   - Rotate all affected credentials immediately
   - Use `git filter-branch` or BFG Repo-Cleaner to remove from history
   - Force push to remote (coordinate with collaborators first)

### When in Doubt:
**Do NOT commit.** It's better to exclude too much than to expose sensitive data. If you're unsure whether something should be committed, err on the side of caution and exclude it.

