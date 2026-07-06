import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export type CliInstallKind = "source" | "npm-registry" | "npm-local" | "docker";

const NPM_CLI_MARKER = "node_modules/@freeanima/cli/";

export const CLI_UPGRADE_HINT_SOURCE =
  "源码 link 安装不支持自动 upgrade。请手动执行：git pull、bun install，然后重启服务（anima service restart）。";

export const CLI_UPGRADE_HINT_DOCKER =
  "Docker 部署请在宿主机执行：docker compose pull && docker compose up -d";

export const CLI_UPGRADE_HINT_NPM_LOCAL_NO_REPO =
  "无法定位 freeanima 仓库根目录。请在有 git clone 的目录手动执行：git pull、bun run install:cli:local，然后重启服务。";

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

export function isDockerInstall(): boolean {
  return existsSync("/.dockerenv");
}

export function bunGlobalPackageJsonPath(): string {
  const bunInstall = process.env.BUN_INSTALL ?? join(homedir(), ".bun");
  return join(bunInstall, "install/global/package.json");
}

/** Bun 全局安装清单中 @freeanima/cli 的依赖 spec（用于区分 registry vs 本地 pack）。 */
export function readBunGlobalCliDependencySpec(): string | null {
  const path = bunGlobalPackageJsonPath();
  if (!existsSync(path)) return null;
  try {
    const pkg = JSON.parse(readFileSync(path, "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    const spec = pkg.dependencies?.["@freeanima/cli"];
    return typeof spec === "string" ? spec : null;
  } catch {
    return null;
  }
}

export function isLocalPackDependencySpec(spec: string): boolean {
  return (
    spec.includes(".tgz") ||
    spec.startsWith("file:") ||
    spec.startsWith("/") ||
    spec.startsWith("./") ||
    spec.startsWith("../")
  );
}

/** source / npm-local / npm-registry / docker */
export function getCliInstallKind(scriptPath?: string): CliInstallKind {
  if (isDockerInstall()) return "docker";
  const resolved = resolveAnimaScriptPath(scriptPath);
  if (resolved.endsWith("/src/app/cli/cli.ts")) return "source";
  if (resolved.includes(NPM_CLI_MARKER)) {
    const spec = readBunGlobalCliDependencySpec();
    if (spec && isLocalPackDependencySpec(spec)) return "npm-local";
    return "npm-registry";
  }
  return "source";
}

export function formatCliVersion(version: string, scriptPath?: string): string {
  const kind = getCliInstallKind(scriptPath);
  if (kind === "source") return `${version} (local)`;
  if (kind === "npm-local") return `${version} (local-pack)`;
  if (kind === "docker") return `${version} (docker)`;
  return version;
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
