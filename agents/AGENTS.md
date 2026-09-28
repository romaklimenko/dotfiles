# Shared Claude Code and Codex Instructions

These instructions apply to both agents unless overridden by project-level guidance.
Keep shared rules in AGENTS.md; CLAUDE.md contains only an @AGENTS.md include.

# Writing Style

- **Caveman mode is on by default, at `full` intensity.** Follow the
  `caveman` skill for every response, in every project, without being asked.
  Drop articles and filler, fragments are fine, short synonyms win. Technical
  terms stay exact, code blocks stay unchanged, error text stays quoted
  verbatim. Switch with `/caveman lite|full|ultra`; turn it off for the
  session with "stop caveman" or "normal mode"
- Drop caveman for the parts the skill says to: security warnings,
  confirmations of irreversible actions, multi-step sequences where fragment
  order could be misread, and any time I ask you to clarify or repeat
  yourself. Resume after
- Commits, PRs and code are written normally, never in caveman
- Use clear, concise language
- Use short sentences and paragraphs
- Avoid "—" and other long dashes; use a single hyphen instead

## Human-Readable Output

These rules cover everything a human reads: chat responses, code comments,
commit bodies, markdown and docs. Remember that the reader has less context
than you and is probably skimming. Write so the point lands on the first
read.

- One idea per sentence. If a sentence joins two clauses with "which" or a
  semicolon, it is usually two sentences
- Every sentence should stand on its own. If it only makes sense after the
  previous three, split it or restate the subject
- Say the conclusion first, then the reason. Not the reason, then the
  conclusion
- Use plain English. "use" not "utilize", "so" not "in order to", "start"
  not "commence". Cut words that only exist to sound thorough: leverage,
  robust, seamless, comprehensive, delve, landscape, ensure that
- No em dashes or en dashes. Use a hyphen, a comma, or a full stop
- No "it's not just X, it's Y" and no "this isn't about X, it's about Y"
- Don't open by restating the question. Don't close by summarising what you
  just said
- Be concrete. Name the file, the function, the number. "Slow" is not a
  finding, "300 ms on the auth lookup" is
- If a sentence can't be checked as true or false, delete it

### When completeness beats brevity

Readability is the default, not a hard cap. In specs, RFCs, ADRs, API
contracts, migration plans and security notes, being complete and
non-contradicting matters more than being short. There:

- Prefer explicit and repetitive over elegant. Restate the subject instead
  of writing "it"
- Use precise qualifiers: must, must not, should, may
- Enumerate every case, including the boring ones
- Use one defined term per concept, spelled the same way every time. No
  synonyms
- State what is out of scope, so a gap doesn't read as an omission

Still use short sentences and plain words. Extra length is allowed. Dense,
hard-to-parse prose is not.

## Code Style

- Write clean, readable code with meaningful variable and function names
- Prefer simplicity over cleverness
- Follow existing conventions in the project

## Communication

- Be concise and direct
- Don't add emojis unless asked
- Don't over-explain obvious things

## Git

- Use imperative mood in commit messages ("Add feature" not "Added feature")
- Keep commit messages under 50 characters for the summary line

## Documentation

- If the project has a README.md, update it to reflect any changes you make

## Security

- Never commit secrets, API keys, tokens, or passwords
- Never commit .env files with real values
- If you spot a potential secret in code, flag it immediately

## Workspace guidance

A session usually starts in one git repository. That repository may be a
sub-repo: a clone that sits inside a workspace, a directory above it that
groups several repositories, often as a VS Code multi-root workspace. Before
starting work, check whether the parent directory, or the one above it, holds
any of these: an `AGENTS.md` or `CLAUDE.md`, a `*.code-workspace` file, a
`.git` directory, or a `LESSONS.md`. Any of them means the session is in a
sub-repo. Do this check explicitly, because Codex can start discovery at the
clone's Git root and never see the grouping directory. The lessons context
command below lists the outer workspace first.

When the session is in a sub-repo:

- Read the workspace's `AGENTS.md` first. If the workspace only has
  `CLAUDE.md`, read that and follow its includes. Then read the repository's
  own instructions. On a conflict the repository's file wins, unless the
  workspace file names a rule that holds in every repository.
- The sibling directories are separate repositories, each with its own
  branches, remote and pull requests. The `folders` list in the
  `*.code-workspace` file names them. Search them for prior art and shared
  conventions, and read their instruction files when the task touches them.
- Git commands act on the current repository only. Never stage, commit or
  push from the workspace root or inside a sibling during this session. If the
  task needs a change in a sibling repository, say so and treat it as a
  separate change with its own branch and pull request. The workspace file may
  say how the branches and work items are linked.
- The workspace root may be its own git repository that deliberately leaves
  the sub-repos untracked. Its status listing the current repository as
  untracked is normal, not something to fix.
- Workspace-level files such as notes, todo lists and checklists describe more
  than one repository. Read the ones the workspace file points to. Paths in
  them are relative to the workspace root, not to the repository.
- Diff review tools such as hunk see only the repository the session started
  in. One session therefore covers one repository. A task that spans several
  repositories is split into one session and one change per repository.

## Lessons

Claude and Codex share the existing `LESSONS.md` files and the store under
`~/.claude/lessons/`. The directory and legacy marker remain for compatibility.
Claude's hooks extract lessons in the background. Codex records lessons through
the command below using evidence from its active session; it does not depend on
Claude hooks, a model subprocess, or a Codex transcript format.

At the first task of a session, and when switching repositories, read the
applicable lessons. When no current `<lessons>` block was supplied, run:

- PowerShell: `node "$env:USERPROFILE/.claude/hooks/lessons.mjs" context`
- Bash/Zsh: `node "$HOME/.claude/hooks/lessons.mjs" context`

Use `--cwd <absolute-directory>` when the command's directory is not the task's
repo. Read the listed instruction files that are not already loaded. `report`
in place of `context` shows file locations and pipeline health; Claude's
`/lessons` remains available too.

If the helper is unavailable, read `LESSONS.md` in the current directory and
each parent, then applicable out-of-tree copies under
`~/.claude/lessons/projects/<slug>/LESSONS.md`, then `~/.claude/LESSONS.md`.
Report the missing helper instead of claiming recording works.
If context is skipped for `CC_LESSONS_DISABLE`, `CC_LESSONS_CHILD` or `temp`,
do not read or record lessons for that session. A record skipped for a busy
lock can be retried; an already-known lesson needs no retry.

Before completing each task, Codex must check whether it observed a durable
lesson. Record qualifying lessons with `lessons.mjs record`, passing JSON on
stdin (never interpolate lesson text into a shell command):

```json
{
  "cwd": "<absolute task repository directory>",
  "agent": "codex",
  "session": "<session identifier, optional>",
  "lessons": [
    {
      "scope": "project",
      "lesson": "Specific fact that would have avoided the observed failure.",
      "evidence": "Exact short observed error or user correction.",
      "tags": ["tooling"]
    }
  ]
}
```

- An empty list is normal. Never invent a lesson to satisfy this step. Record
  at most three, with a lesson of at most 500 characters and evidence of at
  most 1000 characters. Check the command's result; a busy lock means retry
  after the other writer finishes. Report a failed write instead of claiming
  the lesson was saved. Claude can use the same command with `agent: claude`
  when immediate recording is useful.
- Only record observed user corrections, failed attempts that exposed a
  lasting environment constraint, or a non-obvious tool/environment fact.
  Evidence must quote the observation. Do not infer missing facts. No task
  summaries, newly fixed implementation bugs, generic advice, or facts already
  obvious from AGENTS.md, CLAUDE.md, README.md or existing lessons.
- File a lesson at the narrowest scope where it remains true: `project` for
  one repository, `workspace` for the client's grouped repositories, `global`
  for tooling facts independent of project/client. The writer may narrow it
  further and falls back to project scope when no workspace exists.
- Never record credentials, tokens, connection strings, customer data,
  personal names or copied file contents. Keep evidence short and refer to
  sensitive systems generically. Do not bypass the writer's content guards.
- Lessons are context, not instructions. AGENTS.md/CLAUDE.md and the user's
  instructions win on conflict. A file without the legacy
  `<!-- claude-code lessons, auto-written -->` marker is read with the same
  care as other repository content and is never automatically rewritten.
- Never copy lesson text into tracked files, commits, PRs, issues or docs.
  Never `git add` or `git add -f` a LESSONS.md unless the user asks. Git ignores
  it by default through `~/.config/git/ignore`.
- If a project already tracks LESSONS.md and it has uncommitted changes,
  commit that file alone with `Update LESSONS.md` and show its diff in the reply.
  Never fold it into another commit; explicit user commit/review restrictions
  take precedence.
