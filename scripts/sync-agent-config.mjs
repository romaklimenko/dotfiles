#!/usr/bin/env node

// Install only the agent files owned by dotfiles. Never rewrite Codex settings.
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync,
  renameSync, writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function jsonFile(file) {
  let value;
  try { value = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
  catch (error) {
    // JSON parse errors can quote local settings content; report only the path.
    if (error instanceof SyntaxError) throw new SyntaxError(`Invalid JSON in ${file}`);
    throw error;
  }
  if (!isObject(value)) throw new Error(`Expected a JSON object in ${file}`);
  return value;
}

// Local values win, including arrays and false/null settings. Missing defaults
// are installed recursively without resetting somebody's chosen preferences.
function withDefaults(local, defaults) {
  const result = { ...local };
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.hasOwn(result, key)) result[key] = value;
    else if (isObject(value) && isObject(result[key])) result[key] = withDefaults(result[key], value);
  }
  return result;
}

function hookScript(hook) {
  if (hook?.type !== "command" || typeof hook.command !== "string") return null;
  return hook.command.match(/(?:\.claude[\\/]hooks[\\/])([^\s"']+\.mjs)(?=[\s"']|$)/)?.[1] ?? null;
}

export function mergeSettings(local, defaults) {
  const { hooks: defaultHooks = {}, ...otherDefaults } = defaults;
  if (!isObject(defaultHooks) || (local.hooks !== undefined && !isObject(local.hooks))) {
    throw new Error("Claude settings hooks must be an object");
  }
  const ownedScripts = new Set(Object.values(defaultHooks).flatMap((groups) => {
    if (!Array.isArray(groups)) throw new Error("Claude hook events must contain arrays");
    return groups.flatMap((group) => (group.hooks ?? []).map(hookScript).filter(Boolean));
  }));
  const result = withDefaults(local, otherDefaults);
  result.hooks = {};
  for (const [event, groups] of Object.entries(local.hooks ?? {})) {
    if (!Array.isArray(groups)) throw new Error("Claude hook events must contain arrays");
    result.hooks[event] = groups.flatMap((group) => {
      if (!isObject(group) || !Array.isArray(group.hooks)) throw new Error("Invalid Claude hook group");
      const kept = group.hooks.filter((hook) => !ownedScripts.has(hookScript(hook)));
      return kept.length || !group.hooks.length ? [{ ...group, hooks: kept }] : [];
    });
  }
  for (const [event, groups] of Object.entries(defaultHooks)) {
    result.hooks[event] = [...(result.hooks[event] ?? []), ...groups];
  }
  return result;
}

function samePath(a, b) {
  try { return realpathSync(a) === realpathSync(b); } catch { return false; }
}

function stat(file) {
  try { return lstatSync(file); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// Existing directory links to this repo already expose the current source.
// Refuse other links before any writes, rather than mutate their target trees.
function validateParents(file, root) {
  const rel = relative(root, dirname(file));
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Agent destination is outside its configured root: ${file}`);
  }
  let current = root;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    const info = stat(current);
    if (info?.isSymbolicLink()) throw new Error(`Refusing to write through directory link: ${current}`);
    if (info && !info.isDirectory()) throw new Error(`Expected a directory: ${current}`);
  }
}

function sourceFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...sourceFiles(file));
    else if (entry.isFile()) result.push(file);
    else throw new Error(`Unsupported source link or special file: ${file}`);
  }
  return result;
}

export function syncAgentConfig({ repo, home, codexHome = process.env.CODEX_HOME || join(home, ".codex"), platform = process.platform }) {
  const repoRoot = resolve(repo);
  const userRoot = resolve(home);
  const codexRoot = resolve(codexHome);
  const claudeRoot = join(userRoot, ".claude");
  const settingsFile = join(claudeRoot, "settings.json");
  const defaults = jsonFile(join(repoRoot, "claude", "settings.json"));
  const local = existsSync(settingsFile) ? jsonFile(settingsFile) : {};
  const merged = mergeSettings(local, defaults);
  const plans = [];
  let unchanged = 0;

  function plan(file, bytes, root) {
    validateParents(file, root);
    const info = stat(file);
    if (info && readFileSync(file).equals(bytes)) { unchanged++; return; }
    if (info?.isSymbolicLink()) throw new Error(`Refusing to replace a changed file link: ${file}`);
    if (info && !info.isFile()) throw new Error(`Expected a regular file: ${file}`);
    plans.push({ file, bytes, previous: info ? readFileSync(file) : null });
  }

  const instructions = readFileSync(join(repoRoot, "agents", "AGENTS.md"));
  plan(join(claudeRoot, "AGENTS.md"), instructions, userRoot);
  plan(join(codexRoot, "AGENTS.md"), instructions, codexRoot);
  plan(join(claudeRoot, "CLAUDE.md"), readFileSync(join(repoRoot, "claude", "CLAUDE.md")), userRoot);
  // Preserve whitespace too when the installed settings already mean the same thing.
  if (JSON.stringify(local) !== JSON.stringify(merged)) {
    plan(settingsFile, Buffer.from(`${JSON.stringify(merged, null, 2)}\n`), userRoot);
  } else unchanged++;

  for (const kind of ["hooks", "commands"]) {
    const source = join(repoRoot, "claude", kind);
    const target = join(claudeRoot, kind);
    if (samePath(source, target)) { unchanged++; continue; }
    for (const file of sourceFiles(source)) plan(join(target, relative(source, file)), readFileSync(file), userRoot);
  }

  // Resolve plugin paths in Python so Windows hooks work in PowerShell and cmd.
  // Repair only known Databricks commands and our previous cmd-only overrides.
  const repairedHooks = [];
  if (platform === "win32") {
    const plugin = join(codexRoot, "plugins", "cache", "databricks-agent-skills", "databricks");
    validateParents(join(plugin, "hooks.json"), codexRoot);
    const versions = existsSync(plugin) ? readdirSync(plugin, { withFileTypes: true }) : [];
    const scripts = ["databricks-router.py", "databricks-context.py", "databricks-auth-helper.py"];
    for (const version of versions.filter((entry) => entry.isDirectory())) {
      const file = join(plugin, version.name, "hooks", "hooks.json");
      validateParents(file, codexRoot);
      if (!existsSync(file)) continue;
      const value = jsonFile(file);
      let modified = false;
      for (const groups of Object.values(value.hooks ?? {})) {
        if (!Array.isArray(groups)) continue;
        for (const group of groups) {
          for (const hook of group.hooks ?? []) {
            if (hook.type !== "command" || Object.hasOwn(hook, "command_windows")) continue;
            const script = scripts.find((name) => {
              const path = `"\${PLUGIN_ROOT:-\${CLAUDE_PLUGIN_ROOT}}/hooks/${name}"`;
              return hook.command === `python3 ${path} || python ${path} || true`;
            });
            if (!script) continue;
            const previousOverride = `python "%PLUGIN_ROOT%/hooks/${script}"`;
            if (Object.hasOwn(hook, "commandWindows") && hook.commandWindows !== previousOverride) continue;
            hook.commandWindows = `python -c "import os, runpy; runpy.run_path(os.path.join(os.environ['PLUGIN_ROOT'], 'hooks', '${script}'), run_name='__main__')"`;
            modified = true;
          }
        }
      }
      if (modified) {
        const newline = readFileSync(file, "utf8").includes("\r\n") ? "\r\n" : "\n";
        plan(file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`.replace(/\n/g, newline)), codexRoot);
        repairedHooks.push(file);
      }
    }
  }

  const backups = [];
  const changed = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const [index, { file, bytes, previous }] of plans.entries()) {
    mkdirSync(dirname(file), { recursive: true });
    if (previous !== null) {
      const backup = `${file}.backup-${stamp}-${process.pid}-${index}`;
      writeFileSync(backup, previous, { flag: "wx", mode: 0o600 });
      backups.push(backup);
    }
    const temporary = `${file}.tmp-${process.pid}-${index}`;
    writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
    renameSync(temporary, file);
    changed.push(file);
  }
  return { changed, backups, unchanged, repairedHooks };
}

function main(argv) {
  const options = {};
  const flags = { "--repo": "repo", "--home": "home", "--codex-home": "codexHome" };
  for (let index = 0; index < argv.length; index += 2) {
    const key = flags[argv[index]];
    const value = argv[index + 1];
    if (!key || !value || value.startsWith("--") || options[key]) {
      throw new Error("Usage: node scripts/sync-agent-config.mjs --repo <path> --home <path> [--codex-home <path>]");
    }
    options[key] = value;
  }
  if (!options.repo || !options.home) throw new Error("Both --repo and --home are required");
  const result = syncAgentConfig(options);
  console.log(`Agent configuration: ${result.changed.length} files updated, ${result.backups.length} backups, ${result.unchanged} unchanged.`);
  if (result.repairedHooks.length) console.log("Updated Databricks Windows hooks. Open /hooks in Codex to review and trust the changed commands.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Agent configuration sync failed: ${error.message}`); process.exitCode = 1; }
}
