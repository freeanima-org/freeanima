import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** 仅两种运行形态：源码 / bun --compile standalone */
export type CliInstallKind = "source" | "standalone";

/** bun build --compile 把入口挂在虚拟 FS `/$bunfs/root/…`（Bun 1.3.x 尚无 isStandaloneExecutable）。 */
export function isStandaloneExecutable(argv1 = process.argv[1]): boolean {
  return typeof argv1 === "string" && argv1.startsWith("/$bunfs/");
}

export const CLI_UPGRADE_HINT_SOURCE =
  "源码安装不支持自动 upgrade。请手动执行：git pull、bun install，然后重启服务（anima service restart）。";

export const CLI_UPGRADE_HINT_STANDALONE =
  "standalone 可执行文件不支持自动 upgrade。请下载新版 Release 产物（或重新 bun run build:cli:executable），覆盖安装前缀后重启服务。";

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

/** source | standalone */
export function getCliInstallKind(scriptPath?: string): CliInstallKind {
  if (!scriptPath && isStandaloneExecutable()) return "standalone";
  if (scriptPath && isStandaloneExecutable(scriptPath)) return "standalone";
  const resolved = resolveAnimaScriptPath(scriptPath);
  if (resolved.endsWith("/src/app/cli/cli.ts")) return "source";
  // symlink → cli.ts 等仍算源码；standalone 由 bunfs argv 识别
  return "source";
}

export function formatCliVersion(version: string, scriptPath?: string): string {
  const kind = getCliInstallKind(scriptPath);
  if (kind === "standalone") return `${version} (standalone)`;
  return `${version} (local)`;
}

/** Executable path for systemd ExecStart (shebang script or bun + cli.ts) */
export function animaBinString(scriptPath?: string): string {
  if (
    (!scriptPath && isStandaloneExecutable()) ||
    (scriptPath && isStandaloneExecutable(scriptPath))
  ) {
    return process.execPath;
  }
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
