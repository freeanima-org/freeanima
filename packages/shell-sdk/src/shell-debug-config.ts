export type ShellDebugConfig = {
  sentryEnabled: boolean;
  sentryDsn: string;
  vConsoleEnabled: boolean;
};

export const DEFAULT_SHELL_DEBUG: ShellDebugConfig = {
  sentryEnabled: false,
  sentryDsn: "",
  vConsoleEnabled: false,
};

export function parseShellDebugConfig(raw: unknown): ShellDebugConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SHELL_DEBUG };
  const obj = raw as Record<string, unknown>;
  return {
    sentryEnabled: obj.sentryEnabled === true,
    sentryDsn: typeof obj.sentryDsn === "string" ? obj.sentryDsn.trim() : "",
    vConsoleEnabled: obj.vConsoleEnabled === true,
  };
}

export function normalizeShellDebugConfig(input: ShellDebugConfig): ShellDebugConfig {
  const sentryDsn = input.sentryDsn.trim();
  if (input.sentryEnabled && !sentryDsn) {
    throw new Error("启用 Sentry 时 DSN 不能为空");
  }
  if (sentryDsn && !/^https?:\/\//i.test(sentryDsn)) {
    throw new Error("Sentry DSN 须以 http:// 或 https:// 开头");
  }
  return {
    sentryEnabled: input.sentryEnabled,
    sentryDsn,
    vConsoleEnabled: input.vConsoleEnabled,
  };
}
