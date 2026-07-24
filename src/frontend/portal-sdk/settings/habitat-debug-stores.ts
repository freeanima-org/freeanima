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
import { DEBUG_SETTINGS_SCOPE, HABITAT_SETTINGS_SCOPE } from "./scopes.ts";
import {
  createScopedSettingsStore,
  type ScopedSettingsBackend,
  type SettingsStore,
} from "./settings-store.ts";

export function parseHabitatClientSettings(raw: unknown): ShellClientConfig {
  if (raw == null) return { habitatUrl: "", remoteAuthToken: "" };
  const parsed = parseShellClientConfig(raw);
  if (!parsed) return { habitatUrl: "", remoteAuthToken: "" };
  return parsed;
}

export function createHabitatSettingsStore(
  backend: ScopedSettingsBackend,
  opts?: {
    test?: (value: ShellClientConfig) => Promise<void>;
  },
): SettingsStore<ShellClientConfig> {
  return createScopedSettingsStore<ShellClientConfig>({
    scope: HABITAT_SETTINGS_SCOPE,
    backend,
    parseLoad: parseHabitatClientSettings,
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
