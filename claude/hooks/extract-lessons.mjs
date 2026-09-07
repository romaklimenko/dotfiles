#!/usr/bin/env node
// Detached worker. Drains ~/.claude/lessons/queue: for each job it reads the
// part of the transcript it has not seen, asks a cheap model for lessons, and
// appends them to LESSONS.md files. Then it sweeps ~/.claude/projects for
// transcripts no hook reached, and compacts any file it made too big.
// Nothing here runs inside a session.
//
// `--compact <path>` compacts one file now, whatever its size, and prints
// what happened. /lessons compact uses it.

import {
  mkdirSync, existsSync, readFileSync, appendFileSync, readdirSync, rmSync,
  renameSync, statSync, openSync, writeSync, closeSync, writeFileSync,
  createReadStream, utimesSync,
} from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./lessons-lib.mjs";

const MODEL = process.env.CC_LESSONS_MODEL || "haiku";
// Merging notes without losing facts is harder than mining them, and runs
// far less often, so it gets a stronger model.
const COMPACT_MODEL = process.env.CC_LESSONS_COMPACT_MODEL || "sonnet";
// Stop fires mid-session; anything shorter than this waits for more turns.
const MIN_TURNS = Number(process.env.CC_LESSONS_MIN_TURNS || 6);
// SessionEnd, PreCompact and the sweep are the last chance for a segment.
const MIN_TURNS_FINAL = Number(process.env.CC_LESSONS_MIN_TURNS_FINAL || 3);
const MAX_CHARS = Number(process.env.CC_LESSONS_MAX_CHARS || 120_000);
const MAX_CHUNKS = Number(process.env.CC_LESSONS_MAX_CHUNKS || 4);
const MAX_LESSONS_PER_CHUNK = 3;
const MAX_RETRIES = Number(process.env.CC_LESSONS_MAX_RETRIES || 5);
// Attempt n waits n times this long. Rate-limit windows last hours.
const RETRY_BACKOFF_MS = Number(process.env.CC_LESSONS_RETRY_BACKOFF_MS ?? 60 * 60 * 1000);
const KNOWN_MAX_CHARS = 64 * 1024;
// A file this big gets compacted after the run. Below the 12288 characters
// the session-start hook injects whole, so a compacted file is never clipped.
const COMPACT_AT = Number(process.env.CC_LESSONS_COMPACT_AT_CHARS || 10 * 1024);
// One compaction per file per day at most, whatever the outcome.
const COMPACT_INTERVAL_MS = Number(process.env.CC_LESSONS_COMPACT_HOURS ?? 24) * 60 * 60 * 1000;
// After a refused rewrite, wait this much longer: nothing about the file has
// changed, so a retry tomorrow would fail the same way.
const REJECT_INTERVAL_MS = Number(process.env.CC_LESSONS_COMPACT_REJECT_HOURS ?? 24 * 7) * 60 * 60 * 1000;
// A rewrite that keeps fewer than this share of the bullets is refused: the
// model dropped facts instead of merging them.
const COMPACT_MIN_KEEP = 0.4;
// A rewrite earns its keep by merging this share of the bullets away, or by
// shrinking the file by COMPACT_MIN_GAIN. One or the other is enough: a
// faithful merge keeps every detail, so it drops bullets long before it
// drops characters.
const COMPACT_MIN_DROP = 0.05;
const COMPACT_MIN_GAIN = 0.1;
// A rewrite must carry over at least this share of the distinctive details
// (flags, identifiers, error constants, versions) it was given.
const COMPACT_MIN_FACTS = 0.9;
const CLAUDE_BIN = process.env.CC_LESSONS_CLAUDE_BIN || "claude";
const CLAUDE_TIMEOUT_MS = Number(process.env.CC_LESSONS_TIMEOUT_MS || 180_000);
const STARTUP_DELAY_MS = Number(process.env.CC_LESSONS_STARTUP_DELAY_MS ?? 3000);
const SWEEP_MIN_IDLE_MS = Number(process.env.CC_LESSONS_SWEEP_IDLE_MINUTES || 30) * 60 * 1000;
const SWEEP_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const SWEEP_MAX_JOBS = 3;
const PROJECTS_DIR = join(L.CLAUDE_DIR, "projects");
const HERE = dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (err) => String(err?.message ?? err).replace(/\s+/g, " ").slice(0, 300);
const today = () => new Date().toISOString().slice(0, 10);

class LockLost extends Error {}

// --- lock ---------------------------------------------------------------

for (const d of [L.ROOT, L.QUEUE, L.STATE, L.FAILED, L.THROTTLE]) mkdirSync(d, { recursive: true });

// `wx` makes creation atomic. A stale lock is removed once and creation is
// retried; the pid check in holdLock() settles any remaining race.
function acquireLock() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(L.LOCK, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return true;
    } catch (err) {
      if (err.code !== "EEXIST") return false;
      try {
        if (Date.now() - statSync(L.LOCK).mtimeMs < L.LOCK_STALE_MS) return false;
        rmSync(L.LOCK, { force: true });
      } catch {
        return false;
      }
    }
  }
  return false;
}

function ownsLock() {
  try {
    return readFileSync(L.LOCK, "utf8").trim() === String(process.pid);
  } catch {
    return false;
  }
}

// Re-stamp the lock so a long run is not mistaken for a dead one. Returns
// false if another worker took the lock over; yield rather than fight.
function holdLock() {
  if (!ownsLock()) return false;
  try {
    writeFileSync(L.LOCK, String(process.pid), "utf8");
    return true;
  } catch {
    return false;
  }
}

function release() {
  try {
    if (ownsLock()) rmSync(L.LOCK, { force: true });
  } catch {}
}

const compactArg = process.argv.indexOf("--compact");
const compactOnly = compactArg !== -1 ? resolve(process.argv[compactArg + 1] ?? "") : null;

if (!acquireLock()) {
  if (compactOnly) process.stdout.write("skipped: another worker holds the lock, try again in a minute\n");
  process.exit(0);
}
process.on("exit", release);
L.trimLog();

// --- transcript reading -------------------------------------------------

// Stream complete lines from byte `startOffset`. `onLine(text)` may return
// false to stop early. A trailing line without "\n" is never consumed: it is
// either mid-write or the file's unterminated last record, and stays for the
// next run. Returns the byte offset after the last consumed line.
async function readLines(path, startOffset, onLine) {
  const size = statSync(path).size;
  let offset = startOffset;
  let lines = 0;
  if (startOffset >= size) return { offset, lines };
  const stream = createReadStream(path, { start: startOffset });
  let carry = Buffer.alloc(0);
  let stop = false;
  for await (const chunk of stream) {
    const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    let from = 0;
    for (;;) {
      const nl = buf.indexOf(10, from);
      if (nl === -1) break;
      let text = buf.subarray(from, nl).toString("utf8");
      if (text.endsWith("\r")) text = text.slice(0, -1);
      offset += nl - from + 1;
      lines++;
      from = nl + 1;
      if (onLine(text) === false) {
        stop = true;
        break;
      }
    }
    carry = buf.subarray(from);
    if (stop) {
      stream.destroy();
      break;
    }
  }
  return { offset, lines };
}

// Byte offset of line `line` (0-based). Clamps to the file's length.
async function offsetForLine(path, line) {
  if (line <= 0) return { line: 0, offset: 0 };
  let n = 0;
  const r = await readLines(path, 0, () => {
    n++;
    return n < line;
  });
  return { line: r.lines, offset: r.offset };
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((b) => {
      if (b?.type === "text") return b.text ?? "";
      if (b?.type === "tool_use") {
        return `[tool ${b.name}] ${JSON.stringify(b.input ?? {}).slice(0, 400)}`;
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

// One digest paragraph for a transcript record, or null for records that
// are not conversation turns: compaction summaries, meta prompts, sidechains.
function turnOf(record) {
  if (!record || typeof record !== "object") return null;
  if (record.isMeta || record.isCompactSummary || record.isVisibleInTranscriptOnly || record.isSidechain) return null;
  if (record.type === "system") return null;
  const role = record.message?.role;
  if (role !== "user" && role !== "assistant") return null;
  const text = textOf(record.message?.content).trim();
  if (!text) return null;
  return `### ${role}\n${text.slice(0, 4000)}`;
}

// Digest of the transcript from `cursor` up to MAX_CHARS. `more` says the
// segment continues past `next`.
async function digest(path, cursor) {
  const parts = [];
  let turns = 0;
  let chars = 0;
  let more = false;
  const r = await readLines(path, cursor.offset, (line) => {
    const t = line.trim();
    if (!t) return true;
    let record;
    try {
      record = JSON.parse(t);
    } catch {
      return true;
    }
    const part = turnOf(record);
    if (!part) return true;
    parts.push(part);
    turns++;
    chars += part.length;
    if (chars >= MAX_CHARS) {
      more = true;
      return false;
    }
    return true;
  });
  return {
    digest: parts.join("\n\n"),
    turns,
    more,
    next: { line: cursor.line + r.lines, offset: r.offset },
  };
}

// First `cwd` recorded in a transcript. The sweep needs it for transcripts
// no hook ever described.
async function firstCwd(path) {
  let cwd = null;
  let seen = 0;
  await readLines(path, 0, (line) => {
    seen++;
    const m = line.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
    if (m) {
      try {
        cwd = JSON.parse(`"${m[1]}"`);
      } catch {}
      return false;
    }
    return seen < 200;
  });
  return cwd;
}

// --- cursor state -------------------------------------------------------

// state/<session_id>.json:
//   { version: 2, disabled?: true,
//     transcripts: { <canonical path>: { line, offset, seen?, fail?: { count, at } } } }
// `line`/`offset` mark what was mined. `seen` marks how far a too-short tail
// reached, so the sweep does not re-read it. `fail` drives retry backoff.
// Version 1 files held { line } for a single unnamed transcript.
function statePath(sid) {
  return join(L.STATE, `${sid}.json`);
}

function loadState(sid) {
  const raw = L.readJson(statePath(sid), null);
  if (raw && raw.version === 2 && raw.transcripts) return raw;
  const state = { version: 2, transcripts: {} };
  if (raw && raw.disabled) state.disabled = true;
  if (raw && typeof raw.line === "number") state.legacyLine = raw.line;
  return state;
}

function entryFor(state, path) {
  return state.transcripts[L.canonical(path)] ?? {};
}

// Cursor for `path`. A resumed session copies its transcript into another
// project directory; seed a new path from the furthest known line so the
// copied prefix is not mined twice.
async function cursorFor(state, path) {
  const entry = entryFor(state, path);
  if (typeof entry.offset === "number") return { line: entry.line, offset: entry.offset };
  let seedLine = state.legacyLine ?? 0;
  for (const c of Object.values(state.transcripts)) seedLine = Math.max(seedLine, c.line ?? 0);
  if (seedLine === 0) return { line: 0, offset: 0 };
  return offsetForLine(path, seedLine);
}

// Merge `patch` into the transcript's entry. The mined cursor never moves
// backwards. Keys set to undefined are dropped.
function saveState(sid, state, path, patch) {
  const key = L.canonical(path);
  const prev = state.transcripts[key] ?? {};
  const next = { ...prev, ...patch };
  if (typeof prev.offset === "number" && typeof patch.offset === "number" && patch.offset < prev.offset) {
    next.offset = prev.offset;
    next.line = prev.line;
  }
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  state.transcripts[key] = next;
  delete state.legacyLine;
  L.writeAtomic(statePath(sid), JSON.stringify(state));
}

function inBackoff(entry) {
  const count = entry.fail?.count ?? 0;
  if (!count) return false;
  return Date.now() - (entry.fail.at ?? 0) < count * RETRY_BACKOFF_MS;
}

// --- model call ---------------------------------------------------------

const instructions = readFileSync(join(HERE, "lessons-prompt.md"), "utf8");
const compactInstructions = readFileSync(join(HERE, "lessons-compact-prompt.md"), "utf8");

// The CLI to run. Tests point CC_LESSONS_CLAUDE_BIN at a script that fakes
// it. On Windows an npm install leaves only a `claude.cmd` shim, which
// execFile cannot start and cmd.exe would strip the empty --tools argument
// from, so run the JavaScript entry point behind the shim directly.
function resolveClaude() {
  if (/\.(mjs|cjs|js)$/i.test(CLAUDE_BIN)) return { file: process.execPath, prefix: [CLAUDE_BIN] };
  if (/[\\/]/.test(CLAUDE_BIN) || /\.[a-z0-9]+$/i.test(CLAUDE_BIN)) return { file: CLAUDE_BIN, prefix: [] };
  if (process.platform !== "win32") return { file: CLAUDE_BIN, prefix: [] };
  for (const raw of (process.env.PATH ?? "").split(";")) {
    const dir = raw.replace(/"/g, "").trim();
    if (!dir) continue;
    if (existsSync(join(dir, `${CLAUDE_BIN}.exe`))) return { file: join(dir, `${CLAUDE_BIN}.exe`), prefix: [] };
    if (existsSync(join(dir, `${CLAUDE_BIN}.cmd`))) {
      const cli = join(dir, "node_modules", "@anthropic-ai", "claude-code", "cli.js");
      if (existsSync(cli)) return { file: process.execPath, prefix: [cli] };
    }
  }
  return { file: CLAUDE_BIN, prefix: [] };
}
const CLAUDE = resolveClaude();

// Runs `claude -p` with everything a mining call does not need switched off:
// no tools, no hooks, no MCP servers, no user or project settings and
// CLAUDE.md, no saved transcript. The prompt goes on stdin, never argv: a
// digest of MAX_CHARS is far past the ~32 KB Windows command-line limit.
// CLAUDECODE is inherited from the session that spawned this worker and the
// CLI refuses to start while it is set. Returns the model's text.
function runClaude(prompt, model) {
  const env = { ...process.env, CC_LESSONS_CHILD: "1" };
  delete env.CLAUDECODE;
  const args = [
    ...CLAUDE.prefix,
    "-p",
    "--model", model,
    "--tools", "",
    "--output-format", "json",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--settings", '{"disableAllHooks":true}',
  ];

  let out;
  try {
    out = execFileSync(CLAUDE.file, args, {
      input: prompt,
      encoding: "utf8",
      timeout: CLAUDE_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      cwd: L.ROOT,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    const stderr = String(err.stderr ?? "").replace(/\s+/g, " ").slice(0, 200);
    throw new Error(`claude exit ${err.status ?? err.code ?? "?"}: ${stderr}`);
  }

  let res;
  try {
    res = JSON.parse(out);
  } catch {
    throw new Error("claude printed something other than JSON");
  }
  if (res.is_error || (res.subtype && res.subtype !== "success")) {
    throw new Error(`claude result ${res.subtype ?? "?"}${res.is_error ? " is_error" : ""}`);
  }
  if (typeof res.result !== "string" || !res.result.trim()) {
    throw new Error("claude returned an empty result");
  }
  return res.result;
}

// The model was told to print a bare array. Tolerate fences and prose: try
// each "[" against each "]" (nearest to the ends first) and accept the first
// array that is empty or passes `looksRight`, so brackets inside the prose
// do not hide or replace the real array.
function parseArray(text, looksRight) {
  const s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const tryParse = (str) => {
    try {
      const v = JSON.parse(str);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const accept = (arr) => arr.length === 0 || looksRight(arr);
  const direct = tryParse(s);
  if (direct && accept(direct)) return direct;

  const starts = [];
  for (let i = s.indexOf("["); i !== -1 && starts.length < 20; i = s.indexOf("[", i + 1)) starts.push(i);
  const ends = [];
  for (let i = s.lastIndexOf("]"); i !== -1 && ends.length < 20; i = s.lastIndexOf("]", i - 1)) ends.push(i);
  for (const a of starts) {
    for (const b of ends) {
      if (b <= a) continue;
      const arr = tryParse(s.slice(a, b + 1));
      if (arr && accept(arr)) return arr;
    }
  }
  if (direct) return direct; // an array of something else; the caller keeps nothing from it
  throw new Error("no JSON array in model output");
}

const hasLessonObjects = (arr) => arr.some((x) => x && typeof x === "object" && "lesson" in x);

function parseLessons(text) {
  return parseArray(text, hasLessonObjects);
}

// --- scope and content guards -------------------------------------------

// The prompt asks for scope; this is the deterministic backstop. Anything
// that smells like one machine, one client or one project stays local.
const HOST_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:net|com|dk|io|org|cloud|dev|azure|local|internal)\b/i;
const PATH_RE = /(?:[A-Za-z]:[\\/]|\/home\/|\/Users\/|\/mnt\/[a-z]\/|\\\\[a-z0-9-]+\\)/i;
// Lessons are never allowed to carry credentials, whatever the scope.
const SECRET_RE = /(?:AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:password|passwd|secret|token|api[_-]?key|connectionstring)\s*[:=]\s*["']?[^\s"']{6,})/i;

function privateTerms() {
  try {
    return L.readText(L.PRIVATE_TERMS)
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#"));
  } catch {
    return [];
  }
}

// A directory's name, when it is long enough to be a real signal. Short
// names (src, app, api) would demote unrelated lessons.
function nameOf(dir) {
  const name = dir ? L.projectName(dir) : "";
  return name.length >= 4 ? name : null;
}

// Absolute paths in one lesson.
const PATH_TOKEN_RE = /(?:[A-Za-z]:[\\/][^\s"'`,;)\]]*|\/(?:home|Users)\/[^\s"'`,;)\]]*|\/mnt\/[a-z]\/[^\s"'`,;)\]]*|\\\\[a-z0-9-]+\\[^\s"'`,;)\]]*)/gi;

// True when `text` holds at least one absolute path and every one of them is
// under the user's home directory. Such a path describes this machine, not a
// client, so it must not pull a lesson down into one client's file.
function pathsAllUnderHome(text) {
  const found = text.match(PATH_TOKEN_RE) ?? [];
  if (found.length === 0) return false;
  return found.every((p) => {
    const candidates = [p, p.replace(/\//g, "\\")];
    const drive = p.match(/^\/([a-z])\/(.*)$/i);
    if (drive) candidates.push(`${drive[1]}:\\${drive[2].replace(/\//g, "\\")}`);
    return candidates.some((c) => {
      try {
        return L.isUnder(c, L.HOME);
      } catch {
        return false;
      }
    });
  });
}

// Narrow `scope` when the text betrays a narrower one. Only ever moves a
// lesson down: global to workspace or project, workspace to project. A
// workspace lesson with no workspace above the project lands in the project.
// Returns { scope, demoted } where `demoted` says why, or null.
function narrowScope(scope, text, root, wsRoot) {
  const lower = text.toLowerCase();
  const project = nameOf(root);
  const workspace = nameOf(wsRoot);
  const privateHit = privateTerms().some((term) => lower.includes(term.toLowerCase()));
  let demoted = null;

  if (scope === "global") {
    if (project && L.mentionsName(text, project)) return { scope: "project", demoted: "mentions the project name" };
    if (privateHit) return { scope: "project", demoted: "matches private-terms.txt" };
    if (workspace && L.mentionsName(text, workspace)) demoted = "mentions the workspace name";
    else if (HOST_RE.test(text)) demoted = "mentions a hostname";
    // A path under the home directory is a fact about this machine and stays
    // global; any other absolute path may belong to one client.
    else if (PATH_RE.test(text) && !pathsAllUnderHome(text)) demoted = "mentions an absolute path";
    if (demoted) scope = "workspace";
  }
  if (scope === "workspace") {
    if (project && L.mentionsName(text, project)) return { scope: "project", demoted: "mentions the project name" };
    if (privateHit) return { scope: "project", demoted: "matches private-terms.txt" };
    if (!wsRoot) return { scope: "project", demoted: demoted ?? "no workspace above the project" };
  }
  return { scope, demoted };
}

// --- one chunk ----------------------------------------------------------

// Lessons already on file for this project, its workspace and this machine,
// so the model does not repeat them. Sibling projects are never included.
function knownLessons(cwd) {
  const parts = [];
  if (cwd) {
    for (const entry of L.lessonsChain(cwd)) {
      if (!entry.managed) continue;
      if (!["project", "workspace", "store", "global"].includes(entry.origin)) continue;
      try {
        parts.push(...L.bulletsOf(L.readText(entry.path)));
      } catch {}
    }
  } else if (existsSync(L.GLOBAL_FILE)) {
    parts.push(...L.bulletsOf(L.readText(L.GLOBAL_FILE)));
  }
  let text = parts.map((b) => `- ${b}`).join("\n");
  if (text.length > KNOWN_MAX_CHARS) text = text.slice(-KNOWN_MAX_CHARS);
  return text;
}

// Files this run appended to, by canonical path: { path, kind }. Candidates
// for compaction once the queue is drained, along with the files that apply
// to the directories this run saw.
const touched = new Map();
const seenCwds = new Set();

function appendTo(target, kind, lessons, sid) {
  try {
    const n = L.appendLessons(target.path, kind, lessons, today()).length;
    if (n) {
      touched.set(L.canonical(target.path), { path: target.path, kind });
      if (kind !== "global") L.log(`wrote ${n} to ${target.kind} ${target.path} (${target.reason})`);
    }
    return n;
  } catch (err) {
    L.log(`WARN could not write ${target.path} (${sid}): ${short(err)}`);
    return 0;
  }
}

function mineChunk(job, d) {
  const cwd = job.cwd ? resolve(job.cwd) : null;
  // The project root, not the session cwd: a cwd can be a subdirectory whose
  // name is an ordinary word (hooks, windows, src) and would demote unrelated
  // global lessons.
  const root = cwd ? (L.gitToplevel(cwd) ?? cwd) : null;
  const wsRoot = root ? L.workspaceRoot(root) : null;
  const prompt = [
    instructions,
    `<project>${root ?? "unknown"}</project>`,
    `<workspace>${wsRoot ?? "none"}</workspace>`,
    `<known>\n${knownLessons(cwd)}\n</known>`,
    `<transcript>\n${d.digest}\n</transcript>`,
  ].join("\n\n");

  const raw = parseLessons(runClaude(prompt, MODEL));
  const buckets = { global: [], workspace: [], project: [] };
  const records = [];

  for (const item of raw.slice(0, MAX_LESSONS_PER_CHUNK)) {
    if (!item || typeof item.lesson !== "string" || typeof item.evidence !== "string") continue;
    const text = L.normalizeLessonText(item.lesson).slice(0, 500);
    if (!text) continue;
    const evidence = String(item.evidence).slice(0, 500);
    if (SECRET_RE.test(text) || SECRET_RE.test(evidence)) {
      L.log(`dropped a lesson that looks like it carries a credential (${job.session_id})`);
      continue;
    }
    const asked = L.KINDS.includes(item.scope) ? item.scope : "project";
    const { scope, demoted } = narrowScope(asked, text, root, wsRoot);
    if (scope !== "global" && !cwd) continue; // nowhere to put it
    buckets[scope].push(text);
    records.push({
      lesson: text,
      evidence,
      scope,
      demoted,
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 5).map(String) : [],
      project: root,
      workspace: wsRoot,
      session: job.session_id,
      event: job.event,
      at: new Date().toISOString(),
    });
  }

  let written = 0;
  if (buckets.global.length) {
    written += appendTo({ path: L.GLOBAL_FILE, kind: "global", reason: "" }, "global", buckets.global, job.session_id);
  }
  if (buckets.workspace.length) {
    written += appendTo(L.resolveWorkspaceTarget(wsRoot), "workspace", buckets.workspace, job.session_id);
  }
  if (buckets.project.length) {
    written += appendTo(L.resolveProjectTarget(cwd), "project", buckets.project, job.session_id);
  }
  for (const r of records) {
    try {
      appendFileSync(L.RECORDS, JSON.stringify(r) + "\n", "utf8");
    } catch {}
  }
  return written;
}

// --- one job ------------------------------------------------------------

// Returns "done", "skip" (too short, cursor untouched), "missing" (no
// transcript), "disabled" or "more" (segment continues, requeue). Throws on
// model failure with the cursor untouched for the failed chunk.
async function processJob(job) {
  const { session_id: sid, transcript_path: path, event } = job;
  if (!path || !existsSync(path)) return "missing";

  const state = loadState(sid);
  if (state.disabled) return "disabled";
  if (job.cwd) seenCwds.add(resolve(job.cwd));
  let cursor = await cursorFor(state, path);
  const minTurns = event === "Stop" ? MIN_TURNS : MIN_TURNS_FINAL;
  let chunks = 0;
  let lessons = 0;
  let turns = 0;
  let more = false;

  while (chunks < MAX_CHUNKS) {
    if (!holdLock()) throw new LockLost("lock taken over by another worker");
    const d = await digest(path, cursor);
    if (d.turns === 0) break;
    if (chunks === 0 && !d.more && d.turns < minTurns) {
      L.log(`${event} ${sid} skip turns=${d.turns}`);
      saveState(sid, state, path, { ...cursor, seen: d.next.offset });
      return "skip";
    }
    lessons += mineChunk(job, d);
    // Only after a parsed array. A success also clears any failure history.
    saveState(sid, state, path, { line: d.next.line, offset: d.next.offset, seen: undefined, fail: undefined });
    cursor = d.next;
    chunks++;
    turns += d.turns;
    more = d.more;
    if (!more) break;
  }
  if (chunks > 0) {
    L.log(`${event} ${sid} turns=${turns} chunks=${chunks} lessons=${lessons}${more ? " more" : ""}`);
  }
  return more ? "more" : "done";
}

// After repeated failures, step past the chunk so one bad segment cannot
// wedge a session forever. Logged so the loss is visible.
async function skipChunk(job) {
  try {
    const state = loadState(job.session_id);
    const cursor = await cursorFor(state, job.transcript_path);
    const d = await digest(job.transcript_path, cursor);
    saveState(job.session_id, state, job.transcript_path, { line: d.next.line, offset: d.next.offset, seen: undefined, fail: undefined });
    L.log(`${job.session_id} skipped lines ${cursor.line}-${d.next.line} after ${MAX_RETRIES} failures`);
  } catch (err) {
    L.log(`${job.session_id} could not skip chunk: ${short(err)}`);
  }
}

// Count a failed attempt. Returns "gaveup" once the chunk has been skipped.
async function recordFailure(job, err) {
  const state = loadState(job.session_id);
  const cursor = await cursorFor(state, job.transcript_path);
  const count = (entryFor(state, job.transcript_path).fail?.count ?? 0) + 1;
  L.log(`FAIL ${job.event} ${job.session_id} attempt ${count}: ${short(err)}`);
  saveState(job.session_id, state, job.transcript_path, { ...cursor, fail: { count, at: Date.now() } });
  if (count >= MAX_RETRIES) {
    await skipChunk(job);
    return "gaveup";
  }
  return "retry";
}

// --- queue --------------------------------------------------------------

const sessionOf = (name) => name.split("-").slice(0, 5).join("-");

function listJobs() {
  try {
    return readdirSync(L.QUEUE).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

// Jobs this run may take: not failed in this run, not inside a retry backoff.
function eligibleJobs() {
  const out = [];
  for (const name of listJobs()) {
    const sid = sessionOf(name);
    if (failedThisRun.has(sid)) continue;
    const job = L.readJson(join(L.QUEUE, name), null);
    if (job?.transcript_path && inBackoff(entryFor(loadState(sid), job.transcript_path))) continue;
    out.push(name);
  }
  return out;
}

// A crashed worker leaves .processing files behind. Put them back.
function reclaimStale() {
  for (const f of readdirSync(L.QUEUE)) {
    if (!f.endsWith(".processing")) continue;
    const p = join(L.QUEUE, f);
    try {
      if (Date.now() - statSync(p).mtimeMs > L.LOCK_STALE_MS) {
        renameSync(p, p.replace(/\.processing$/, ".json"));
      }
    } catch {}
  }
}

// Rename claims the job atomically. The mtime is bumped because rename keeps
// the enqueue time, and reclaimStale() judges staleness by it.
function claim(name) {
  const from = join(L.QUEUE, name);
  const to = from.replace(/\.json$/, ".processing");
  try {
    renameSync(from, to);
    const now = new Date();
    utimesSync(to, now, now);
    return to;
  } catch {
    return null;
  }
}

const failedThisRun = new Set();

async function drain() {
  reclaimStale();
  for (;;) {
    const jobs = eligibleJobs();
    if (jobs.length === 0) return;
    let progressed = false;
    for (const name of jobs) {
      if (!holdLock()) {
        L.log("yielding: lock taken over by another worker");
        return;
      }
      const p = claim(name);
      if (!p) continue;
      progressed = true;
      let job;
      try {
        job = JSON.parse(readFileSync(p, "utf8"));
      } catch {
        L.log(`dropping unreadable job ${name}`);
        rmSync(p, { force: true });
        continue;
      }
      // A job that was just queued describes a transcript still being flushed.
      const age = Date.now() - Date.parse(job.queued_at ?? "");
      if (age >= 0 && age < STARTUP_DELAY_MS) await sleep(STARTUP_DELAY_MS - age);
      try {
        const result = await processJob(job);
        if (result === "more") {
          renameSync(p, join(L.QUEUE, `${job.session_id}-${Date.now()}.json`));
        } else {
          rmSync(p, { force: true });
        }
      } catch (err) {
        if (err instanceof LockLost) {
          renameSync(p, join(L.QUEUE, name));
          L.log("yielding: lock taken over by another worker");
          return;
        }
        failedThisRun.add(job.session_id);
        const outcome = await recordFailure(job, err);
        renameSync(p, join(outcome === "gaveup" ? L.FAILED : L.QUEUE, name));
      }
    }
    // Nothing could be claimed (Windows can refuse the rename while another
    // process holds the file). Leave the jobs for the next run.
    if (!progressed) {
      L.log("queue: could not claim any job, leaving them for the next run");
      return;
    }
  }
}

// --- sweep --------------------------------------------------------------

// Transcripts that went quiet without a SessionEnd: a killed window, a
// crash, a machine that slept. Mines a few per run, oldest project first.
async function sweep() {
  if (!existsSync(PROJECTS_DIR)) return;
  const now = Date.now();
  let ran = 0;
  for (const dir of readdirSync(PROJECTS_DIR)) {
    let files;
    try {
      files = readdirSync(join(PROJECTS_DIR, dir));
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const sid = f.slice(0, -6);
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sid)) continue;
      const path = join(PROJECTS_DIR, dir, f);
      let st;
      try {
        st = statSync(path);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      const age = now - st.mtimeMs;
      if (age < SWEEP_MIN_IDLE_MS || age > SWEEP_MAX_AGE_MS) continue;
      if (failedThisRun.has(sid)) continue;

      const state = loadState(sid);
      if (state.disabled) continue;
      const cursor = await cursorFor(state, path);
      const entry = entryFor(state, path);
      if (Math.max(cursor.offset, entry.seen ?? 0) >= st.size) continue;
      if (inBackoff(entry)) continue;

      const cwd = await firstCwd(path);
      if (cwd && L.isTempPath(cwd)) continue;
      if (!holdLock()) return;
      const job = { session_id: sid, transcript_path: path, cwd, event: "Sweep" };
      try {
        const result = await processJob(job);
        if (result === "done" || result === "more") ran++;
      } catch (err) {
        if (err instanceof LockLost) return;
        failedThisRun.add(sid);
        await recordFailure(job, err);
      }
      if (ran >= SWEEP_MAX_JOBS) {
        L.log(`sweep: stopped after ${ran} transcripts, more next run`);
        return;
      }
    }
  }
}

// --- compaction ---------------------------------------------------------

// Append-only files grow until they no longer fit in a session's context.
// Instead of clipping them at read time, merge bullets that say the same
// thing and drop the ones a later bullet made stale. The bullets that were
// replaced go to compact.jsonl, so a bad merge can be undone by hand.

function compactStamp(path, suffix = "") {
  return join(L.THROTTLE, `compact-${createHash("sha1").update(L.canonical(path)).digest("hex").slice(0, 12)}${suffix}`);
}

function stampAge(path, suffix) {
  try {
    return Date.now() - statSync(compactStamp(path, suffix)).mtimeMs;
  } catch {
    return Infinity;
  }
}

const looksLikeCompaction = (arr) =>
  arr.every((x) => typeof x === "string" || (x && typeof x === "object" && typeof x.lesson === "string"));

// Compact one file. Returns { status: "compacted" | "skipped" | "rejected",
// reason, before, after, charsBefore, charsAfter }. `force` ignores the size
// threshold and both waiting windows; the model call itself is never skipped.
function compactFile(path, { force = false, kind } = {}) {
  if (!existsSync(path)) return { status: "skipped", reason: "no such file" };
  const text = L.readText(path);
  if (!text.trimStart().startsWith(L.MARKER)) return { status: "skipped", reason: "not written by the hook" };
  if (!force && text.length < COMPACT_AT) return { status: "skipped", reason: `under ${COMPACT_AT} characters` };
  if (!force && stampAge(path) < COMPACT_INTERVAL_MS) return { status: "skipped", reason: "compacted less than a day ago" };
  // A file the model could not shrink is not worth one call a day. Wait a
  // week: by then new lessons have arrived and there is something to merge.
  if (!force && stampAge(path, ".rejected") < REJECT_INTERVAL_MS) {
    return { status: "skipped", reason: "a compaction was refused less than a week ago" };
  }
  const { header, bullets, strays } = splitForCompaction(text);
  if (bullets.length < 2) return { status: "skipped", reason: "fewer than two lessons" };
  // Rewriting the file would drop anything that is not a bullet, and the
  // archive would not record it. Hand the file to /lessons tidy instead.
  if (strays.length) {
    return { status: "skipped", reason: `${strays.length} line(s) in the list are not lessons, cannot rewrite the file` };
  }

  try {
    writeFileSync(compactStamp(path), new Date().toISOString(), "utf8");
  } catch {}

  const scope = kind ?? kindOfFile(path, header);
  const prompt = [
    compactInstructions,
    `<scope>${scope}</scope>`,
    `<lessons-file>\n${bullets.map((b) => `- [${b.date}] ${b.lesson}`).join("\n")}\n</lessons-file>`,
  ].join("\n\n");

  const out = parseArray(runClaude(prompt, COMPACT_MODEL), looksLikeCompaction);
  const merged = [];
  for (const item of out) {
    const lesson = L.normalizeLessonText(typeof item === "string" ? item : item?.lesson).slice(0, 600);
    if (!lesson) continue;
    if (SECRET_RE.test(lesson)) continue;
    const date = typeof item?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : today();
    merged.push({ date, lesson });
  }

  const result = {
    before: bullets.length,
    after: merged.length,
    charsBefore: text.length,
    charsAfter: L.joinLessons(header, merged, today()).length,
  };
  const refuse = (reason) => {
    try {
      writeFileSync(compactStamp(path, ".rejected"), new Date().toISOString(), "utf8");
    } catch {}
    return { status: "rejected", reason, ...result };
  };
  if (merged.length === 0) return refuse("model returned nothing");
  if (merged.length > bullets.length) return refuse("more lessons than before");
  if (merged.length < Math.ceil(bullets.length * COMPACT_MIN_KEEP)) {
    return refuse(`kept only ${merged.length} of ${bullets.length} lessons`);
  }
  if (result.charsAfter > text.length) return refuse("the rewrite is longer than the file");
  const dropped = bullets.length - merged.length;
  const minDropped = Math.max(1, Math.ceil(bullets.length * COMPACT_MIN_DROP));
  if (dropped < minDropped && result.charsAfter > text.length * (1 - COMPACT_MIN_GAIN)) {
    return refuse(`merged only ${dropped} of ${bullets.length} lessons away and barely shrank the file`);
  }
  // Counts and size say nothing about whether the facts survived. Every
  // flag, identifier, error constant and version in the input must still be
  // there, or the model dropped a lesson instead of merging it.
  const had = L.factTokens(bullets.map((b) => b.lesson).join("\n"));
  const kept = L.factTokens(merged.map((b) => b.lesson).join("\n"));
  const missing = [...had].filter((t) => !kept.has(t));
  if (had.size && missing.length > Math.floor(had.size * (1 - COMPACT_MIN_FACTS))) {
    return refuse(`lost ${missing.length} of ${had.size} details, including ${missing.slice(0, 3).map((t) => JSON.stringify(t)).join(", ")}`);
  }

  // Re-read right before writing: a session's worker may have appended in
  // the meantime (this worker holds the lock, but the file is shared with
  // the user's editor). Anything not in the compacted input is kept.
  const now = L.readText(path);
  const seen = new Set(bullets.map((b) => b.lesson.toLowerCase()));
  const nowSplit = L.splitLessons(now);
  const extra = nowSplit.bullets.filter((b) => !seen.has(b.lesson.toLowerCase()));
  if (nowSplit.strays.length) return refuse("the file gained lines that are not lessons while the model was running");
  const final = [...merged, ...extra.map((b) => ({ date: b.date ?? today(), lesson: b.lesson }))];
  const written = L.joinLessons(header, final, today());
  L.writeAtomic(path, written);
  // A file that compacts again is not the one that was refused before.
  rmSync(compactStamp(path, ".rejected"), { force: true });
  try {
    appendFileSync(L.COMPACTIONS, JSON.stringify({
      at: new Date().toISOString(),
      path,
      kind: scope,
      before: bullets.length,
      after: final.length,
      charsBefore: text.length,
      charsAfter: written.length,
      replaced: bullets,
      kept: final,
    }) + "\n", "utf8");
  } catch {}
  return { status: "compacted", reason: "", ...result, after: final.length, charsAfter: written.length };
}

// Bullets with a date for the prompt; undated ones get today's.
function splitForCompaction(text) {
  const { header, bullets, strays } = L.splitLessons(text);
  return { header, strays, bullets: bullets.map((b) => ({ date: b.date ?? today(), lesson: b.lesson })) };
}

// The kind of file, used only to tell the model what it is looking at. The
// caller usually knows; this is the fallback for `--compact <path>`. A
// workspace root that is itself a repository reads as a project, which is
// what it is: the same file serves both.
function kindOfFile(path, header) {
  if (L.samePath(path, L.GLOBAL_FILE)) return "global";
  if (/across all\s+projects/i.test(header)) return "global";
  if (/repositories under this/i.test(header)) return "workspace";
  if (/sessions in this project/i.test(header)) return "project";
  // No header we recognise. A file that sits at a repository root is that
  // repository's; anything else groups several of them.
  const dir = dirname(resolve(path));
  const toplevel = L.gitToplevel(dir);
  return toplevel && L.samePath(toplevel, dir) ? "project" : "workspace";
}

function describe(path, r) {
  const size = r.charsBefore != null ? `, ${r.charsBefore} -> ${r.charsAfter} characters` : "";
  const count = r.before != null ? ` ${r.before} -> ${r.after} lessons` : "";
  return `${r.status} ${path}:${count}${size}${r.reason ? ` (${r.reason})` : ""}`;
}

// Everything this run may have to compact: the files it appended to, plus
// every managed file that applies to a directory it saw. Without the second
// half a file that stopped receiving lessons would stay oversized forever.
function compactCandidates() {
  const out = new Map(touched);
  for (const cwd of seenCwds) {
    let projectRoot;
    let wsRoot;
    try {
      projectRoot = L.gitToplevel(cwd) ?? cwd;
      wsRoot = L.workspaceRoot(projectRoot);
    } catch {
      continue;
    }
    for (const e of L.lessonsChain(cwd)) {
      if (!e.managed || e.symlink) continue;
      const key = L.canonical(e.path);
      if (out.has(key)) continue;
      let kind;
      if (e.origin === "global") kind = "global";
      else if (e.origin === "workspace") kind = "workspace";
      else if (e.origin === "project") kind = "project";
      else if (e.origin === "store") kind = wsRoot && L.samePath(e.path, L.storeFile(wsRoot)) ? "workspace" : "project";
      else continue; // "local" and "parent" files are nobody's to rewrite
      out.set(key, { path: e.path, kind });
    }
  }
  return [...out.values()];
}

function compactAll() {
  for (const { path, kind } of compactCandidates()) {
    if (!holdLock()) return;
    try {
      const r = compactFile(path, { kind });
      if (r.status !== "skipped") L.log(`compaction ${describe(path, r)}`);
    } catch (err) {
      L.log(`FAIL compaction of ${path}: ${short(err)}`);
    }
  }
}

// --- main ---------------------------------------------------------------

if (compactOnly) {
  let code = 0;
  try {
    const r = compactFile(compactOnly, { force: true });
    L.log(`compaction ${describe(compactOnly, r)}`);
    process.stdout.write(describe(compactOnly, r) + "\n");
  } catch (err) {
    L.log(`FAIL compaction of ${compactOnly}: ${short(err)}`);
    process.stdout.write(`failed ${compactOnly}: ${short(err)}\n`);
    code = 1;
  } finally {
    release();
  }
  process.exit(code);
}

// The transcript file is written asynchronously and lags the live session.
await sleep(STARTUP_DELAY_MS);

try {
  await drain();
  if (holdLock()) await sweep();
  compactAll();
} catch (err) {
  L.log(`FAIL worker: ${short(err)}`);
} finally {
  release();
}

// Jobs that arrived while this worker held the lock were not given a worker
// of their own. Hand them to a fresh one.
if (eligibleJobs().length > 0 && !process.env.CC_LESSONS_NO_SPAWN) {
  spawn(process.execPath, [fileURLToPath(import.meta.url)], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: process.env,
  }).unref();
}
