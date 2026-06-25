import type { SettingsStorageScope } from "@freeanima/satellite-sdk/settings";
import type { ScopedSettingsBackend } from "@freeanima/satellite-sdk/settings";

type ScopedSettingsBridge = ScopedSettingsBackend & {
  test(scope: SettingsStorageScope, value: unknown): Promise<unknown>;
};

function getScopedSettingsBridge(): ScopedSettingsBridge {
  const api = window.freeanimaScopedSettings;
  if (!api) {
    throw new Error("freeanimaScopedSettings 不可用（需在 Electron preload 中注入）");
  }
  return api;
}

export function createDesktopScopedBackend(): ScopedSettingsBackend {
  const bridge = getScopedSettingsBridge();
  return {
    load: (scope) => bridge.load(scope),
    save: (scope, value) => bridge.save(scope, value),
  };
}

export async function testScopedSettings(
  scope: SettingsStorageScope,
  value: unknown,
): Promise<void> {
  await getScopedSettingsBridge().test(scope, value);
}

declare global {
  interface Window {
    freeanimaScopedSettings?: ScopedSettingsBridge;
  }
}
