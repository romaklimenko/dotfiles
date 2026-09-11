// Shared writer lock for extraction, compaction and agent-recorded lessons.
import { readFileSync, writeFileSync, statSync, rmSync, openSync, writeSync, closeSync } from "node:fs";
import * as L from "./lessons-lib.mjs";

export function acquireLock({ strict = false } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(L.LOCK, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return true;
    } catch (err) {
      if (err.code !== "EEXIST") {
        if (strict) throw err;
        return false;
      }
      try {
        const info = statSync(L.LOCK);
        if (!info.isFile()) throw new Error("Lessons lock path is not a regular file");
        if (Date.now() - info.mtimeMs < L.LOCK_STALE_MS) return false;
        rmSync(L.LOCK, { force: true });
      } catch (error) {
        if (strict && error.code !== "ENOENT") throw error;
        return false;
      }
    }
  }
  return false;
}

export function ownsLock() {
  try {
    return readFileSync(L.LOCK, "utf8").trim() === String(process.pid);
  } catch {
    return false;
  }
}

// Re-stamp the lock so a long run is not mistaken for a dead one. Returns
// false if another worker took the lock over; yield rather than fight.
export function holdLock() {
  if (!ownsLock()) return false;
  try {
    writeFileSync(L.LOCK, String(process.pid), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function release() {
  try {
    if (ownsLock()) rmSync(L.LOCK, { force: true });
  } catch {}
}
