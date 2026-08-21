import { isRecord } from "@freeanima/shared/util";

export type ShellDebugConfig = {
  vConsoleEnabled: boolean;
};

export const DEFAULT_SHELL_DEBUG: ShellDebugConfig = {
  vConsoleEnabled: false,
};

export function parseShellDebugConfig(raw: unknown): ShellDebugConfig {
  if (!isRecord(raw)) return { ...DEFAULT_SHELL_DEBUG };
  return {
    vConsoleEnabled: raw.vConsoleEnabled === true,
  };
}

export function normalizeShellDebugConfig(input: ShellDebugConfig): ShellDebugConfig {
  return {
    vConsoleEnabled: input.vConsoleEnabled,
  };
}
