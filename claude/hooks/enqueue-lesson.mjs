#!/usr/bin/env node
// Claude Code hook: PreCompact + SessionEnd.
// Does almost nothing: writes a job to the queue and detaches an extractor.
// MUST always exit 0 -- exit 2 on PreCompact would block compaction.

import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(homedir(), ".claude", "lessons");
const QUEUE = join(ROOT, "queue");
const LOCK = join(ROOT, "extract.lock");
const LOCK_STALE_MS = 10 * 60 * 1000;

function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    const t = setTimeout(() => resolve(buf), 2000);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (buf += c));
    process.stdin.on("end", () => {
      clearTimeout(t);
      resolve(buf);
    });
    process.stdin.on("error", () => {
      clearTimeout(t);
      resolve(buf);
    });
  });
}

function extractorRunning() {
  if (!existsSync(LOCK)) return false;
  try {
    return Date.now() - statSync(LOCK).mtimeMs < LOCK_STALE_MS;
  } catch {
    return false;
  }
}

try {
  // Recursion guard: the extractor is itself a Claude Code session.
  if (process.env.CC_LESSONS_CHILD) process.exit(0);
  if (process.env.CC_LESSONS_DISABLE) process.exit(0);

  const raw = await readStdin();
  const ev = JSON.parse(raw || "{}");
  if (!ev.session_id || !ev.transcript_path) process.exit(0);

  mkdirSync(QUEUE, { recursive: true });
  const job = {
    session_id: ev.session_id,
    transcript_path: ev.transcript_path,
    cwd: ev.cwd ?? null,
    event: ev.hook_event_name ?? null,
    reason: ev.reason ?? ev.trigger ?? null,
    queued_at: new Date().toISOString(),
  };
  writeFileSync(
    join(QUEUE, `${ev.session_id}-${Date.now()}.json`),
    JSON.stringify(job),
    "utf8",
  );

  if (!extractorRunning()) {
    const script = join(dirname(fileURLToPath(import.meta.url)), "extract-lessons.mjs");
    spawn(process.execPath, [script], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
  }
} catch {
  // Swallow everything. A broken lessons pipeline must never break a session.
}

process.exit(0);
