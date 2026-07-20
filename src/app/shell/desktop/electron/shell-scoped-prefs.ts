import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

import Store from "electron-store";

import {
  DEBUG_VCONSOLE_ENABLED_KEY,
  HABITAT_URL_KEY,
  HABITAT_URL_KEY_LEGACY,
  LAUNCH_AT_LOGIN_KEY,
  COMPANION_VISIBLE_KEY,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/frontend/shell-sdk/settings";
import {
  normalizeShellDebugConfig,
  parseShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/frontend/shell-sdk/shell-debug-config.ts";
import {
  parseShellClientConfig,
  type ShellClientConfig,
} from "@freeanima/frontend/shell-sdk/shell-client-config.ts";
import {
  desktopSettingsPath,
  legacyShellClientConfigPath,
} from "@freeanima/frontend/shell-sdk/desktop-settings-paths";
import { parseShellSettings } from "@freeanima/frontend/shell-sdk/shell-settings";

import { dirname, join } from "node:path";

type ScopedStore = Store<Record<string, string>>;

let store: ScopedStore | null = null;

function getStore(): ScopedStore {
  if (!store) {
    store = new Store<Record<string, string>>({ name: "freeanima-shell" });
    migrateLegacySettings(store);
  }
  return store;
}

function migrateLegacySettings(kv: ScopedStore): void {
  if (kv.get(HABITAT_URL_KEY)) return;
  const legacyUrl = kv.get(HABITAT_URL_KEY_LEGACY)?.trim();
  if (legacyUrl) {
    kv.set(HABITAT_URL_KEY, legacyUrl);
    return;
  }

  const legacyPath = desktopSettingsPath();
  if (existsSync(legacyPath)) {
    try {
      const raw = JSON.parse(readFileSync(legacyPath, "utf-8")) as unknown;
      const parsed = parseShellSettings(raw);
      applyHabitatToStore(kv, parsed.habitat);
      applyDebugToStore(kv, parsed.debug);
      renameSync(legacyPath, `${legacyPath}.migrated`);
      return;
    } catch {
      /* fall through */
    }
  }

  const legacyHubPath = legacyShellClientConfigPath();
  if (existsSync(legacyHubPath)) {
    try {
      const raw = JSON.parse(readFileSync(legacyHubPath, "utf-8")) as unknown;
      const habitat = parseShellClientConfig(raw);
      applyHabitatToStore(kv, habitat);
      renameSync(legacyHubPath, `${legacyHubPath}.migrated`);
    } catch {
      /* ignore */
    }
  }
}

function applyHabitatToStore(kv: ScopedStore, habitat: ShellClientConfig | null): void {
  if (!habitat) return;
  kv.set(HABITAT_URL_KEY, habitat.habitatUrl);
  kv.set(REMOTE_AUTH_TOKEN_KEY, habitat.remoteAuthToken);
}

function applyDebugToStore(kv: ScopedStore, debug: ShellDebugConfig): void {
  kv.set(DEBUG_VCONSOLE_ENABLED_KEY, debug.vConsoleEnabled ? "1" : "0");
}

export function loadHabitatConfigFromStore(): ShellClientConfig | null {
  const kv = getStore();
  const habitatUrl =
    kv.get(HABITAT_URL_KEY)?.trim() || kv.get(HABITAT_URL_KEY_LEGACY)?.trim() || "";
  const remoteAuthToken = kv.get(REMOTE_AUTH_TOKEN_KEY)?.trim() ?? "";
  if (!habitatUrl && !remoteAuthToken) return null;
  return parseShellClientConfig({ habitatUrl, remoteAuthToken });
}

export function saveHabitatConfigToStore(config: ShellClientConfig): ShellClientConfig {
  const normalized = parseShellClientConfig(config);
  if (!normalized) throw new Error("栖息地配置无效");
  const kv = getStore();
  kv.set(HABITAT_URL_KEY, normalized.habitatUrl);
  kv.set(REMOTE_AUTH_TOKEN_KEY, normalized.remoteAuthToken);
  return normalized;
}

export function loadDebugConfigFromStore(): ShellDebugConfig {
  const kv = getStore();
  return parseShellDebugConfig({
    vConsoleEnabled: kv.get(DEBUG_VCONSOLE_ENABLED_KEY) === "1",
  });
}

export function saveDebugConfigToStore(config: ShellDebugConfig): ShellDebugConfig {
  const normalized = normalizeShellDebugConfig(config);
  const kv = getStore();
  kv.set(DEBUG_VCONSOLE_ENABLED_KEY, normalized.vConsoleEnabled ? "1" : "0");
  return normalized;
}

export function readLaunchAtLoginFromStore(): boolean {
  return getStore().get(LAUNCH_AT_LOGIN_KEY) === "1";
}

export function saveLaunchAtLoginToStore(enabled: boolean): void {
  getStore().set(LAUNCH_AT_LOGIN_KEY, enabled ? "1" : "0");
}

export function readCompanionVisibleFromStore(): boolean {
  const raw = getStore().get(COMPANION_VISIBLE_KEY);
  return raw !== "0";
}

export function saveCompanionVisibleToStore(visible: boolean): void {
  getStore().set(COMPANION_VISIBLE_KEY, visible ? "1" : "0");
}

export function companionConfigPath(): string {
  const animaHome = process.env.FREEANIMA_HOME?.trim() || join(homedir(), ".anima");
  return join(animaHome, "companion", "config.json");
}

export function loadCompanionConfigFromFile(): unknown {
  const path = companionConfigPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as unknown;
  } catch {
    return null;
  }
}

export function saveCompanionConfigToFile(value: unknown): void {
  const path = companionConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}
