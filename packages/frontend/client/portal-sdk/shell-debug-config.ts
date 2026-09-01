import { isRecord } from "@freeanima/shared/util";

import { DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY } from "./settings/prefs-keys.ts";

export { DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY };

/**
 * 离线 Outbox Devtools 门禁：Vite DEV 始终可用；生产需 settings / localStorage flag。
 * 设置页开关写入 `DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY`。
 */
export function readOfflineOutboxDevtoolsFlag(
  getItem: (key: string) => string | null = (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
): boolean {
  return getItem(DEBUG_OFFLINE_OUTBOX_DEVTOOLS_KEY) === "1";
}

function detectViteDev(): boolean {
  if (typeof import.meta === "undefined") return false;
  const flag = import.meta.env?.DEV as unknown;
  return flag === true || flag === "true";
}

/** `import.meta.env.DEV` 或 localStorage flag。 */
export function isOfflineOutboxDevtoolsEnabled(opts?: {
  isDev?: boolean;
  getItem?: (key: string) => string | null;
}): boolean {
  if (opts?.isDev ?? detectViteDev()) return true;
  return readOfflineOutboxDevtoolsFlag(opts?.getItem);
}

export type ShellDebugConfig = {
  vConsoleEnabled: boolean;
  offlineOutboxDevtoolsEnabled: boolean;
};

export const DEFAULT_SHELL_DEBUG: ShellDebugConfig = {
  vConsoleEnabled: false,
  offlineOutboxDevtoolsEnabled: false,
};

export function parseShellDebugConfig(raw: unknown): ShellDebugConfig {
  if (!isRecord(raw)) return { ...DEFAULT_SHELL_DEBUG };
  return {
    vConsoleEnabled: raw.vConsoleEnabled === true,
    offlineOutboxDevtoolsEnabled: raw.offlineOutboxDevtoolsEnabled === true,
  };
}

export function normalizeShellDebugConfig(input: ShellDebugConfig): ShellDebugConfig {
  return {
    vConsoleEnabled: input.vConsoleEnabled === true,
    offlineOutboxDevtoolsEnabled: input.offlineOutboxDevtoolsEnabled === true,
  };
}
