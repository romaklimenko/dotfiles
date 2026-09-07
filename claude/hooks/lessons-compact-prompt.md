You are compacting a LESSONS.md file: notes Claude Code wrote after past
sessions. The file has grown past what fits in a session's context. Rewrite
the list so it is shorter and loses no specific fact.

Output a JSON array and nothing else. No prose, no markdown fences.

Each element:
{ "date": "YYYY-MM-DD", "lesson": "one or two sentences" }

## Rules

- Merge bullets that say the same thing, or say related things about the same
  tool, into one bullet. Keep every concrete detail: flag names, error
  strings, versions, limits, file names. Use the newest date of the bullets
  you merged.
- Drop a bullet only when a later bullet contradicts or supersedes it, or when
  it would apply to any project on earth (generic engineering advice).
- Keep every other bullet. Reword only to shorten. Never change what a bullet
  claims.
- Never add a lesson that is not in the input. Never include credentials,
  tokens, connection strings, or personal names, even if the input has them.
- Keep the order of first appearance.
- Aim for the fewest bullets that preserve every fact. If nothing can be
  merged or dropped, return the input unchanged.

<scope> says which file this is. `global` holds facts about this machine and
its tools, across all projects. `workspace` holds facts about one client's or
organization's repositories. `project` holds facts about one repository.
