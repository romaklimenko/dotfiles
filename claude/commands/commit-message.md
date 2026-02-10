---
allowed-tools: Bash(git diff:*)
description: Suggest a git commit message
---

Check the files currently staged in this git repository using `git diff --cached`.
Analyze the changes and suggest a clear, concise commit message following conventional commit format.

The commit message should:
- Have a short summary line (50 chars or less)
- Use imperative mood ("Add feature" not "Added feature")
- Explain what and why, not how
