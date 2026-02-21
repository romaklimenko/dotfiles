---
allowed-tools: Read, Edit, Write, Glob, Grep
description: Remember a project-level preference for future sessions
---

The user wants to remember a project-level preference or instruction for future Claude Code sessions in this project.

Your task is to update the project-level `CLAUDE.md` file (in the project root) so that this preference is persisted across sessions.

## Steps

1. **Understand the preference.** The user's input is: $ARGUMENTS. Parse what they want remembered.

2. **Check for existing CLAUDE.md.** Look for a `CLAUDE.md` file in the current project root directory. If it exists, read it. If it doesn't, create one.

3. **Avoid duplicates.** If the preference (or something very similar) is already recorded, tell the user it's already there and skip the update.

4. **Update CLAUDE.md.** Add the new instruction to a section called `## Project Preferences`. If that section doesn't exist yet, create it. Append the new preference as a bullet point under that section. Do not remove or modify existing content — only append.

5. **Confirm.** Tell the user what was added and where.

## Rules

- Keep each preference concise — one bullet point, one clear instruction.
- Do not add redundant or vague entries.
- Do not modify unrelated sections of CLAUDE.md.
- If the preference is security-sensitive (e.g., contains secrets, tokens, passwords), refuse and warn the user.
- If no `$ARGUMENTS` are provided, ask the user what they want to remember.
