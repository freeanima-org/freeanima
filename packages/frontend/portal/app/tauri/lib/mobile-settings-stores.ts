import { notifyDebugConfigChanged } from "@freeanima/client/app-frame/spa/debug-config-events.ts";
import {
  createHabitatDebugSettingsStores,
  type HabitatDebugSettingsStores,
} from "../../shared/habitat-debug-settings-stores.ts";
import { createDesktopScopedBackend } from "./settings-ipc-backend.ts";
import { testScopedSettings } from "./settings-ipc-backend.ts";

export type MobileSettingsStores = HabitatDebugSettingsStores;

export function createMobileSettingsStores(): MobileSettingsStores {
  const backend = createDesktopScopedBackend();
  return createHabitatDebugSettingsStores({
    backend,
    testHabitat: async (value) => {
      await testScopedSettings({ kind: "kv", id: "habitat" }, value);
    },
    // token 同步在 bootstrap freeanimaScopedSettings.save → applyHabitatConfigToShell
    onHabitatSave: () => undefined,
    notifyDebugChanged: notifyDebugConfigChanged,
    notifyShellConfigChanged: () => {
      window.dispatchEvent(new CustomEvent("freeanima:shell-config-changed"));
    },
  });
}
