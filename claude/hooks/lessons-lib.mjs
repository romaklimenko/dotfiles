// Shared helpers for the lessons pipeline. Imported by the hooks in this
// directory. Nothing here is on a session's critical path except what
// lessons-context.mjs calls, so keep that part cheap.

import {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync,
  realpathSync, renameSync, statSync, lstatSync, rmSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join, dirname, resolve, basename, isAbsolute } from "node:path";

// CC_LESSONS_HOME and CC_LESSONS_TMPDIR let the tests point everything at a
// scratch directory.
export const HOME = process.env.CC_LESSONS_HOME || homedir();
export const TMPDIR = process.env.CC_LESSONS_TMPDIR || tmpdir();
export const CLAUDE_DIR = join(HOME, ".claude");
export const ROOT = join(CLAUDE_DIR, "lessons");
export const QUEUE = join(ROOT, "queue");
export const STATE = join(ROOT, "state");
export const FAILED = join(ROOT, "failed");
export const THROTTLE = join(ROOT, "throttle");
export const PROJECTS_STORE = join(ROOT, "projects");
export const LOCK = join(ROOT, "extract.lock");
export const LOG = join(ROOT, "lessons.log");
export const RECORDS = join(ROOT, "log.jsonl");
export const PRIVATE_TERMS = join(ROOT, "private-terms.txt");
export const GLOBAL_FILE = join(CLAUDE_DIR, "LESSONS.md");

export const FILE_NAME = "LESSONS.md";
export const MARKER = "<!-- claude-code lessons, auto-written -->";
export const LOCK_STALE_MS = 10 * 60 * 1000;
export const LOG_MAX_BYTES = 256 * 1024;

const WIN = process.platform === "win32";

// --- hook input ---------------------------------------------------------

// Hooks receive one JSON object on stdin. Never wait on it for long: a hook
// that hangs delays the session.
export function readStdin(timeoutMs = 2000) {
  return new Promise((resolve) => {
    let buf = "";
    const done = () => {
      clearTimeout(timer);
      resolve(buf);
    };
    const timer = setTimeout(done, timeoutMs);
    try {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => (buf += c));
      process.stdin.on("end", done);
      process.stdin.on("error", done);
    } catch {
      done();
    }
  });
}

// --- logging ------------------------------------------------------------

export function log(message) {
  try {
    mkdirSync(ROOT, { recursive: true });
    appendFileSync(LOG, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {}
}

// Keep the tail of the log. It is the only file in the pipeline that can grow
// without bound, and an old failure once wrote a whole prompt into it.
export function trimLog() {
  try {
    if (!existsSync(LOG)) return;
    const size = statSync(LOG).size;
    if (size <= LOG_MAX_BYTES) return;
    const text = readFileSync(LOG, "utf8");
    const tail = text.slice(-LOG_MAX_BYTES);
    const firstNewline = tail.indexOf("\n");
    writeFileSync(LOG, tail.slice(firstNewline + 1), "utf8");
  } catch {}
}

// --- paths --------------------------------------------------------------

// One spelling per path. Transcripts carry both `c:\home\x` and `C:\home\x`,
// and Windows hands out 8.3 short names (`ROMANK~1`) for the temp directory.
// A path that does not exist yet is resolved through its deepest existing
// ancestor so it compares equal to the same path once created.
export function canonical(p) {
  let base = resolve(p);
  const rest = [];
  for (;;) {
    try {
      const real = realpathSync.native(base);
      const out = rest.length ? join(real, ...rest) : real;
      return WIN ? out.toLowerCase() : out;
    } catch {
      const parent = dirname(base);
      if (parent === base) {
        const out = resolve(p);
        return WIN ? out.toLowerCase() : out;
      }
      rest.unshift(basename(base));
      base = parent;
    }
  }
}

export function samePath(a, b) {
  return canonical(a) === canonical(b);
}

export function isUnder(child, parent) {
  const c = canonical(child);
  const p = canonical(parent);
  if (c === p) return true;
  const sep = WIN ? "\\" : "/";
  return c.startsWith(p.endsWith(sep) ? p : p + sep);
}

export function isTempPath(p) {
  return isUnder(p, TMPDIR);
}

// Like the encoding Claude Code uses for ~/.claude/projects/<slug>, plus a
// short hash so `a-b` and `a_b` do not share one file.
export function projectSlug(root) {
  const key = canonical(root);
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 6);
  return `${key.replace(/[^a-z0-9]/gi, "-")}-${hash}`;
}

// --- git ----------------------------------------------------------------

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 10_000,
    windowsHide: true,
  }).trim();
}

// Exit status of a git command, or null when git could not run at all.
function gitStatus(cwd, args) {
  try {
    git(cwd, args);
    return 0;
  } catch (err) {
    return typeof err?.status === "number" ? err.status : null;
  }
}

// Top-level directory of the repository containing `dir`, or null.
export function gitToplevel(dir) {
  try {
    const out = git(dir, ["rev-parse", "--show-toplevel"]);
    return out ? resolve(out) : null;
  } catch {
    return null;
  }
}

export function gitIsTracked(toplevel, relPath) {
  return gitStatus(toplevel, ["ls-files", "--error-unmatch", "--", relPath]) === 0;
}

export function gitIsIgnored(toplevel, relPath) {
  return gitStatus(toplevel, ["check-ignore", "-q", "--", relPath]) === 0;
}

// Add a pattern to the repository's private exclude file. Returns true when
// the pattern is present afterwards. Runs git from the toplevel and asks for
// an absolute path: run from a subdirectory `--git-path` answers with a
// relative path that does not resolve from the worker's cwd.
export function gitAddToExclude(toplevel, pattern) {
  try {
    let excludePath = git(toplevel, [
      "rev-parse", "--path-format=absolute", "--git-path", "info/exclude",
    ]);
    if (!excludePath) return false;
    if (!isAbsolute(excludePath)) excludePath = resolve(toplevel, excludePath);
    mkdirSync(dirname(excludePath), { recursive: true });
    let text = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    if (lines.includes(pattern)) return true;
    if (text.length > 0 && !text.endsWith("\n")) text += "\n";
    text += `${pattern}\n`;
    writeFileSync(excludePath, text, "utf8");
    return true;
  } catch {
    return false;
  }
}

// --- LESSONS.md files ---------------------------------------------------

export function readText(path) {
  let text = readFileSync(path, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\r\n/g, "\n");
}

export function hasMarker(path) {
  try {
    const head = readText(path).slice(0, 512);
    return head.trimStart().startsWith(MARKER);
  } catch {
    return false;
  }
}

// Bullet text without the `- [date] ` prefix, normalised for comparison.
export function normalizeLessonText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^-\s+/, "")
    .replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, "")
    .trim();
}

export function bulletsOf(text) {
  return text
    .split("\n")
    .filter((l) => /^- /.test(l))
    .map((l) => normalizeLessonText(l));
}

export function header(kind) {
  const intro = kind === "global"
    ? [
      "Notes Claude Code wrote after past sessions on this machine, across all",
      "projects. Written by ~/.claude/hooks/extract-lessons.mjs. Evidence for each",
      "bullet is in ~/.claude/lessons/log.jsonl. Review with /lessons.",
    ]
    : [
      "Notes Claude Code wrote after past sessions in this project. Written by",
      "~/.claude/hooks/extract-lessons.mjs. Evidence for each bullet is in",
      "~/.claude/lessons/log.jsonl. Review with /lessons. Ignored by git unless you",
      "run `git add -f LESSONS.md`.",
    ];
  return [MARKER, "# Lessons", "", ...intro, "", ""].join("\n");
}

// Header of an existing file replaced by the current template; bullets kept.
export function rewriteHeader(path, kind) {
  const text = readText(path);
  if (!text.trimStart().startsWith(MARKER)) throw new Error(`refusing to rewrite ${path}: missing marker`);
  const bullets = text.split("\n").filter((l) => /^- /.test(l));
  writeAtomic(path, header(kind) + bullets.map((l) => `${l}\n`).join(""));
}

// Append bullets that are not already present. Returns the bullets written.
export function appendLessons(path, kind, lessons, date) {
  mkdirSync(dirname(path), { recursive: true });
  let text = existsSync(path) ? readText(path) : header(kind);
  if (!text.trimStart().startsWith(MARKER)) {
    throw new Error(`refusing to write ${path}: missing marker`);
  }
  const known = new Set(bulletsOf(text).map((b) => b.toLowerCase()));
  const written = [];
  for (const lesson of lessons) {
    const clean = normalizeLessonText(lesson);
    if (!clean || known.has(clean.toLowerCase())) continue;
    known.add(clean.toLowerCase());
    written.push(clean);
  }
  if (written.length === 0) return written;
  if (!text.endsWith("\n")) text += "\n";
  text += written.map((l) => `- [${date}] ${l}\n`).join("");
  writeAtomic(path, text);
  return written;
}

// Write to a sibling temp file, then rename. On failure the temp file is
// removed so nothing stray is left inside a repository.
export function writeAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, text, "utf8");
    renameSync(tmp, path);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

export function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

// --- where project lessons live -----------------------------------------

// Out-of-tree home for a project's lessons when the in-tree file cannot be
// used. Keyed like ~/.claude/projects so it is easy to find by hand.
export function storeFile(projectRoot) {
  return join(PROJECTS_STORE, projectSlug(projectRoot), FILE_NAME);
}

// Decide where lessons for `cwd` are written. Returns
// { root, path, kind: "tree" | "store", reason }.
//
// In-tree only when git is proven to ignore the file or the user already
// tracks a file we wrote. Everything else goes to the store: no repository,
// cwd at or above the home directory, a temp directory, or a LESSONS.md
// somebody else wrote.
export function resolveProjectTarget(cwd) {
  const dir = resolve(cwd);
  if (isTempPath(dir)) {
    return { root: dir, path: storeFile(dir), kind: "store", reason: "temp cwd" };
  }
  const toplevel = gitToplevel(dir);
  if (!toplevel) {
    return { root: dir, path: storeFile(dir), kind: "store", reason: "not a git repository" };
  }
  if (isUnder(HOME, toplevel)) {
    return { root: toplevel, path: storeFile(toplevel), kind: "store", reason: "repository contains the home directory" };
  }
  const inTree = join(toplevel, FILE_NAME);
  if (existsSync(inTree) && !hasMarker(inTree)) {
    return { root: toplevel, path: storeFile(toplevel), kind: "store", reason: "LESSONS.md exists without marker" };
  }
  if (gitIsTracked(toplevel, FILE_NAME)) {
    return { root: toplevel, path: inTree, kind: "tree", reason: "tracked" };
  }
  if (gitIsIgnored(toplevel, FILE_NAME)) {
    // Already ignored, usually by the global ignore. Pin it in the repository
    // too so a machine without that global rule still keeps it out.
    gitAddToExclude(toplevel, FILE_NAME);
    return { root: toplevel, path: inTree, kind: "tree", reason: "ignored" };
  }
  if (gitAddToExclude(toplevel, FILE_NAME) && gitIsIgnored(toplevel, FILE_NAME)) {
    return { root: toplevel, path: inTree, kind: "tree", reason: "added to .git/info/exclude" };
  }
  return { root: toplevel, path: storeFile(toplevel), kind: "store", reason: "could not make git ignore it" };
}

// --- discovery for reading ----------------------------------------------

// Every LESSONS.md that applies to `cwd`, nearest first, then the project's
// out-of-tree store, then the user-level file. Each entry:
// { path, origin: "project" | "local" | "parent" | "store" | "global",
//   managed, symlink }. `managed` means the hook wrote it (marker present).
export function lessonsChain(cwd) {
  const start = resolve(cwd);
  const toplevel = gitToplevel(start);
  const projectRoot = toplevel ?? start;
  const seen = new Set();
  const out = [];
  const push = (path, origin) => {
    let symlink = false;
    try {
      const st = lstatSync(path);
      symlink = st.isSymbolicLink();
      if (!symlink && !st.isFile()) return;
    } catch {
      return;
    }
    if (!existsSync(path)) return;
    const key = canonical(path);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ path, origin, managed: hasMarker(path), symlink });
  };

  let dir = start;
  for (;;) {
    const candidate = join(dir, FILE_NAME);
    let origin;
    if (samePath(dir, projectRoot)) origin = "project";
    else if (isUnder(dir, projectRoot)) origin = "local";
    else origin = "parent";
    push(candidate, origin);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  push(storeFile(projectRoot), "store");
  push(GLOBAL_FILE, "global");
  return out;
}

export function projectName(root) {
  return basename(root);
}
