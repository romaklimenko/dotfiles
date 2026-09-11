import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { syncAgentConfig } from "../scripts/sync-agent-config.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/sync-agent-config.mjs", import.meta.url));
const OWNED = 'node "$HOME/.claude/hooks/lessons-context.mjs"';
const CUSTOM = { type: "command", command: "echo local-hook" };
const DEFAULTS = {
  respectGitignore: true,
  permissions: { deny: ["Read(*.env)"], defaultMode: "auto" },
  hooks: { SessionStart: [{ matcher: "startup|resume", hooks: [{ type: "command", command: OWNED, timeout: 10 }] }] },
};

function put(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

function fixture(t) {
  const scratch = mkdtempSync(join(tmpdir(), "agent-sync-test-"));
  t.after(() => {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    assert.match(scratch, /agent-sync-test-[^\\/]+$/);
    rmSync(scratch, { recursive: true, force: true });
  });
  const repo = join(scratch, "repo with spaces");
  const home = join(scratch, "test user");
  const codexHome = join(home, ".codex");
  put(join(repo, "agents", "AGENTS.md"), "# Shared instructions\n");
  put(join(repo, "claude", "CLAUDE.md"), "@AGENTS.md\n");
  put(join(repo, "claude", "settings.json"), DEFAULTS);
  put(join(repo, "claude", "hooks", "lessons-context.mjs"), "// current hook\n");
  put(join(repo, "claude", "commands", "lessons.md"), "Read lessons.\n");
  const options = { repo, home, codexHome };
  return { repo, home, codexHome, options, run: () => syncAgentConfig(options) };
}

test("fresh install copies shared instructions and owned files; second run changes nothing", (t) => {
  const f = fixture(t);
  const first = f.run();
  assert.equal(first.changed.length, 6);
  assert.equal(first.backups.length, 0);
  for (const file of [join(f.home, ".claude", "AGENTS.md"), join(f.codexHome, "AGENTS.md")]) {
    assert.equal(readFileSync(file, "utf8"), "# Shared instructions\n");
  }
  assert.equal(readFileSync(join(f.home, ".claude", "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  assert.equal(readFileSync(join(f.home, ".claude", "hooks", "lessons-context.mjs"), "utf8"), "// current hook\n");
  assert.equal(readFileSync(join(f.home, ".claude", "commands", "lessons.md"), "utf8"), "Read lessons.\n");
  assert.equal(lstatSync(join(f.home, ".claude", "hooks")).isSymbolicLink(), false);
  assert.deepEqual(f.run().changed, []);
  assert.deepEqual(f.run().backups, []);
});

test("local settings and mixed custom hooks survive replacement of the owned hook", (t) => {
  const f = fixture(t);
  const file = join(f.home, ".claude", "settings.json");
  const local = {
    respectGitignore: false,
    permissions: { defaultMode: "plan", deny: ["Read(private/*)"] },
    localOnly: { value: "keep" },
    hooks: {
      SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: OWNED, timeout: 2 }, CUSTOM] }],
      Notification: [{ matcher: "permission_prompt", hooks: [CUSTOM] }],
    },
  };
  put(file, local);
  const before = readFileSync(file);
  const result = f.run();
  const installed = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(installed.respectGitignore, false);
  assert.deepEqual(installed.permissions, local.permissions);
  assert.deepEqual(installed.localOnly, local.localOnly);
  assert.deepEqual(installed.hooks.Notification, local.hooks.Notification);
  assert.deepEqual(installed.hooks.SessionStart[0], { matcher: "startup", hooks: [CUSTOM] });
  assert.deepEqual(installed.hooks.SessionStart[1], DEFAULTS.hooks.SessionStart[0]);
  assert.equal(installed.hooks.SessionStart.flatMap((group) => group.hooks).filter((hook) => hook.command === OWNED).length, 1);
  assert.equal(result.backups.length, 1);
  assert.deepEqual(readFileSync(result.backups[0]), before);
  assert.deepEqual(f.run().changed, []);
});

test("managed changes are backed up; unrelated commands, hooks, lessons and Codex notify stay byte-identical", (t) => {
  const f = fixture(t);
  const oldInstruction = join(f.codexHome, "AGENTS.md");
  put(oldInstruction, "Existing custom instruction.\n");
  const hook = join(f.home, ".claude", "hooks", "lessons-context.mjs");
  put(hook, "// old deployed hook\n");
  const untouched = new Map([
    [join(f.codexHome, "config.toml"), 'notify = ["computer-use", "notify"]\ncustom = true\n'],
    [join(f.home, ".claude", "hooks", "my-hook.mjs"), "// local hook\n"],
    [join(f.home, ".claude", "commands", "my-command.md"), "Local command.\n"],
    [join(f.home, ".claude", "LESSONS.md"), "Remember this.\n"],
  ]);
  for (const [file, content] of untouched) put(file, content);
  const result = f.run();
  assert.equal(result.backups.length, 2);
  assert.deepEqual(result.backups.map((file) => readFileSync(file, "utf8")).sort(), ["// old deployed hook\n", "Existing custom instruction.\n"].sort());
  for (const [file, content] of untouched) assert.equal(readFileSync(file, "utf8"), content);
  put(join(f.repo, "agents", "AGENTS.md"), "# Updated shared instructions\n");
  const updated = f.run();
  assert.equal(updated.changed.length, 2);
  assert.equal(updated.backups.length, 2);
  assert.equal(readFileSync(oldInstruction, "utf8"), "# Updated shared instructions\n");
});

test("same-source directory symlinks remain intact and are never rewritten", (t) => {
  const f = fixture(t);
  mkdirSync(join(f.home, ".claude"), { recursive: true });
  for (const name of ["hooks", "commands"]) {
    symlinkSync(join(f.repo, "claude", name), join(f.home, ".claude", name), process.platform === "win32" ? "junction" : "dir");
  }
  const sourceHook = join(f.repo, "claude", "hooks", "lessons-context.mjs");
  const before = readFileSync(sourceHook);
  f.run();
  assert.ok(lstatSync(join(f.home, ".claude", "hooks")).isSymbolicLink());
  assert.deepEqual(readFileSync(sourceHook), before);
  assert.deepEqual(readdirSync(dirname(sourceHook)), ["lessons-context.mjs"]);
  assert.deepEqual(f.run().changed, []);
});

test("unexpected directory links fail before changing any installed file", (t) => {
  const f = fixture(t);
  const other = join(f.home, "other hooks");
  put(join(other, "lessons-context.mjs"), "// do not change\n");
  mkdirSync(join(f.home, ".claude"), { recursive: true });
  symlinkSync(other, join(f.home, ".claude", "hooks"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(f.run, /Refusing to write through directory link/);
  assert.equal(existsSync(join(f.home, ".claude", "AGENTS.md")), false);
  assert.equal(readFileSync(join(other, "lessons-context.mjs"), "utf8"), "// do not change\n");
});

test("invalid installed settings fail before instruction or hook writes", (t) => {
  const f = fixture(t);
  const file = join(f.home, ".claude", "settings.json");
  put(file, "{ unfinished");
  assert.throws(f.run, SyntaxError);
  assert.equal(readFileSync(file, "utf8"), "{ unfinished");
  assert.equal(existsSync(join(f.home, ".claude", "AGENTS.md")), false);
});

test("CLI honors CODEX_HOME and explicit --codex-home wins", (t) => {
  const f = fixture(t);
  const environmentTarget = join(f.home, "codex environment");
  const explicitTarget = join(f.home, "codex explicit");
  const args = [SCRIPT, "--repo", f.repo, "--home", f.home];
  const options = { env: { ...process.env, CODEX_HOME: environmentTarget }, encoding: "utf8" };
  execFileSync(process.execPath, args, options);
  assert.equal(existsSync(join(environmentTarget, "AGENTS.md")), true);
  assert.equal(existsSync(join(f.codexHome, "AGENTS.md")), false);
  execFileSync(process.execPath, [...args, "--codex-home", explicitTarget], options);
  assert.equal(existsSync(join(explicitTarget, "AGENTS.md")), true);
});
