import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { desktopSettingsPath, legacyShellClientConfigPath } from "./desktop-settings-paths.ts";
import { normalizeShellDebugConfig } from "./shell-debug-config.ts";
import {
  normalizeShellClientConfig,
  parseShellClientConfig,
  type ShellClientConfig,
} from "./shell-client-config.ts";
import {
  DEFAULT_SHELL_SETTINGS,
  mergeShellSettings,
  parseShellSettings,
  type ShellSettings,
} from "./shell-settings.ts";
import type { ShellDebugConfig } from "./shell-debug-config.ts";

export { desktopSettingsPath, getDesktopHomeDir } from "./desktop-settings-paths.ts";

function readLegacyHubConfig(): ShellClientConfig | null {
  const legacyPath = legacyShellClientConfigPath();
  if (!existsSync(legacyPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(legacyPath, "utf-8")) as unknown;
    return parseShellClientConfig(raw);
  } catch {
    return null;
  }
}

function writeSettingsFile(settings: ShellSettings, home?: string): void {
  const path = desktopSettingsPath(home);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}

export function loadShellSettings(desktopHome?: string): ShellSettings {
  const path = desktopSettingsPath(desktopHome);
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
      return parseShellSettings(raw);
    } catch {
      return { ...DEFAULT_SHELL_SETTINGS };
    }
  }

  const legacyHub = readLegacyHubConfig();
  if (legacyHub) {
    const migrated: ShellSettings = {
      hub: legacyHub,
      debug: { ...DEFAULT_SHELL_SETTINGS.debug },
    };
    writeSettingsFile(migrated, desktopHome);
    return migrated;
  }

  return { ...DEFAULT_SHELL_SETTINGS };
}

export function saveShellSettings(
  patch: Partial<ShellSettings>,
  desktopHome?: string,
): ShellSettings {
  const current = loadShellSettings(desktopHome);
  const next = mergeShellSettings(current, patch);
  writeSettingsFile(next, desktopHome);
  return next;
}

export function loadShellClientConfig(desktopHome?: string): ShellClientConfig | null {
  return loadShellSettings(desktopHome).hub;
}

export function saveShellClientConfig(config: ShellClientConfig, desktopHome?: string): void {
  saveShellSettings({ hub: normalizeShellClientConfig(config) }, desktopHome);
}

export function loadShellDebugConfig(desktopHome?: string): ShellDebugConfig {
  return loadShellSettings(desktopHome).debug;
}

export function saveShellDebugConfig(
  config: ShellDebugConfig,
  desktopHome?: string,
): ShellDebugConfig {
  const normalized = normalizeShellDebugConfig(config);
  saveShellSettings({ debug: normalized }, desktopHome);
  return normalized;
}
