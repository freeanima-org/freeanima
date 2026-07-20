import { getRepoRoot } from "@freeanima/core/config/repo-root";
import type { SatelliteEntryConfig } from "@freeanima/core/config";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MONOREPO_PACKAGE_NAME = "freeanima";
const CLI_PACKAGE_NAME = "@freeanima/cli";

export type InstallContext = {
  monorepoRoot: string | null;
  cliRoot: string;
};

export type SatelliteLaunch = {
  command: string;
  args: string[];
  workingDirectory: string;
  environment: Record<string, string>;
  execStart: string;
};

function packageNameAt(dir: string): string | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    const pkg = JSON.parse(readFileSync(path, "utf8")) as { name?: string };
    return typeof pkg.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
}

function findPackageRoot(startDir: string, packageName: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 16; i++) {
    if (packageNameAt(dir) === packageName) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Monorepo root (freeanima) and CLI package root for satellite WorkingDirectory. */
export function getInstallContext(): InstallContext {
  const start = dirname(fileURLToPath(import.meta.url));
  const monorepoRoot = findPackageRoot(start, MONOREPO_PACKAGE_NAME);
  const cliRoot = findPackageRoot(start, CLI_PACKAGE_NAME) ?? getRepoRoot();
  return { monorepoRoot, cliRoot };
}

function shellQuote(arg: string): string {
  if (!/[\s"'\\]/.test(arg)) return arg;
  return `"${arg.replace(/(["\\])/g, "\\$1")}"`;
}

/** systemd ExecStart line from command + args. */
export function formatExecStart(command: string, args: string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

export function resolveSatelliteLaunch(
  entry: SatelliteEntryConfig,
  opts?: { habitatUrl?: string; install?: InstallContext },
): SatelliteLaunch {
  const command = entry.command?.trim();
  if (!command) {
    throw new Error("satellite entry requires command for managed launch");
  }

  const install = opts?.install ?? getInstallContext();
  const workingDirectory = install.monorepoRoot ?? install.cliRoot;
  const habitatUrl = opts?.habitatUrl ?? process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
  const args = entry.args ?? [];

  const environment: Record<string, string> = {
    FREEANIMA_URL: habitatUrl,
    FREEANIMA_REPO_ROOT: workingDirectory,
    ...entry.env,
  };

  return {
    command,
    args,
    workingDirectory,
    environment,
    execStart: formatExecStart(command, args),
  };
}
