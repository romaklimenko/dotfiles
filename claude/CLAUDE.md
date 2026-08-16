# Global Claude Code Instructions

These instructions apply to all projects unless overridden by a project-level CLAUDE.md.

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
