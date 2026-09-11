#!/usr/bin/env node
// Portable, agent-invoked lessons reader/writer. No model or transcript parser.
// Record input is JSON on stdin so evidence never needs shell interpolation.
import { mkdirSync, appendFileSync, existsSync, lstatSync, statSync } from "node:fs";
import { resolve, join, isAbsolute } from "node:path";
import * as L from "./lessons-lib.mjs";
import { contextBlock, report } from "./lessons-context.mjs";
import { acquireLock, holdLock, release } from "./lessons-lock.mjs";
import { SECRET_RE, narrowScope } from "./lessons-policy.mjs";

function skipped(reason) {
  return { status: "skipped", written: [], reason };
}

function disabledReason(cwd) {
  if (process.env.CC_LESSONS_DISABLE) return "CC_LESSONS_DISABLE";
  if (process.env.CC_LESSONS_CHILD) return "CC_LESSONS_CHILD";
  if (L.isTempPath(cwd)) return "temp";
  return null;
}

function checkedCwd(cwd) {
  if (typeof cwd !== "string" || !isAbsolute(cwd)) throw new Error("cwd must be an absolute directory path");
  if (!statSync(cwd).isDirectory()) throw new Error("cwd must be a directory");
  return resolve(cwd);
}

// Codex project discovery can stop at a nested clone's Git root. List the
// outer workspace explicitly; the agent reads guidance it has not yet loaded.
function guidancePaths(cwd) {
  const project = L.gitToplevel(cwd) ?? cwd;
  const workspace = L.workspaceRoot(project);
  return [...new Set([workspace, project].filter(Boolean))].flatMap((dir) => {
    for (const name of ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md"]) {
      const path = join(dir, name);
      if (existsSync(path) && L.readText(path).trim()) return [path];
    }
    return [];
  });
}

function knownLessons(cwd) {
  return new Set(L.lessonsChain(cwd)
    .filter((entry) => entry.managed && !entry.symlink)
    .flatMap((entry) => L.bulletsOf(L.readText(entry.path)))
    .map((lesson) => lesson.toLowerCase()));
}

function validateInput(input) {
  if (!input || !["codex", "claude"].includes(input.agent)) {
    throw new Error("agent must be codex or claude");
  }
  const cwd = checkedCwd(input.cwd);
  if (!Array.isArray(input.lessons) || input.lessons.length > 3) {
    throw new Error("lessons must be an array with at most three entries");
  }
  for (const item of input.lessons) {
    if (!item || !L.KINDS.includes(item.scope)
      || typeof item.lesson !== "string" || !L.normalizeLessonText(item.lesson)
      || typeof item.evidence !== "string" || !item.evidence.trim()) {
      throw new Error("Each lesson needs a valid scope, lesson and nonempty observable evidence");
    }
    if (item.lesson.length > 500 || item.evidence.length > 1000) {
      throw new Error("Lesson/evidence exceeds the 500/1000 character limit");
    }
    if (item.tags !== undefined && (!Array.isArray(item.tags)
      || item.tags.some((tag) => typeof tag !== "string" || tag.length > 80))) {
      throw new Error("tags must be short strings");
    }
  }
  if (input.session !== undefined && (typeof input.session !== "string" || input.session.length > 200)) {
    throw new Error("session must be a short string");
  }
  return cwd;
}

function record(input) {
  // Disabled sessions must not produce lesson/state files or git exclusions.
  if (process.env.CC_LESSONS_DISABLE) return skipped("CC_LESSONS_DISABLE");
  if (process.env.CC_LESSONS_CHILD) return skipped("CC_LESSONS_CHILD");
  const cwd = validateInput(input);
  const reason = disabledReason(cwd);
  if (reason) return skipped(reason);
  if (!input.lessons.length) return skipped("no lessons");

  const candidates = input.lessons.filter((item) => !SECRET_RE.test(
    [item.lesson, item.evidence, ...(item.tags ?? []), input.session ?? ""].join("\n"),
  ));
  if (!candidates.length) return skipped("credential-like content rejected");

  mkdirSync(L.ROOT, { recursive: true });
  if (!acquireLock({ strict: true })) return skipped("lock held by another lessons writer; retry after it finishes");
  try {
    const known = knownLessons(cwd);
    const root = L.gitToplevel(cwd) ?? cwd;
    const workspace = L.workspaceRoot(root);
    const written = [];
    for (const item of candidates) {
      const lesson = L.normalizeLessonText(item.lesson);
      if (known.has(lesson.toLowerCase())) continue;
      const { scope, demoted } = narrowScope(item.scope, lesson, root, workspace);
      if (!holdLock()) throw new Error("Lost lessons writer lock; retry recording");
      const target = scope === "global" ? { path: L.GLOBAL_FILE }
        : scope === "workspace" ? L.resolveWorkspaceTarget(workspace)
          : L.resolveProjectTarget(cwd);
      if (existsSync(target.path) && lstatSync(target.path).isSymbolicLink()) {
        throw new Error("Refusing to write a symlinked lesson file");
      }
      // Save the evidence before the bullet. A failed log write must not leave
      // an evidence-free lesson that deduplication would suppress on retry.
      // If the subsequent lesson write fails, the log retains the attempted
      // observation; a retry can safely repeat that evidence.
      appendFileSync(L.RECORDS, JSON.stringify({
        lesson, evidence: item.evidence.trim(), scope, demoted,
        tags: (item.tags ?? []).slice(0, 5), agent: input.agent,
        project: root, workspace, session: input.session ?? null,
        event: "AgentRecord", at: new Date().toISOString(),
      }) + "\n", "utf8");
      const added = L.appendLessons(target.path, scope, [lesson], new Date().toISOString().slice(0, 10));
      if (!added.length) continue;
      known.add(lesson.toLowerCase());
      written.push({ path: target.path, lesson, scope });
    }
    return written.length ? { status: "recorded", written } : skipped("already known");
  } finally {
    release();
  }
}

try {
  const command = process.argv[2];
  if (command === "record") {
    if (process.argv.length !== 3) throw new Error("Record accepts JSON on stdin, not command-line values");
    process.stdout.write(JSON.stringify(record(JSON.parse(await L.readStdin()))) + "\n");
  } else if (command === "context" || command === "report") {
    const args = process.argv.slice(3);
    if (args.length && (args.length !== 2 || args[0] !== "--cwd")) {
      throw new Error("Usage: lessons.mjs context|report [--cwd <directory>]");
    }
    const cwd = checkedCwd(args[1] ?? process.cwd());
    const reason = disabledReason(cwd);
    if (reason) {
      process.stdout.write(JSON.stringify(skipped(reason)) + "\n");
    } else {
      process.stdout.write("Applicable instruction files (outer workspace first; read any not already loaded):\n");
      process.stdout.write(JSON.stringify(guidancePaths(cwd)) + "\n");
      process.stdout.write((command === "context" ? contextBlock(cwd) : report(cwd)) + "\n");
    }
  } else {
    throw new Error("Usage: lessons.mjs context|report [--cwd <directory>] | record < input.json");
  }
} catch (err) {
  // Do not echo input: evidence may have contained credentials or malformed JSON.
  const error = err instanceof SyntaxError ? "Invalid JSON input" : err.message;
  process.stderr.write(JSON.stringify({ status: "error", error }) + "\n");
  process.exitCode = 1;
}
