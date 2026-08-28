#!/usr/bin/env node
// Claude Code hook: SessionStart, Stop, PreCompact, SessionEnd.
// Writes a job to the queue and detaches a worker. Does nothing slow.
// MUST always exit 0: exit 2 on PreCompact would block compaction.

import { mkdirSync, writeFileSync, existsSync, statSync, readdirSync, renameSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  QUEUE, STATE, THROTTLE, LOCK, LOCK_STALE_MS, readStdin, readJson, writeAtomic, log, isTempPath,
} from "./lessons-lib.mjs";

const STOP_THROTTLE_MS = Number(process.env.CC_LESSONS_STOP_MINUTES || 30) * 60 * 1000;

function workerRunning() {
  try {
    return existsSync(LOCK) && Date.now() - statSync(LOCK).mtimeMs < LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function spawnWorker() {
  if (process.env.CC_LESSONS_NO_SPAWN || workerRunning()) return;
  const script = join(dirname(fileURLToPath(import.meta.url)), "extract-lessons.mjs");
  spawn(process.execPath, [script], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: process.env,
  }).unref();
}

function hasQueuedJob(sessionId) {
  try {
    return readdirSync(QUEUE).some((f) => f.startsWith(`${sessionId}-`) && f.endsWith(".json"));
  } catch {
    return false;
  }
}

// A session run with CC_LESSONS_DISABLE must stay unmined, including by the
// sweep, which only sees the transcript. Leave a marker in its state file.
function markDisabled(sessionId) {
  mkdirSync(STATE, { recursive: true });
  const path = join(STATE, `${sessionId}.json`);
  const state = readJson(path, { version: 2, transcripts: {} });
  state.disabled = true;
  writeAtomic(path, JSON.stringify(state));
}

try {
  // The worker's own `claude -p` child must not feed the queue.
  if (process.env.CC_LESSONS_CHILD) process.exit(0);

  const ev = JSON.parse((await readStdin()) || "{}");
  if (!ev.session_id) process.exit(0);
  const sid = ev.session_id;
  const event = ev.hook_event_name ?? "unknown";
  const cwd = ev.cwd ?? null;

  if (process.env.CC_LESSONS_DISABLE) {
    markDisabled(sid);
    process.exit(0);
  }

  // Scratch sessions in a temp directory leave nothing worth keeping.
  if (cwd && isTempPath(cwd)) process.exit(0);

  mkdirSync(QUEUE, { recursive: true });
  mkdirSync(THROTTLE, { recursive: true });

  // SessionStart only wakes the worker so it can sweep for transcripts that
  // ended without a SessionEnd. No job: there is nothing to read yet.
  if (event === "SessionStart") {
    spawnWorker();
    process.exit(0);
  }
  if (!ev.transcript_path) process.exit(0);

  // Stop fires after every reply. Mine at most once per window; SessionEnd and
  // PreCompact still catch whatever a throttled Stop left behind.
  if (event === "Stop") {
    const stamp = join(THROTTLE, sid);
    if (existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < STOP_THROTTLE_MS) {
      process.exit(0);
    }
    writeFileSync(stamp, new Date().toISOString(), "utf8");
  }

  // The worker reads the transcript when the job runs, so one queued job
  // already covers everything written since. Final events always enqueue.
  const final = event === "SessionEnd" || event === "PreCompact";
  if (!final && hasQueuedJob(sid)) {
    spawnWorker();
    process.exit(0);
  }

  const job = {
    session_id: sid,
    transcript_path: ev.transcript_path,
    cwd,
    event,
    reason: ev.reason ?? ev.trigger ?? ev.source ?? null,
    queued_at: new Date().toISOString(),
  };
  // Write, then rename: the worker must never see a half-written job.
  const name = join(QUEUE, `${sid}-${Date.now()}.json`);
  writeFileSync(`${name}.tmp`, JSON.stringify(job), "utf8");
  renameSync(`${name}.tmp`, name);
  log(`${event} ${sid} queued cwd=${cwd ?? "?"}`);
  spawnWorker();
} catch {
  // Swallow everything. A broken lessons pipeline must never break a session.
}

process.exit(0);
