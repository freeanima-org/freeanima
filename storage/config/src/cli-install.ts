import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";

export type CliInstallKind = "npm" | "local";

const NPM_CLI_MARKER = "node_modules/@freeanima/cli/";

/** Resolved anima entry script path (realpath). */
export function resolveAnimaScriptPath(scriptPath?: string): string {
  if (scriptPath) {
    return realpathSync(scriptPath);
  }

  const script = process.argv[1];
  if (script?.endsWith("cli.js") || script?.endsWith("cli.ts")) {
    return realpathSync(script);
  }

  try {
    const r = spawnSync("sh", ["-c", "command -v anima"], { encoding: "utf-8" });
    const found = r.stdout?.trim();
    if (r.status === 0 && found) return realpathSync(found);
  } catch {
    /* ignore */
  }

  return script ? realpathSync(script) : "anima";
}

/** npm global install vs monorepo / link:global / npm link source */
export function getCliInstallKind(scriptPath?: string): CliInstallKind {
  const resolved = resolveAnimaScriptPath(scriptPath);
  if (resolved.endsWith("/cli/src/cli.ts")) return "local";
  if (resolved.includes(NPM_CLI_MARKER)) return "npm";
  return "local";
}

export function formatCliVersion(version: string, scriptPath?: string): string {
  return getCliInstallKind(scriptPath) === "local" ? `${version} (local)` : version;
}

/** Executable path for systemd ExecStart (shebang script or bun + cli.js) */
export function animaBinString(scriptPath?: string): string {
  const script = scriptPath ?? process.argv[1];
  if (script?.endsWith("cli.js") || script?.endsWith("cli.ts")) {
    return `${process.execPath} ${realpathSync(script)}`;
  }

  try {
    const r = spawnSync("sh", ["-c", "command -v anima"], { encoding: "utf-8" });
    const found = r.stdout?.trim();
    if (r.status === 0 && found) return found;
  } catch {
    /* ignore */
  }

  return script ? realpathSync(script) : "anima";
}

/** Resolve animaBinString() to spawn(command, args) form */
export function resolveAnimaExecutable(
  extraArgs: string[] = [],
  scriptPath?: string,
): { command: string; args: string[] } {
  const bin = animaBinString(scriptPath);
  if (bin.includes(" ")) {
    const space = bin.indexOf(" ");
    return {
      command: bin.slice(0, space),
      args: [bin.slice(space + 1), ...extraArgs],
    };
  }
  return { command: bin, args: extraArgs };
}
