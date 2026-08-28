#!/usr/bin/env node
// Detached worker. Drains ~/.claude/lessons/queue: for each job it reads the
// part of the transcript it has not seen, asks a cheap model for lessons, and
// appends them to LESSONS.md files. Then it sweeps ~/.claude/projects for
// transcripts no hook reached. Nothing here runs inside a session.

import {
  mkdirSync, existsSync, readFileSync, appendFileSync, readdirSync, rmSync,
  renameSync, statSync, openSync, writeSync, closeSync, writeFileSync,
  createReadStream, utimesSync,
} from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./lessons-lib.mjs";

const MODEL = process.env.CC_LESSONS_MODEL || "haiku";
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

class LockLost extends Error {}

// --- lock ---------------------------------------------------------------

for (const d of [L.ROOT, L.QUEUE, L.STATE, L.FAILED]) mkdirSync(d, { recursive: true });

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

if (!acquireLock()) process.exit(0);
process.on("exit", release);
L.trimLog();

// The transcript file is written asynchronously and lags the live session.
await sleep(STARTUP_DELAY_MS);

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
// CLI refuses to start while it is set.
function runClaude(prompt) {
  const env = { ...process.env, CC_LESSONS_CHILD: "1" };
  delete env.CLAUDECODE;
  const args = [
    ...CLAUDE.prefix,
    "-p",
    "--model", MODEL,
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
  return parseLessons(res.result);
}

// The model was told to print a bare array. Tolerate fences and prose: try
// each "[" against each "]" (nearest to the ends first) and accept the first
// array that is empty or holds lesson objects, so brackets inside the prose
// do not hide or replace the real array.
function parseLessons(text) {
  const s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const tryParse = (str) => {
    try {
      const v = JSON.parse(str);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const looksRight = (arr) => arr.length === 0 || arr.some((x) => x && typeof x === "object" && "lesson" in x);
  const direct = tryParse(s);
  if (direct && looksRight(direct)) return direct;

  const starts = [];
  for (let i = s.indexOf("["); i !== -1 && starts.length < 20; i = s.indexOf("[", i + 1)) starts.push(i);
  const ends = [];
  for (let i = s.lastIndexOf("]"); i !== -1 && ends.length < 20; i = s.lastIndexOf("]", i - 1)) ends.push(i);
  for (const a of starts) {
    for (const b of ends) {
      if (b <= a) continue;
      const arr = tryParse(s.slice(a, b + 1));
      if (arr && looksRight(arr)) return arr;
    }
  }
  if (direct) return direct; // an array of something else; the caller keeps nothing from it
  throw new Error("no JSON array in model output");
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

function demoteReason(text, projectRoot) {
  const lower = text.toLowerCase();
  const name = projectRoot ? L.projectName(projectRoot) : "";
  if (name.length >= 4 && lower.includes(name.toLowerCase())) return "mentions the project name";
  if (HOST_RE.test(text)) return "mentions a hostname";
  if (PATH_RE.test(text)) return "mentions an absolute path";
  for (const term of privateTerms()) {
    if (lower.includes(term.toLowerCase())) return "matches private-terms.txt";
  }
  return null;
}

// --- one chunk ----------------------------------------------------------

// Lessons already on file for this project and machine, so the model does
// not repeat them. Sibling projects are never included.
function knownLessons(cwd) {
  const parts = [];
  if (cwd) {
    for (const entry of L.lessonsChain(cwd)) {
      if (!entry.managed) continue;
      if (entry.origin !== "project" && entry.origin !== "store" && entry.origin !== "global") continue;
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

function mineChunk(job, d) {
  const cwd = job.cwd ? resolve(job.cwd) : null;
  // The project root, not the session cwd: a cwd can be a subdirectory whose
  // name is an ordinary word (hooks, windows, src) and would demote unrelated
  // global lessons.
  const root = cwd ? (L.gitToplevel(cwd) ?? cwd) : null;
  const prompt = [
    instructions,
    `<project>${root ?? "unknown"}</project>`,
    `<known>\n${knownLessons(cwd)}\n</known>`,
    `<transcript>\n${d.digest}\n</transcript>`,
  ].join("\n\n");

  const raw = runClaude(prompt);
  const date = new Date().toISOString().slice(0, 10);
  const global = [];
  const project = [];
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
    let scope = item.scope === "global" ? "global" : "project";
    let demoted = null;
    if (scope === "global") {
      demoted = demoteReason(text, root);
      if (demoted) scope = "project";
    }
    if (scope === "project" && !cwd) continue; // nowhere to put it
    (scope === "global" ? global : project).push(text);
    records.push({
      lesson: text,
      evidence,
      scope,
      demoted,
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 5).map(String) : [],
      project: root,
      session: job.session_id,
      event: job.event,
      at: new Date().toISOString(),
    });
  }

  let written = 0;
  if (global.length) {
    try {
      written += L.appendLessons(L.GLOBAL_FILE, "global", global, date).length;
    } catch (err) {
      L.log(`WARN could not write ${L.GLOBAL_FILE}: ${short(err)}`);
    }
  }
  if (project.length) {
    const target = L.resolveProjectTarget(cwd);
    try {
      const n = L.appendLessons(target.path, "project", project, date).length;
      written += n;
      if (n) L.log(`wrote ${n} to ${target.kind} ${target.path} (${target.reason})`);
    } catch (err) {
      L.log(`WARN could not write ${target.path}: ${short(err)}`);
    }
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

// --- main ---------------------------------------------------------------

try {
  await drain();
  if (holdLock()) await sweep();
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
