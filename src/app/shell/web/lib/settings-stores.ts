import {
  createHabitatDebugSettingsStores,
  type HabitatDebugSettingsStores,
} from "../../shared/habitat-debug-settings-stores.ts";
import { createWebScopedBackend } from "./settings-local-backend.ts";
import {
  installWebShellFromPrefs,
  SHELL_CONFIG_CHANGED_EVENT,
  testWebHabitatConnection,
} from "./web-shell.ts";
import { notifyDebugConfigChanged } from "@freeanima/frontend/app-ui/spa/debug-config-events.ts";

export type WebSettingsStores = HabitatDebugSettingsStores;

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

export function createWebSettingsStores(): WebSettingsStores {
  const backend = createWebScopedBackend();
  return createHabitatDebugSettingsStores({
    backend,
    testHabitat: async (value) => {
      await testWebHabitatConnection(value.habitatUrl, value.remoteAuthToken);
    },
    onHabitatSave(normalized) {
      installWebShellFromPrefs(normalized.habitatUrl, normalized.remoteAuthToken);
    },
    notifyDebugChanged: notifyDebugConfigChanged,
    notifyShellConfigChanged,
  });
}
