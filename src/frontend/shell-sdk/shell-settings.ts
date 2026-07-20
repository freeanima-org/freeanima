import type { ShellClientConfig } from "./shell-client-config.ts";
import { parseShellClientConfig } from "./shell-client-config.ts";
import {
  DEFAULT_SHELL_DEBUG,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "./shell-debug-config.ts";

export type ShellSettings = {
  habitat: ShellClientConfig | null;
  debug: ShellDebugConfig;
};

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  habitat: null,
  debug: { ...DEFAULT_SHELL_DEBUG },
};

export function parseShellSettings(raw: unknown): ShellSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SHELL_SETTINGS };
  const obj = raw as Record<string, unknown>;
  // 兼容旧 JSON 键 hub
  const habitat = parseShellClientConfig(obj.habitat ?? obj.hub);
  const debug = parseShellDebugConfig(obj.debug);
  return { habitat, debug };
}

export function mergeShellSettings(
  current: ShellSettings,
  patch: Partial<ShellSettings>,
): ShellSettings {
  return {
    habitat: patch.habitat !== undefined ? patch.habitat : current.habitat,
    debug: patch.debug !== undefined ? patch.debug : current.debug,
  };
}
