// Deterministic content and scope guards shared by both lesson writers.
import * as L from "./lessons-lib.mjs";

const HOST_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:net|com|dk|io|org|cloud|dev|azure|local|internal)\b/i;
const PATH_RE = /(?:[A-Za-z]:[\\/]|\/home\/|\/Users\/|\/mnt\/[a-z]\/|\\\\[a-z0-9-]+\\)/i;
// Lessons are never allowed to carry credentials, whatever the scope.
export const SECRET_RE = /(?:AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:password|passwd|secret|token|api[_-]?key|connectionstring)\s*[:=]\s*["']?[^\s"']{6,})/i;

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
export function narrowScope(scope, text, root, wsRoot) {
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
