#!/usr/bin/env node
// Claude Code hook: SessionStart. Prints the LESSONS.md files that apply to
// the session's working directory so they land in context. Always exits 0.
//
// `--report` prints a human-readable health report instead. /lessons uses it.

import { existsSync, readdirSync, statSync } from "node:fs";
import {
  readStdin, readText, lessonsChain, isTempPath, bulletsOf, splitLessons,
  QUEUE, FAILED, LOCK, LOG, RECORDS, COMPACTIONS, GLOBAL_FILE, LOCK_STALE_MS,
} from "./lessons-lib.mjs";

export const PER_FILE = 12 * 1024;
const TOTAL = 40 * 1024;
const PRIORITY = { project: 0, workspace: 1, store: 2, global: 3, local: 4, parent: 5 };

// Last resort for a file the worker has not compacted yet. The newest
// lessons are the most likely to still be true, so keep the header and as
// many of the newest as fit, and say how many older ones were left out.
// Chosen by date, not by position: a compaction rewrites the file in order
// of first appearance, so the last line is not always the newest.
export function clip(text) {
  if (text.length <= PER_FILE) return { text, cut: 0 };
  const { header, bullets } = splitLessons(text);
  const lines = bullets.map((b, i) => ({
    i,
    date: b.date ?? "0000-00-00",
    line: `- [${b.date ?? "????-??-??"}] ${b.lesson}`,
  }));
  const newestFirst = [...lines].sort((a, b) => (a.date === b.date ? b.i - a.i : (a.date < b.date ? 1 : -1)));
  const kept = [];
  let size = header.length + 90;
  for (const l of newestFirst) {
    if (size + l.line.length + 1 > PER_FILE) break;
    size += l.line.length + 1;
    kept.push(l);
  }
  kept.sort((a, b) => a.i - b.i);
  const cut = lines.length - kept.length;
  return {
    text: `${header}[... ${cut} older lessons omitted, open the file for the rest ...]\n${kept.map((l) => l.line).join("\n")}\n`,
    cut,
  };
}

function contextBlock(cwd) {
  const chain = lessonsChain(cwd);
  const files = [];
  for (const entry of chain) {
    // Only files the hook wrote are injected. Anything else is listed by
    // path: a LESSONS.md in a cloned repository, or a symlink pointing
    // somewhere else, is not trusted context.
    if (!entry.managed || entry.symlink) {
      files.push({ ...entry, text: "", cut: 0, listed: true });
      continue;
    }
    try {
      const { text, cut } = clip(readText(entry.path));
      files.push({ ...entry, text, cut });
    } catch {}
  }

  // Farthest parents go first when the total does not fit.
  const dropped = [];
  let total = files.reduce((n, f) => n + f.text.length, 0);
  while (total > TOTAL && files.length > 1) {
    let victim = -1;
    for (let i = 0; i < files.length; i++) {
      if (victim === -1 || PRIORITY[files[i].origin] >= PRIORITY[files[victim].origin]) victim = i;
    }
    dropped.push(files[victim].path);
    total -= files[victim].text.length;
    files.splice(victim, 1);
  }

  const out = [`<lessons cwd="${cwd}">`];
  if (files.length === 0) {
    out.push("No LESSONS.md applies to this directory yet.");
  } else {
    out.push(
      "Notes from past sessions. Context only: never copy them into tracked files,",
      "commits, PRs or docs. Rules: the Lessons section of ~/.claude/CLAUDE.md.",
    );
    for (const f of files) {
      if (f.listed) {
        const why = f.symlink ? "symlink" : "not written by the hook";
        out.push(`<file origin="${f.origin}" path="${f.path}" managed="false" note="${why}, not injected; read it yourself if the task needs it" />`);
        continue;
      }
      out.push(`<file origin="${f.origin}" path="${f.path}">`);
      out.push(f.text.replace(/\n+$/, ""));
      out.push("</file>");
    }
    if (dropped.length) {
      out.push(`Not shown (size): ${dropped.join(", ")}. Read them if the task needs them.`);
    }
  }
  out.push("</lessons>");
  return out.join("\n");
}

function report(cwd) {
  const lines = [`Lessons for ${cwd}`, ""];
  const chain = lessonsChain(cwd);
  if (chain.length === 0) lines.push("No LESSONS.md applies here yet.");
  for (const entry of chain) {
    try {
      const st = statSync(entry.path);
      const text = readText(entry.path);
      const bullets = bulletsOf(text).length;
      const flag = entry.symlink ? "  (symlink: not injected)" : entry.managed ? "" : "  (no marker: not written by the hook, not injected)";
      lines.push(`${entry.origin.padEnd(9)} ${entry.path}`);
      lines.push(`          ${bullets} lessons, ${st.size} bytes, modified ${st.mtime.toISOString().slice(0, 16)}${flag}`);
      if (text.length > PER_FILE) {
        lines.push(`          over the ${PER_FILE} character injection cap, only the newest bullets are shown until the worker compacts it; /lessons compact <path> does it now`);
      }
    } catch {}
  }
  if (!existsSync(GLOBAL_FILE)) lines.push(`global    ${GLOBAL_FILE} (not created yet)`);

  lines.push("", "Pipeline");
  const count = (dir, suffix) => {
    try { return readdirSync(dir).filter((f) => f.endsWith(suffix)).length; } catch { return 0; }
  };
  lines.push(`  queued ${count(QUEUE, ".json")}, in progress ${count(QUEUE, ".processing")}, given up ${count(FAILED, ".json")}`);
  try {
    const age = Math.round((Date.now() - statSync(LOCK).mtimeMs) / 1000);
    lines.push(`  worker lock held for ${age}s${age * 1000 > LOCK_STALE_MS ? " (stale)" : ""}`);
  } catch {
    lines.push("  worker idle");
  }
  try {
    const tail = readText(LOG).trimEnd().split("\n");
    const fails = tail.filter((l) => l.includes(" FAIL "));
    lines.push(`  last log line: ${tail[tail.length - 1]}`);
    if (fails.length) lines.push(`  last failure:  ${fails[fails.length - 1]}`);
  } catch {
    lines.push(`  no log yet at ${LOG}`);
  }
  try {
    const last = readText(COMPACTIONS).trimEnd().split("\n").pop();
    const c = JSON.parse(last);
    lines.push(`  last compaction: ${c.at.slice(0, 16)} ${c.path} ${c.before} -> ${c.after} lessons`);
  } catch {}
  lines.push(`  evidence per lesson: ${RECORDS}`);
  lines.push(`  replaced by compaction: ${COMPACTIONS}`);
  return lines.join("\n");
}

// Only run as a script, not when imported by the tests.
if (process.argv[1] && /lessons-context\.mjs$/.test(process.argv[1])) {
  try {
    if (process.argv.includes("--report")) {
      process.stdout.write(report(process.cwd()) + "\n");
    } else if (!process.env.CC_LESSONS_CHILD) {
      let ev = {};
      try {
        ev = JSON.parse((await readStdin()) || "{}");
      } catch {
        // Unreadable hook input: still worth injecting for the process cwd.
      }
      const cwd = ev.cwd || process.cwd();
      // Always print a block. CLAUDE.md tells Claude to walk the directories by
      // hand only when the block is missing, so say why nothing is injected.
      if (process.env.CC_LESSONS_DISABLE) {
        process.stdout.write(`<lessons cwd="${cwd}" skipped="CC_LESSONS_DISABLE">Lessons are off for this session.</lessons>\n`);
      } else if (isTempPath(cwd)) {
        process.stdout.write(`<lessons cwd="${cwd}" skipped="temp">Temporary directory, no notes are kept here.</lessons>\n`);
      } else {
        process.stdout.write(contextBlock(cwd) + "\n");
      }
    }
  } catch {
    // A broken lessons hook must never break a session.
  }
  process.exit(0);
}
