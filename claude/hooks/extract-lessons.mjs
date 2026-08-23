#!/usr/bin/env node
// Detached worker. Drains ~/.claude/lessons/queue, builds a compact digest of
// the new part of each transcript, and asks a cheap model to mine lessons.
// Nothing here runs in the critical path of a session.

import {
  mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync,
  readdirSync, rmSync, statSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(homedir(), ".claude", "lessons");
const QUEUE = join(ROOT, "queue");
const STATE = join(ROOT, "state");
const LOCK = join(ROOT, "extract.lock");
const PENDING = join(ROOT, "pending.jsonl");
const LOG = join(ROOT, "extract.log");
const HERE = dirname(fileURLToPath(import.meta.url));

const MODEL = process.env.CC_LESSONS_MODEL || "haiku";
const MIN_TURNS = Number(process.env.CC_LESSONS_MIN_TURNS || 6);
const MAX_CHARS = Number(process.env.CC_LESSONS_MAX_CHARS || 120_000);
const CLAUDE_BIN = process.env.CC_LESSONS_CLAUDE_BIN || "claude";

const log = (m) => {
  try {
    appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`, "utf8");
  } catch {}
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- lock -------------------------------------------------------------
mkdirSync(ROOT, { recursive: true });
mkdirSync(STATE, { recursive: true });
if (existsSync(LOCK) && Date.now() - statSync(LOCK).mtimeMs < 10 * 60 * 1000) {
  process.exit(0);
}
writeFileSync(LOCK, String(process.pid), "utf8");

// Re-stamp the lock so a run that outlives LOCK_STALE_MS is not mistaken for a
// dead one. This has to be called between jobs: runClaude blocks the event loop
// for up to its full timeout, so a timer-based heartbeat would never fire.
//
// Returns false if the lock now belongs to someone else, which means this worker
// was already presumed dead and taken over. Yield rather than re-claim it: two
// workers on one queue mine the same job twice and race on the state cursor. The
// jobs left behind stay queued for whoever holds the lock.
const holdLock = () => {
  try {
    if (existsSync(LOCK) && readFileSync(LOCK, "utf8").trim() !== String(process.pid)) return false;
    writeFileSync(LOCK, String(process.pid), "utf8");
    return true;
  } catch {
    return false;
  }
};

// Only drop the lock if it is still ours. A worker that took over a stale lock
// has already claimed it, and deleting that one would let a third worker in.
const release = () => {
  try {
    if (existsSync(LOCK) && readFileSync(LOCK, "utf8").trim() === String(process.pid)) {
      rmSync(LOCK, { force: true });
    }
  } catch {}
};
process.on("exit", release);

// The transcript file is written asynchronously and lags the live session.
await sleep(3000);

// --- helpers ----------------------------------------------------------
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((b) => {
      if (b?.type === "text") return b.text ?? "";
      if (b?.type === "tool_use") {
        const inp = JSON.stringify(b.input ?? {});
        return `[tool ${b.name}] ${inp.slice(0, 400)}`;
      }
      if (b?.type === "tool_result") {
        const t = typeof b.content === "string" ? b.content : textOf(b.content);
        // Only failures are interesting; successful output is mostly noise.
        return b.is_error ? `[tool_error] ${t.slice(0, 800)}` : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

// Build a digest of transcript lines [from, end). Returns { digest, turns, next }.
function digest(transcriptPath, from) {
  const lines = readFileSync(transcriptPath, "utf8").split("\n");
  // The last element is never a complete record. A finished JSONL file ends in a
  // newline, which leaves an empty string, and a file caught mid-write ends in a
  // partial line. Stopping before it keeps the cursor from skipping the record
  // that lands there next, and lets a torn record be re-read once it is whole.
  const end = Math.max(0, lines.length - 1);
  const parts = [];
  let turns = 0;
  for (let i = from; i < end; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const role = e?.message?.role ?? e?.type;
    if (role !== "user" && role !== "assistant") continue;
    const t = textOf(e?.message?.content).trim();
    if (!t) continue;
    turns++;
    parts.push(`### ${role}\n${t.slice(0, 4000)}`);
  }
  let d = parts.join("\n\n");
  if (d.length > MAX_CHARS) d = `[...truncated...]\n${d.slice(-MAX_CHARS)}`;
  return { digest: d, turns, next: end };
}

function runClaude(prompt) {
  // CLAUDECODE is inherited from the session that spawned this worker, and the
  // CLI refuses to start when it sees it ("cannot be launched inside another
  // Claude Code session"). CC_LESSONS_CHILD is our own recursion guard and is
  // not a substitute for clearing it.
  const env = { ...process.env, CC_LESSONS_CHILD: "1" };
  delete env.CLAUDECODE;

  // The prompt goes on stdin, never argv: a digest of MAX_CHARS is far past the
  // ~32k Windows command-line limit and spawn fails with ENAMETOOLONG. Keeping
  // it off argv also keeps transcript text out of any error message we log.
  return execFileSync(
    CLAUDE_BIN,
    [
      "-p",
      "--model", MODEL,
      "--settings", '{"disableAllHooks":true}',
    ],
    {
      input: prompt,
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      env,
    },
  );
}

function parseLessons(out) {
  const s = out.indexOf("[");
  const e = out.lastIndexOf("]");
  if (s === -1 || e <= s) return [];
  const arr = JSON.parse(out.slice(s, e + 1));
  return Array.isArray(arr) ? arr : [];
}

// --- drain ------------------------------------------------------------
const instructions = readFileSync(join(HERE, "lessons-prompt.md"), "utf8");

try {
  const jobs = existsSync(QUEUE)
    ? readdirSync(QUEUE).filter((f) => f.endsWith(".json")).sort()
    : [];

  for (const f of jobs) {
    if (!holdLock()) { log("yielding: lock taken over by another worker"); break; }
    const path = join(QUEUE, f);
    let job;
    try { job = JSON.parse(readFileSync(path, "utf8")); } catch { rmSync(path, { force: true }); continue; }

    try {
      if (!existsSync(job.transcript_path)) { rmSync(path, { force: true }); continue; }

      const statePath = join(STATE, `${job.session_id}.json`);
      const prev = existsSync(statePath)
        ? JSON.parse(readFileSync(statePath, "utf8"))
        : { line: 0 };

      const { digest: d, turns, next } = digest(job.transcript_path, prev.line);
      if (turns < MIN_TURNS) {
        writeFileSync(statePath, JSON.stringify({ line: next }), "utf8");
        rmSync(path, { force: true });
        continue;
      }

      const out = runClaude(
        `${instructions}\n\n<project>${job.cwd ?? "unknown"}</project>\n\n<transcript>\n${d}\n</transcript>`,
      );
      const lessons = parseLessons(out);

      for (const l of lessons) {
        if (!l?.lesson || !l?.evidence) continue;
        appendFileSync(
          PENDING,
          JSON.stringify({
            lesson: String(l.lesson).slice(0, 500),
            evidence: String(l.evidence).slice(0, 500),
            scope: l.scope === "global" ? "global" : "project",
            tags: Array.isArray(l.tags) ? l.tags.slice(0, 5) : [],
            project: job.cwd ?? null,
            session: job.session_id,
            event: job.event,
            at: new Date().toISOString(),
          }) + "\n",
          "utf8",
        );
      }

      writeFileSync(statePath, JSON.stringify({ line: next }), "utf8");
      rmSync(path, { force: true });
      log(`${job.session_id} ${job.event} turns=${turns} lessons=${lessons.length}`);
    } catch (err) {
      log(`FAIL ${job.session_id}: ${String(err.message).replace(/\s+/g, " ").slice(0, 500)}`);
      rmSync(path, { force: true }); // never let one bad job wedge the queue
    }
  }
} finally {
  release();
}
