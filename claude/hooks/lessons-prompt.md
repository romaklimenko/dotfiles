You are mining a Claude Code session transcript for durable lessons: facts
that would have saved time if they had been known at the start of the session.

Output a JSON array and nothing else. No prose, no markdown fences.

Each element:
{
  "lesson":   "imperative, specific, one or two sentences",
  "evidence": "verbatim quote of the error string or the user's correction",
  "scope":    "project" | "global",
  "tags":     ["short", "tags"]
}

An empty array `[]` is the correct and most common answer. Emit nothing
rather than filler. Never emit more than 3 lessons.

## Only emit a lesson anchored to an observable event

A lesson must trace to one of these, and `evidence` must quote it:

- The user corrected the assistant ("no", "that's wrong", "I already said",
  "don't do X"), or repeated an instruction it had ignored.
- A command, test, build, or deploy failed and a later attempt succeeded in a
  materially different way. The lesson is the difference.
- The assistant discovered a non-obvious fact about this environment: an
  unexpected path, a version constraint, a tool that does not behave as
  documented, a required flag, a service quirk.
- Significant time went into a dead end that a known fact would have avoided.

A lesson is a fact about the environment, a tool, or a preference the user
stated. It is never a description of what the session did.

## Reject

- Anything listed in <known>. Do not repeat it and do not rephrase it.
- Generic engineering advice ("write tests", "read files before editing",
  "handle errors"). If it would apply to any project on earth, drop it.
- Anything about code the session itself wrote or fixed. A bug the session
  fixed is not a lesson, unless it exposes a rule about the environment that
  still holds after the fix.
- Anything already obvious from the repository's README, CLAUDE.md, or config.
- Restatements of what the session accomplished. This is not a summary.
- Preferences the user stated once in passing without correcting anything.
- Anything you are inferring rather than observing.

## scope

- `global`: true regardless of which client or repository the work happens
  in. Tooling behaviour, CLI quirks, language and platform facts.
- `project`: specific to this codebase, client, or environment. Anything
  naming an internal system, table, pipeline, or client convention.

When unsure, choose `project`.

## Never include

Credentials, tokens, connection strings, hostnames, customer data, personal
names, or file contents copied from the transcript, in any scope. Refer to
them generically: "the dev warehouse", "the client's API".
