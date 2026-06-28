import {
  normalizeShellClientConfig,
  parseShellClientConfig,
  type ShellClientConfig,
} from "../shell-client-config.ts";
import {
  DEFAULT_SHELL_DEBUG,
  normalizeShellDebugConfig,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "../shell-debug-config.ts";
import { DEBUG_SETTINGS_SCOPE, HUB_SETTINGS_SCOPE } from "./scopes.ts";
import {
  createScopedSettingsStore,
  type ScopedSettingsBackend,
  type SettingsStore,
} from "./settings-store.ts";

export function parseHubClientSettings(raw: unknown): ShellClientConfig {
  if (raw == null) return { hubUrl: "", remoteAuthToken: "" };
  const parsed = parseShellClientConfig(raw);
  if (!parsed) return { hubUrl: "", remoteAuthToken: "" };
  return parsed;
}

export function createHubSettingsStore(
  backend: ScopedSettingsBackend,
  opts?: {
    test?: (value: ShellClientConfig) => Promise<void>;
  },
): SettingsStore<ShellClientConfig> {
  return createScopedSettingsStore<ShellClientConfig>({
    scope: HUB_SETTINGS_SCOPE,
    backend,
    parseLoad: parseHubClientSettings,
    normalizeSave: normalizeShellClientConfig,
    ...(opts?.test ? { test: opts.test } : {}),
  });
}

export function createDebugSettingsStore(
  backend: ScopedSettingsBackend,
): SettingsStore<ShellDebugConfig> {
  return createScopedSettingsStore<ShellDebugConfig>({
    scope: DEBUG_SETTINGS_SCOPE,
    backend,
    parseLoad(raw) {
      return parseShellDebugConfig(raw ?? DEFAULT_SHELL_DEBUG);
    },
    normalizeSave: normalizeShellDebugConfig,
  });
}
