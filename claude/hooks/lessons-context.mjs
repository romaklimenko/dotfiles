#!/usr/bin/env node
// Claude Code hook: SessionStart. Prints the LESSONS.md files that apply to
// the session's working directory so they land in context. Always exits 0.
//
// `--report` prints a human-readable health report instead. /lessons uses it.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  readStdin, readText, lessonsChain, isTempPath, bulletsOf,
  QUEUE, FAILED, LOCK, LOG, RECORDS, GLOBAL_FILE, LOCK_STALE_MS,
} from "./lessons-lib.mjs";

const PER_FILE = 12 * 1024;
const HEAD = 4 * 1024;
const TOTAL = 40 * 1024;
const PRIORITY = { project: 0, store: 1, global: 2, local: 3, parent: 4 };

// Keep the top (header, oldest curated bullets) and the tail (newest).
function clip(text) {
  if (text.length <= PER_FILE) return { text, cut: 0 };
  let head = text.slice(0, HEAD);
  head = head.slice(0, head.lastIndexOf("\n") + 1);
  let tail = text.slice(-(PER_FILE - HEAD));
  tail = tail.slice(tail.indexOf("\n") + 1);
  const cut = text.length - head.length - tail.length;
  return {
    text: `${head}[... ${cut} characters omitted, open the file for the rest ...]\n${tail}`,
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
      lines.push(`${entry.origin.padEnd(8)} ${entry.path}`);
      lines.push(`         ${bullets} lessons, ${st.size} bytes, modified ${st.mtime.toISOString().slice(0, 16)}${flag}`);
      if (text.length > PER_FILE) lines.push(`         over the ${PER_FILE} character injection cap, shown clipped; run /lessons tidy`);
    } catch {}
  }
  if (!existsSync(GLOBAL_FILE)) lines.push(`global   ${GLOBAL_FILE} (not created yet)`);

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
  lines.push(`  evidence per lesson: ${RECORDS}`);
  return lines.join("\n");
}

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
