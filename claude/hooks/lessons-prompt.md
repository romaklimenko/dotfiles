You are mining a Claude Code session transcript for durable lessons: things
that would have saved time if they had been known at the start of the session.

Output a JSON array and nothing else. No prose, no markdown fences.

Each element:
{
  "lesson":   "imperative, specific, one or two sentences",
  "evidence": "the concrete thing in the transcript that proves it",
  "scope":    "project" | "global",
  "tags":     ["short", "tags"]
}

An empty array `[]` is the correct and most common answer. Emit nothing rather
than filler.

## Only emit a lesson anchored to an observable event

A lesson must trace to one of these, and `evidence` must name it:

- The user corrected the assistant ("no", "that's wrong", "I already said",
  "don't do X"), or repeated an instruction it had ignored.
- A command, test, build, or deploy failed and a later attempt succeeded in a
  materially different way. The lesson is the difference.
- The assistant discovered a non-obvious fact about this environment: an
  unexpected path, a version constraint, a tool that doesn't behave as
  documented, a required flag, a service quirk.
- Significant time went into a dead end that a known fact would have avoided.

## Reject

- Generic engineering advice ("write tests", "read files before editing",
  "handle errors"). If it would apply to any project on earth, drop it.
- Anything already obvious from the repo's own README, CLAUDE.md, or config.
- Restatements of what the session accomplished. This is not a summary.
- Preferences the user stated once in passing without correcting anything.
- Anything you are inferring rather than observing.

## scope

- `global`: true regardless of which client or repo the work happens in.
  Tooling behaviour, CLI quirks, language and platform facts.
- `project`: specific to this codebase, client, or environment. Anything
  naming an internal system, table, pipeline, or client convention.

When unsure, choose `project`. Never put a client name, internal hostname,
credential, or customer data in a `global` lesson.
