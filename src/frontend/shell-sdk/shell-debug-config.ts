export type ShellDebugConfig = {
  vConsoleEnabled: boolean;
};

export const DEFAULT_SHELL_DEBUG: ShellDebugConfig = {
  vConsoleEnabled: false,
};

export function parseShellDebugConfig(raw: unknown): ShellDebugConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SHELL_DEBUG };
  const obj = raw as Record<string, unknown>;
  return {
    vConsoleEnabled: obj.vConsoleEnabled === true,
  };
}

export function normalizeShellDebugConfig(input: ShellDebugConfig): ShellDebugConfig {
  return {
    vConsoleEnabled: input.vConsoleEnabled,
  };
}
