// Shared helpers for the lessons pipeline. Imported by the hooks in this
// directory. Nothing here is on a session's critical path except what
// lessons-context.mjs calls, so keep that part cheap.

import {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync,
  realpathSync, renameSync, statSync, lstatSync, rmSync, readdirSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join, dirname, resolve, basename, isAbsolute, relative, sep } from "node:path";

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
// Every compaction appends the bullets it replaced here, so a merge that
// went wrong can be undone by hand.
export const COMPACTIONS = join(ROOT, "compact.jsonl");
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
  const out = realPath(p);
  return WIN ? out.toLowerCase() : out;
}

// Real path with the original case kept. Two paths that name the same file
// through different spellings (8.3 short names, symlinks) become one, so
// path.relative() between them gives a usable answer.
export function realPath(p) {
  let base = resolve(p);
  const rest = [];
  for (;;) {
    try {
      const real = realpathSync.native(base);
      return rest.length ? join(real, ...rest) : real;
    } catch {
      const parent = dirname(base);
      if (parent === base) return resolve(p);
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

export const KINDS = ["project", "workspace", "global"];

export function header(kind) {
  const intro = kind === "global"
    ? [
      "Notes Claude Code wrote after past sessions on this machine, across all",
      "projects. Written by ~/.claude/hooks/extract-lessons.mjs. Evidence for each",
      "bullet is in ~/.claude/lessons/log.jsonl. Review with /lessons.",
    ]
    : kind === "workspace"
      ? [
        "Notes Claude Code wrote after past sessions in the repositories under this",
        "directory. Written by ~/.claude/hooks/extract-lessons.mjs. Evidence for each",
        "bullet is in ~/.claude/lessons/log.jsonl. Review with /lessons. Ignored by git",
        "unless you run `git add -f LESSONS.md`.",
      ]
      : [
        "Notes Claude Code wrote after past sessions in this project. Written by",
        "~/.claude/hooks/extract-lessons.mjs. Evidence for each bullet is in",
        "~/.claude/lessons/log.jsonl. Review with /lessons. Ignored by git unless you",
        "run `git add -f LESSONS.md`.",
      ];
  return [MARKER, "# Lessons", "", ...intro, "", ""].join("\n");
}

// Split a managed file into its header (everything before the first bullet,
// ending in one blank line), its bullets as { date, lesson }, and `strays`:
// the non-empty lines after the first bullet that are not bullets. A bullet
// without a date gets `date: null`. Anything that rewrites a whole file must
// refuse when `strays` is not empty, because it cannot put them back.
export function splitLessons(text) {
  const lines = text.replace(/\n+$/, "").split("\n");
  const first = lines.findIndex((l) => /^- /.test(l));
  const headerLines = first === -1 ? lines : lines.slice(0, first);
  const bullets = [];
  const strays = [];
  for (const l of first === -1 ? [] : lines.slice(first)) {
    if (!/^- /.test(l)) {
      if (l.trim()) strays.push(l);
      continue;
    }
    const m = l.match(/^- \[(\d{4}-\d{2}-\d{2})\]\s*(.*)$/);
    bullets.push(m ? { date: m[1], lesson: m[2].trim() } : { date: null, lesson: normalizeLessonText(l) });
  }
  return { header: headerLines.join("\n").replace(/\n+$/, "") + "\n\n", bullets, strays };
}

// The distinctive tokens in a lesson: code spans, command flags, dotted or
// underscored identifiers, error constants, versions and sizes. A rewrite
// that loses these lost a fact rather than merging one, which is the failure
// no count or size check can catch.
export function factTokens(text) {
  const out = new Set();
  const add = (s) => {
    const t = String(s).replace(/\(\)$/, "").replace(/^[.\-]+|[.,;:]+$/g, "").trim().toLowerCase();
    if (t.length >= 3) out.add(t);
  };
  // Backticks and the "=" of KEY=value are formatting, not facts. A merge
  // that writes the same identifier bare kept the detail, and comparing the
  // raw spans would call that a loss.
  const flat = text.replace(/`/g, " ").replace(/=/g, " ");
  for (const m of flat.matchAll(/(?<![\w-])--?[a-z][\w-]{2,}/gi)) add(m[0]);
  for (const m of flat.matchAll(/\b[A-Za-z_][\w-]*(?:[._][\w-]+)+\b/g)) add(m[0]);
  for (const m of flat.matchAll(/\b[A-Z][A-Z0-9_]{3,}\b/g)) add(m[0]);
  for (const m of flat.matchAll(/\b(?:\d*\.\d+|\d{2,})\b/g)) add(m[0]);
  return out;
}

// Escaped for use inside a RegExp.
export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whether `text` names `name` as a word. A bare substring test would match
// "home" inside "homepage" and pull unrelated lessons down a level.
export function mentionsName(text, name) {
  if (!name) return false;
  return new RegExp(`(?:^|[^\\w-])${escapeRe(name)}(?:[^\\w-]|$)`, "i").test(text);
}

export function joinLessons(header, bullets, fallbackDate) {
  return header + bullets.map((b) => `- [${b.date ?? fallbackDate}] ${b.lesson}\n`).join("");
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

// --- where lessons live -------------------------------------------------

// Out-of-tree home for a directory's lessons when the in-tree file cannot be
// used. Keyed like ~/.claude/projects so it is easy to find by hand.
export function storeFile(root) {
  return join(PROJECTS_STORE, projectSlug(root), FILE_NAME);
}

function storeTarget(root, reason) {
  return { root, path: storeFile(root), kind: "store", reason };
}

// In-tree only when git is proven to ignore the file or the user already
// tracks a file we wrote. `inTree` is the absolute path of the file,
// `relPath` its path relative to `toplevel` with forward slashes.
function resolveInRepo(root, toplevel, inTree, relPath) {
  if (existsSync(inTree) && !hasMarker(inTree)) {
    return storeTarget(root, "LESSONS.md exists without marker");
  }
  if (gitIsTracked(toplevel, relPath)) {
    return { root, path: inTree, kind: "tree", reason: "tracked" };
  }
  if (gitIsIgnored(toplevel, relPath)) {
    // Already ignored, usually by the global ignore. Pin it in the repository
    // too so a machine without that global rule still keeps it out.
    gitAddToExclude(toplevel, FILE_NAME);
    return { root, path: inTree, kind: "tree", reason: "ignored" };
  }
  if (gitAddToExclude(toplevel, FILE_NAME) && gitIsIgnored(toplevel, relPath)) {
    return { root, path: inTree, kind: "tree", reason: "added to .git/info/exclude" };
  }
  return storeTarget(root, "could not make git ignore it");
}

// Decide where project lessons for `cwd` are written. Returns
// { root, path, kind: "tree" | "store", reason }.
//
// In-tree only when git is proven to ignore the file or the user already
// tracks a file we wrote. Everything else goes to the store: no repository,
// cwd at or above the home directory, a temp directory, or a LESSONS.md
// somebody else wrote.
export function resolveProjectTarget(cwd) {
  const dir = resolve(cwd);
  if (isTempPath(dir)) return storeTarget(dir, "temp cwd");
  const toplevel = gitToplevel(dir);
  if (!toplevel) return storeTarget(dir, "not a git repository");
  if (isUnder(HOME, toplevel)) return storeTarget(toplevel, "repository contains the home directory");
  return resolveInRepo(toplevel, toplevel, join(toplevel, FILE_NAME), FILE_NAME);
}

// Where lessons for a workspace root are written. The directory qualified
// through workspaceRoot(), so outside any repository the file goes in place:
// there is no repository to leak it into. Inside a repository the same proof
// as for a project applies, with the file's path relative to that repository.
export function resolveWorkspaceTarget(root) {
  const dir = resolve(root);
  const inTree = join(dir, FILE_NAME);
  if (isTempPath(dir)) return storeTarget(dir, "temp directory");
  if (existsSync(inTree) && !hasMarker(inTree)) {
    return storeTarget(dir, "LESSONS.md exists without marker");
  }
  const toplevel = gitToplevel(dir);
  if (!toplevel) return { root: dir, path: inTree, kind: "tree", reason: "not inside a git repository" };
  if (isUnder(HOME, toplevel)) return storeTarget(dir, "repository contains the home directory");
  // Both through realPath(): git answers with the long spelling while the
  // caller may hold an 8.3 short one, and relative() across the two is junk.
  const relPath = relative(realPath(toplevel), realPath(inTree)).split(sep).join("/");
  return resolveInRepo(dir, toplevel, inTree, relPath);
}

// --- workspace ----------------------------------------------------------

// A directory looks like a workspace root when the user set it up as one: a
// CLAUDE.md, a git repository holding the project as an untracked clone, a
// multi-root editor workspace, or a LESSONS.md the hook already wrote there.
export function looksLikeWorkspace(dir) {
  try {
    if (existsSync(join(dir, "CLAUDE.md"))) return true;
    if (existsSync(join(dir, ".git"))) return true;
    if (hasMarker(join(dir, FILE_NAME))) return true;
    return readdirSync(dir).some((f) => f.endsWith(".code-workspace"));
  } catch {
    return false;
  }
}

// Nearest ancestor of `projectRoot`, strictly above it, that looks like a
// workspace root, or null. Never the home directory, anything above it, the
// filesystem root, or a temp directory. Cheap on purpose: only stat and
// readdir, no git, because the session-start hook runs it.
export function workspaceRoot(projectRoot) {
  let dir = dirname(resolve(projectRoot));
  for (;;) {
    const parent = dirname(dir);
    if (parent === dir) return null;
    if (isUnder(HOME, dir) || isTempPath(dir)) return null;
    if (looksLikeWorkspace(dir)) return dir;
    dir = parent;
  }
}

// --- discovery for reading ----------------------------------------------

// Every LESSONS.md that applies to `cwd`, nearest first, then the project's
// and the workspace's out-of-tree store, then the user-level file. Each entry:
// { path, origin, managed, symlink } with origin one of
// "local" | "project" | "workspace" | "parent" | "store" | "global".
// `managed` means the hook wrote it (marker present).
export function lessonsChain(cwd) {
  const start = resolve(cwd);
  const toplevel = gitToplevel(start);
  const projectRoot = toplevel ?? start;
  const wsRoot = workspaceRoot(projectRoot);
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
    else if (wsRoot && samePath(dir, wsRoot)) origin = "workspace";
    else origin = "parent";
    push(candidate, origin);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  push(storeFile(projectRoot), "store");
  if (wsRoot) push(storeFile(wsRoot), "store");
  push(GLOBAL_FILE, "global");
  return out;
}

export function projectName(root) {
  return basename(root);
}
