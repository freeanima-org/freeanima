import type { ShellClientConfig } from "./shell-client-config.ts";
import { parseShellClientConfig } from "./shell-client-config.ts";
import {
  DEFAULT_SHELL_DEBUG,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "./shell-debug-config.ts";

export type ShellSettings = {
  hub: ShellClientConfig | null;
  debug: ShellDebugConfig;
};

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  hub: null,
  debug: { ...DEFAULT_SHELL_DEBUG },
};

export function parseShellSettings(raw: unknown): ShellSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SHELL_SETTINGS };
  const obj = raw as Record<string, unknown>;
  const hub = parseShellClientConfig(obj.hub);
  const debug = parseShellDebugConfig(obj.debug);
  return { hub, debug };
}

export function mergeShellSettings(
  current: ShellSettings,
  patch: Partial<ShellSettings>,
): ShellSettings {
  return {
    hub: patch.hub !== undefined ? patch.hub : current.hub,
    debug: patch.debug !== undefined ? patch.debug : current.debug,
  };
}
