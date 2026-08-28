---
description: Show where session notes live and whether the pipeline is healthy; `tidy <path>` merges one file
argument-hint: [tidy <path>]
allowed-tools: Read, Write, Bash(node:*), Bash(git diff:*), Bash(git status:*), Bash(git ls-files:*), Bash(git add:*), Bash(git commit:*)
---

Session notes are written to `LESSONS.md` files by a background worker and
read at session start. This command shows them; it never writes to CLAUDE.md.

## Default: report

Run `node "$HOME/.claude/hooks/lessons-context.mjs" --report` and print its
output unchanged. Then stop. Do not summarise the lessons, do not edit
anything, do not offer to.

## `tidy <path>`

Only when the argument is `tidy` followed by a path to a `LESSONS.md`.

1. Read the file. The first line must be
   `<!-- claude-code lessons, auto-written -->`. If it is not, say the file
   was not written by the hook and stop.
2. Draft a merged version: combine bullets that say the same thing, drop
   bullets that are stale or would apply to any project, keep every bullet
   that is specific and still true. Keep the marker, the heading and the
   intro paragraph exactly. Keep the `- [YYYY-MM-DD] ` prefix, using the
   newest date of the bullets you merged. Do not add new lessons.
3. Show the user a diff of the change and the counts before and after.
   Wait for confirmation.
4. On confirmation write the file. If it is tracked by git, commit it alone
   with the message `Tidy LESSONS.md`. Otherwise do not stage it.
