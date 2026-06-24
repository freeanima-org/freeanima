import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  normalizeShellClientConfig,
  parseShellClientConfig,
  type ShellClientConfig,
} from "./shell-client-config.ts";

export { normalizeShellClientConfig, parseShellClientConfig };
export type { ShellClientConfig };

export function shellClientConfigPath(home = process.env.FREEANIMA_HOME): string {
  const root = home?.trim() || join(homedir(), ".anima");
  return join(root, "shell-client.json");
}

export function loadShellClientConfig(home?: string): ShellClientConfig | null {
  const path = shellClientConfigPath(home);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    return parseShellClientConfig(raw);
  } catch {
    return null;
  }
}

export function saveShellClientConfig(config: ShellClientConfig, home?: string): void {
  const path = shellClientConfigPath(home);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}
