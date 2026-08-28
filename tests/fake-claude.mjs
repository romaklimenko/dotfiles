// Stands in for the `claude` CLI in tests. Records every call, then answers
// the way `claude -p --output-format json` would.
//
// FAKE_CLAUDE_CAPTURE   directory that receives call-<n>.json ({ argv, prompt })
// FAKE_CLAUDE_RESULT    text to return in `result` (default: three lessons)
// FAKE_CLAUDE_EXIT      exit with this code after printing FAKE_CLAUDE_STDERR
// FAKE_CLAUDE_IS_ERROR  answer with is_error: true

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const prompt = readFileSync(0, "utf8");

const capture = process.env.FAKE_CLAUDE_CAPTURE;
if (capture) {
  mkdirSync(capture, { recursive: true });
  const n = readdirSync(capture).length + 1;
  writeFileSync(join(capture, `call-${n}.json`), JSON.stringify({ argv: process.argv.slice(2), prompt }), "utf8");
}

if (process.env.FAKE_CLAUDE_EXIT) {
  process.stderr.write(process.env.FAKE_CLAUDE_STDERR || "Error: rate limited [429]\n");
  process.exit(Number(process.env.FAKE_CLAUDE_EXIT));
}

const defaultLessons = [
  { lesson: "Pass --long-paths to the build on Windows or it fails with ENAMETOOLONG", evidence: "spawnSync ENAMETOOLONG", scope: "global", tags: ["windows"] },
  { lesson: "The dev warehouse at adb-123.azuredatabricks.net needs classic compute", evidence: "foreign catalog error", scope: "global", tags: ["databricks"] },
  { lesson: "Migrations in this repository never trigger jobs", evidence: "user: don't trigger jobs from migrations", scope: "project", tags: ["migrations"] },
  { lesson: "A fourth lesson is over the limit and must be dropped", evidence: "n/a", scope: "project", tags: [] },
];

const result = process.env.FAKE_CLAUDE_RESULT ?? JSON.stringify(defaultLessons);
const isError = Boolean(process.env.FAKE_CLAUDE_IS_ERROR);

process.stdout.write(JSON.stringify({
  type: "result",
  subtype: isError ? "error_during_execution" : "success",
  is_error: isError,
  result,
  session_id: "fake",
}));
