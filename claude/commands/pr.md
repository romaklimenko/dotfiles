# pr

Generate a GitHub pull request title and description in markdown format.

Determine the base branch by running `git rev-parse --verify main` — use `main` if it exists, otherwise `master`.

Then run:
- `git log <base>..HEAD --oneline` to get the commits
- `git diff <base>..HEAD --stat` to get the changed files

Generate a GitHub pull request title and description in markdown. Output the result wrapped in a markdown code block (```markdown ... ```) for easy copying. The format should be:

- A level-1 heading with the PR title
- A description body summarizing what changed and why
- A test plan section with checkboxes

The output should be plain text markdown that is easy to copy and paste directly into GitHub.
