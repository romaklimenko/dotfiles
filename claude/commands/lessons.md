---
description: Review lessons mined from past sessions and promote the good ones
allowed-tools: Read, Write, Edit, Bash(ls:*), Bash(cat:*), Bash(wc:*)
---

Curate the lessons queue. Automatic extraction is deliberately generous; this
command is the filter, and it is the only thing that writes to a CLAUDE.md.

## 1. Load

Read `~/.claude/lessons/pending.jsonl` (one JSON object per line). If it is
missing or empty, say so and stop.

Also read, for comparison:
- `~/.claude/CLAUDE.md` — where global lessons go
- `./CLAUDE.md` in the current project, if present — where project lessons go

## 2. Triage

Group the pending entries. For each, decide:

- **Duplicate** — the same point is already in one of the CLAUDE.md files, or
  another pending entry says it better. Merge into the stronger wording.
- **Stale** — refers to a project or tool the user has moved on from, or to a
  bug that has since been fixed. Drop.
- **Too generic** — would apply to any codebase. Drop, no matter how true.
- **Keep** — specific, actionable, still true.

Entries with `scope: "project"` belong in that project's CLAUDE.md, not the
global one. If the entry's `project` field does not match the current working
directory, hold it rather than writing it somewhere wrong.

## 3. Present

Show the user a compact table of what you propose to keep, with the target
file for each, plus counts of what you dropped and why. Do not write anything
yet. Wait for confirmation.

## 4. Apply

On confirmation:
- Append kept lessons under a `## Lessons learned` heading in the target file,
  as terse imperative bullets. Rewrite them to match the surrounding style —
  do not paste the raw `lesson` field verbatim.
- Never copy a client name, hostname, path, or identifier into
  `~/.claude/CLAUDE.md`.
- Rewrite `~/.claude/lessons/pending.jsonl` containing only the entries that
  were held for another project. Everything processed is removed.
- Append the applied entries to `~/.claude/lessons/archive.jsonl`.

## Notes

If the CLAUDE.md `## Lessons learned` section grows past roughly 30 bullets,
say so and offer to consolidate it before appending more. A lessons file
nobody reads is worse than no lessons file.
