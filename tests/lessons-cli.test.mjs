// Integration tests for the agent-invoked lessons helper. All runtime state,
// repositories, and git configuration stay inside this suite's scratch tree.
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
  readdirSync, statSync, realpathSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HELPER = resolve(HERE, "..", "claude", "hooks", "lessons.mjs");
// Git expands Windows 8.3 temp paths; normalize fixtures to the same spelling.
const scratch = realpathSync.native(mkdtempSync(join(tmpdir(), "lessons-cli-test-")));
const lessonHome = join(scratch, "home");
const fakeTmp = join(scratch, "faketmp");
const gitConfig = join(scratch, "gitconfig");
const xdg = join(scratch, "xdg");
const runtime = join(lessonHome, ".claude");
const recordsFile = join(runtime, "lessons", "log.jsonl");
const globalFile = join(runtime, "LESSONS.md");
const lockFile = join(runtime, "lessons", "extract.lock");
const marker = "<!-- claude-code lessons, auto-written -->";
for (const dir of [lessonHome, fakeTmp, xdg]) mkdirSync(dir, { recursive: true });
writeFileSync(gitConfig, "[user]\n\tname = fixture\n\temail = fixture@example.com\n");

const env = {
  ...process.env,
  CC_LESSONS_HOME: lessonHome,
  CC_LESSONS_TMPDIR: fakeTmp,
  CC_LESSONS_NO_SPAWN: "1",
  CC_LESSONS_CLAUDE_BIN: join(scratch, "no-model-cli-is-installed"),
  GIT_CONFIG_GLOBAL: gitConfig,
  GIT_CONFIG_NOSYSTEM: "1",
  XDG_CONFIG_HOME: xdg,
  HOME: lessonHome,
};
for (const name of ["CC_LESSONS_CHILD", "CC_LESSONS_DISABLE", "CLAUDECODE", "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"])
  delete env[name];

after(() => rmSync(scratch, { recursive: true, force: true }));
beforeEach(() => rmSync(runtime, { recursive: true, force: true }));

let sequence = 0;
function freshDir(name, parent = scratch) {
  const dir = join(parent, `${name}-${++sequence}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}
function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  }).trim();
}
function repo(parent = scratch, name = "project") {
  const cwd = freshDir(name, parent);
  git(cwd, "init", "-q");
  writeFileSync(join(cwd, "README.md"), "# fixture\n");
  git(cwd, "add", "README.md");
  git(cwd, "commit", "-q", "-m", "init");
  return cwd;
}
function workspace() {
  const cwd = freshDir("workspace");
  writeFileSync(join(cwd, "AGENTS.md"), "# Workspace fixture\nRead project guidance too.\n");
  return cwd;
}
function lesson(text = "The fixture runner needs the explicit --serial flag.", scope = "project", evidence = "Runner failed: use --serial on this platform.") {
  return { lesson: text, evidence, scope };
}
function run(args, payload, extraEnv = {}) {
  return spawnSync(process.execPath, [HELPER, ...args], {
    cwd: scratch,
    input: typeof payload === "string" ? payload : payload === undefined ? "" : JSON.stringify(payload),
    encoding: "utf8", env: { ...env, ...extraEnv }, timeout: 15_000, windowsHide: true,
  });
}
function record(cwd, lessons, extra = {}, extraEnv = {}) {
  return run(["record"], { cwd, agent: "codex", lessons, ...extra }, extraEnv);
}
function success(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
function records() {
  return existsSync(recordsFile)
    ? readFileSync(recordsFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
    : [];
}
function managedFile(path, texts) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${marker}\n# Lessons\n\n${texts.map(text => `- [2026-09-01] ${text}`).join("\n")}\n`);
}
function snapshot(dir) {
  if (!existsSync(dir)) return null;
  const out = {};
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[relative(dir, full)] = { content: readFileSync(full).toString("base64"), mtime: statSync(full).mtimeMs };
    }
  }
  walk(dir);
  return out;
}

test("record writes ignored project lessons and evidence without a model CLI", () => {
  const cwd = repo();
  const item = { ...lesson(), tags: ["runner", "windows"] };
  const result = success(record(cwd, [item], { session: "fixture-session" }));
  const file = join(cwd, "LESSONS.md");
  assert.equal(result.status, "recorded");
  assert.deepEqual(result.written, [{ path: file, lesson: item.lesson, scope: "project" }]);
  const content = readFileSync(file, "utf8");
  assert.ok(content.startsWith(marker));
  assert.match(content, /- \[\d{4}-\d{2}-\d{2}\] The fixture runner/);
  assert.equal(git(cwd, "check-ignore", "LESSONS.md"), "LESSONS.md");
  assert.equal(git(cwd, "status", "--porcelain"), "");
  assert.equal(existsSync(lockFile), false);
  const evidence = records();
  assert.equal(evidence.length, 1);
  for (const key of ["lesson", "evidence", "scope", "tags"]) assert.deepEqual(evidence[0][key], item[key]);
  assert.equal(evidence[0].agent, "codex");
  assert.equal(evidence[0].session, "fixture-session");
});

test("record preserves tracked lesson status without staging or committing", () => {
  const cwd = repo();
  managedFile(join(cwd, "LESSONS.md"), ["Existing tracked fixture note."]);
  git(cwd, "add", "LESSONS.md");
  git(cwd, "commit", "-q", "-m", "track fixture notes");
  const before = git(cwd, "rev-parse", "HEAD");
  assert.equal(success(record(cwd, [lesson()])).status, "recorded");
  assert.equal(git(cwd, "rev-parse", "HEAD"), before);
  assert.equal(git(cwd, "diff", "--cached", "--name-only"), "");
  assert.equal(git(cwd, "diff", "--name-only"), "LESSONS.md");
});

test("record keeps handwritten notes intact and uses the out-of-tree store", () => {
  const cwd = repo();
  const file = join(cwd, "LESSONS.md");
  const original = "# Handwritten notes\nKeep this exact text.\n";
  writeFileSync(file, original);
  const result = success(record(cwd, [lesson()]));
  assert.equal(result.status, "recorded");
  assert.equal(readFileSync(file, "utf8"), original);
  assert.ok(result.written[0].path.startsWith(join(runtime, "lessons", "projects")));
  assert.ok(readFileSync(result.written[0].path, "utf8").startsWith(marker));
});

test("record outside a repository keeps project notes out of tree", () => {
  const cwd = freshDir("plain-directory");
  const result = success(record(cwd, [lesson()]));
  assert.equal(result.status, "recorded");
  assert.equal(existsSync(join(cwd, "LESSONS.md")), false);
  assert.ok(result.written[0].path.startsWith(join(runtime, "lessons", "projects")));
});

test("record deduplicates case, whitespace, repeated inputs, and repeat invocations", () => {
  const cwd = repo();
  const first = lesson();
  const duplicate = lesson(`  ${first.lesson.toUpperCase().replaceAll(" ", "  ")}  `);
  const initial = success(record(cwd, [first, duplicate]));
  assert.equal(initial.written.length, 1);
  const repeated = success(record(cwd, [duplicate]));
  assert.equal(repeated.status, "skipped");
  assert.deepEqual(repeated.written, []);
  assert.equal(records().length, 1);
});

test("record skips lessons already known at workspace and global scope", () => {
  const ws = workspace();
  const cwd = repo(ws);
  const wsNote = lesson("The fixture scheduler needs an explicit queue selection.");
  const globalNote = lesson("The fixture shell requires UTF-8 output.");
  managedFile(join(ws, "LESSONS.md"), [wsNote.lesson]);
  managedFile(globalFile, [globalNote.lesson]);
  const result = success(record(cwd, [wsNote, globalNote]));
  assert.equal(result.status, "skipped");
  assert.deepEqual(result.written, []);
  assert.equal(existsSync(join(cwd, "LESSONS.md")), false);
  assert.deepEqual(records(), []);
});

test("record demotes project, workspace, and private terms to their narrowest scope", () => {
  const ws = workspace();
  const cwd = repo(ws);
  mkdirSync(dirname(recordsFile), { recursive: true });
  writeFileSync(join(dirname(recordsFile), "private-terms.txt"), "fixture-private-identifier\n");
  const items = [
    lesson(`The ${basename(cwd)} runner requires --serial.`, "global"),
    lesson(`The ${basename(ws)} scheduler requires a queue selection.`, "global"),
    lesson("The fixture-private-identifier service requires local execution.", "workspace"),
  ];
  const result = success(record(cwd, items));
  assert.equal(result.status, "recorded");
  const byLesson = new Map(result.written.map(item => [item.lesson, item]));
  assert.equal(byLesson.get(items[0].lesson).scope, "project");
  assert.equal(byLesson.get(items[0].lesson).path, join(cwd, "LESSONS.md"));
  assert.equal(byLesson.get(items[1].lesson).scope, "workspace");
  assert.equal(byLesson.get(items[1].lesson).path, join(ws, "LESSONS.md"));
  assert.equal(byLesson.get(items[2].lesson).scope, "project");
  assert.equal(existsSync(globalFile), false);
});

test("record falls back to project scope when no workspace exists", () => {
  const cwd = repo();
  const result = success(record(cwd, [lesson(undefined, "workspace")]));
  assert.equal(result.written[0].scope, "project");
  assert.equal(result.written[0].path, join(cwd, "LESSONS.md"));
});

test("record accepts Claude as an explicit author and preserves global scope", () => {
  const cwd = repo();
  const result = success(record(cwd, [lesson(undefined, "global")], { agent: "claude" }));
  assert.equal(result.written[0].path, globalFile);
  assert.equal(result.written[0].scope, "global");
  assert.equal(records()[0].agent, "claude");
});

test("empty retrospective is skipped without creating runtime state", () => {
  const cwd = repo();
  const result = success(record(cwd, []));
  assert.equal(result.status, "skipped");
  assert.deepEqual(result.written, []);
  assert.equal(existsSync(runtime), false);
});

test("record rejects invalid envelopes and evidence before writing", () => {
  const cwd = repo();
  const valid = { cwd, agent: "codex", lessons: [lesson()] };
  const cases = [
    "{ broken JSON", null, [],
    { ...valid, cwd: "relative-path" },
    { ...valid, agent: "unknown" },
    { ...valid, lessons: [lesson(undefined, "team")] },
    { ...valid, lessons: [lesson(undefined, "project", " ")] },
    { ...valid, lessons: [{ scope: "project", lesson: "Needs evidence." }] },
    { ...valid, lessons: [lesson("")] },
    { ...valid, lessons: [lesson(), lesson(), lesson(), lesson()] },
  ];
  const before = snapshot(cwd);
  for (const payload of cases) {
    const result = run(["record"], payload);
    assert.notEqual(result.status, 0, `Accepted invalid payload: ${JSON.stringify(payload)}`);
    assert.equal(existsSync(runtime), false);
    assert.deepEqual(snapshot(cwd), before);
  }
});

test("record rejects secret-bearing lesson or evidence without exposing it", () => {
  const cwd = repo();
  const secretFixture = "token=fixture-sensitive-value";
  const before = snapshot(cwd);
  for (const item of [lesson(secretFixture), lesson(undefined, "project", secretFixture)]) {
    const result = record(cwd, [item]);
    if (result.status === 0) {
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, "skipped");
      assert.deepEqual(output.written, []);
    }
    assert.ok(!`${result.stdout}${result.stderr}`.includes(secretFixture));
    assert.equal(existsSync(runtime), false);
    assert.deepEqual(snapshot(cwd), before);
  }
});

test("record rejects secrets in metadata as well as lesson text", () => {
  const cwd = repo();
  const secretFixture = "token=fixture-sensitive-metadata";
  for (const [item, extra] of [
    [{ ...lesson(), tags: [secretFixture] }, {}],
    [lesson(), { session: secretFixture }],
  ]) {
    const result = record(cwd, [item], extra);
    if (result.status === 0) {
      assert.equal(JSON.parse(result.stdout).status, "skipped");
      assert.deepEqual(JSON.parse(result.stdout).written, []);
    }
    assert.ok(!`${result.stdout}${result.stderr}`.includes(secretFixture));
    assert.equal(existsSync(runtime), false);
    assert.equal(existsSync(join(cwd, "LESSONS.md")), false);
  }
});

test("disabled and temporary sessions leave no lessons or runtime state", () => {
  const cwd = repo();
  const before = snapshot(cwd);
  const disabled = success(record(cwd, [lesson()], {}, { CC_LESSONS_DISABLE: "1" }));
  assert.equal(disabled.status, "skipped");
  assert.deepEqual(snapshot(cwd), before);
  assert.equal(existsSync(runtime), false);

  const tempCwd = freshDir("session", fakeTmp);
  const temporary = success(record(tempCwd, [lesson()]));
  assert.equal(temporary.status, "skipped");
  assert.equal(existsSync(join(tempCwd, "LESSONS.md")), false);
  assert.equal(existsSync(runtime), false);
});

test("an active worker lock skips recording without changing state or git excludes", () => {
  const cwd = repo();
  mkdirSync(dirname(lockFile), { recursive: true });
  writeFileSync(lockFile, String(process.pid));
  const runtimeBefore = snapshot(runtime);
  const repoBefore = snapshot(cwd);
  const result = success(record(cwd, [lesson()]));
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /lock|worker|busy/i);
  assert.deepEqual(snapshot(runtime), runtimeBefore);
  assert.deepEqual(snapshot(cwd), repoBefore);
});

test("an unwritable evidence destination fails and releases the writer lock", () => {
  const cwd = repo();
  // A directory cannot be opened as an append-only JSONL file on Windows or Linux.
  mkdirSync(recordsFile, { recursive: true });
  const result = record(cwd, [lesson()]);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(lockFile), false);
  assert.equal(existsSync(join(cwd, "LESSONS.md")), false, "A failed evidence write must not leave an unlogged lesson");
  assert.ok(!result.stdout.includes('"status":"recorded"'));
});

test("a malformed writer lock is a failure rather than ordinary contention", () => {
  const cwd = repo();
  mkdirSync(lockFile, { recursive: true });
  const result = record(cwd, [lesson()]);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(join(cwd, "LESSONS.md")), false);
  assert.equal(existsSync(recordsFile), false);
  assert.ok(statSync(lockFile).isDirectory(), "An invalid lock path must not be removed");
  assert.ok(!result.stdout.includes('"status":"skipped"'));
});

test("context finds an AGENTS-only workspace above independent nested repositories", () => {
  const ws = workspace();
  git(ws, "init", "-q");
  const cwd = repo(ws);
  const sibling = repo(ws, "sibling");
  managedFile(join(ws, "LESSONS.md"), ["Workspace scheduling fixture note."]);
  managedFile(join(cwd, "LESSONS.md"), ["Project runner fixture note."]);
  managedFile(join(sibling, "LESSONS.md"), ["Sibling note must remain out of context."]);
  managedFile(globalFile, ["Global shell fixture note."]);
  const nested = freshDir("source", cwd);
  const result = run(["context", "--cwd", nested]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<lessons\b/);
  const instructions = JSON.parse(result.stdout.split(/\r?\n/).find(line => line.startsWith("[")));
  assert.ok(instructions.includes(join(ws, "AGENTS.md")));
  for (const text of ["Workspace scheduling fixture note.", "Project runner fixture note.", "Global shell fixture note."])
    assert.ok(result.stdout.includes(text), `Missing context: ${text}`);
  assert.ok(!result.stdout.includes("Sibling note must remain out of context."));
});

test("context includes out-of-tree lessons and lists unmarked files without injecting them", () => {
  const cwd = repo();
  const handwritten = "Handwritten content is not injected automatically.";
  writeFileSync(join(cwd, "LESSONS.md"), `# Manual\n${handwritten}\n`);
  const written = success(record(cwd, [lesson()]));
  managedFile(globalFile, ["Global context fixture."]);
  const before = snapshot(runtime);
  const result = run(["context", "--cwd", cwd]);
  assert.equal(result.status, 0, result.stderr);
  for (const text of [written.written[0].path, lesson().lesson, "Global context fixture.", join(cwd, "LESSONS.md")])
    assert.ok(result.stdout.includes(text), `Missing context: ${text}`);
  assert.ok(!result.stdout.includes(handwritten));
  assert.deepEqual(snapshot(runtime), before);
});

test("context honors disabled and temporary sessions without injecting lessons", () => {
  const cwd = repo();
  managedFile(globalFile, ["Private fixture note should be absent."]);
  const before = snapshot(runtime);
  const tempCwd = freshDir("context", fakeTmp);
  for (const result of [
    run(["context", "--cwd", cwd], undefined, { CC_LESSONS_DISABLE: "1" }),
    run(["context", "--cwd", tempCwd]),
  ]) {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "skipped");
    assert.ok(!result.stdout.includes("Private fixture note should be absent."));
    assert.deepEqual(snapshot(runtime), before);
  }
});
