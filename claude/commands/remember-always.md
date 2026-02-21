---
allowed-tools: Read, Edit, Write, Glob, Grep
description: Remember a global preference for all future sessions
---

The user wants to remember a global preference or instruction that applies to ALL projects in future Claude Code sessions.

Your task is to update the user-level `~/.claude/CLAUDE.md` file so that this preference is persisted across all sessions and projects.

## Steps

1. **Understand the preference.** The user's input is: $ARGUMENTS. Parse what they want remembered.

2. **Read existing file.** Read `~/.claude/CLAUDE.md`. It should always exist.

3. **Avoid duplicates.** If the preference (or something very similar) is already recorded, tell the user it's already there and skip the update.

4. **Find the right section.** Determine which existing section the preference best fits into (e.g., Code Style, Communication, Git, Documentation, Security). If none fit, add the preference to a section called `## Global Preferences`. If that section doesn't exist yet, create it at the end of the file.

5. **Update the file.** Append the new preference as a bullet point under the chosen section. Do not remove or modify existing content — only append.

6. **Confirm.** Tell the user what was added and where.

## Rules

- Keep each preference concise — one bullet point, one clear instruction.
- Do not add redundant or vague entries.
- Do not modify unrelated content.
- If the preference is security-sensitive (e.g., contains secrets, tokens, passwords), refuse and warn the user.
- If no `$ARGUMENTS` are provided, ask the user what they want to remember.
