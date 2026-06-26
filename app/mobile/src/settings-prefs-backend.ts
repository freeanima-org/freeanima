import type { SettingsStorageScope } from "@freeanima/satellite-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/satellite-sdk/settings";
import {
  DEBUG_SENTRY_DSN_KEY,
  DEBUG_SENTRY_ENABLED_KEY,
  DEBUG_VCONSOLE_ENABLED_KEY,
  HUB_URL_KEY,
  REMOTE_AUTH_TOKEN_KEY,
} from "@freeanima/satellite-sdk/settings";
import { parseShellDebugConfig, type ShellDebugConfig } from "@freeanima/satellite-sdk";

import { applyMobileDebugConsole } from "./debug-console.ts";
import { prefsGet, prefsSet } from "./prefs-safe.ts";

async function loadKvScope(scope: SettingsStorageScope): Promise<unknown> {
  if (scope.kind !== "kv") throw new Error("mobile 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "hub") {
    const [hubUrl, remoteAuthToken] = await Promise.all([
      prefsGet({ key: HUB_URL_KEY }),
      prefsGet({ key: REMOTE_AUTH_TOKEN_KEY }),
    ]);
    if (!hubUrl.value && !remoteAuthToken.value) return null;
    return { hubUrl: hubUrl.value ?? "", remoteAuthToken: remoteAuthToken.value ?? "" };
  }
  if (scope.id === "debug") {
    const [enabled, dsn, vConsole] = await Promise.all([
      prefsGet({ key: DEBUG_SENTRY_ENABLED_KEY }),
      prefsGet({ key: DEBUG_SENTRY_DSN_KEY }),
      prefsGet({ key: DEBUG_VCONSOLE_ENABLED_KEY }),
    ]);
    return parseShellDebugConfig({
      sentryEnabled: enabled.value === "1",
      sentryDsn: dsn.value ?? "",
      vConsoleEnabled: vConsole.value === "1",
    });
  }
  throw new Error(`未知 kv scope: ${scopeId}`);
}

async function saveKvScope(scope: SettingsStorageScope, value: unknown): Promise<void> {
  if (scope.kind !== "kv") throw new Error("mobile 仅支持 kv scope");
  const scopeId = scope.id;
  if (scopeId === "hub") {
    const raw = value as { hubUrl: string; remoteAuthToken: string };
    await prefsSet({ key: HUB_URL_KEY, value: raw.hubUrl });
    await prefsSet({ key: REMOTE_AUTH_TOKEN_KEY, value: raw.remoteAuthToken });
    return;
  }
  if (scope.id === "debug") {
    const cfg = value as ShellDebugConfig;
    await prefsSet({
      key: DEBUG_SENTRY_ENABLED_KEY,
      value: cfg.sentryEnabled ? "1" : "0",
    });
    await prefsSet({ key: DEBUG_SENTRY_DSN_KEY, value: cfg.sentryDsn });
    await prefsSet({
      key: DEBUG_VCONSOLE_ENABLED_KEY,
      value: cfg.vConsoleEnabled ? "1" : "0",
    });
    await applyMobileDebugConsole(cfg.vConsoleEnabled);
    return;
  }
  throw new Error(`未知 kv scope: ${scopeId}`);
}

export function createMobileScopedBackend(): ScopedSettingsBackend {
  return {
    load: loadKvScope,
    save: saveKvScope,
  };
}

export async function testMobileHubConnection(value: {
  hubUrl: string;
  remoteAuthToken: string;
}): Promise<void> {
  const { testHubConnection } = await import("./mobile-shell.ts");
  await testHubConnection(value.hubUrl, value.remoteAuthToken);
}
