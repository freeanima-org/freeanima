import {
  createHabitatDebugSettingsStores,
  type HabitatDebugSettingsStores,
} from "../../shared/habitat-debug-settings-stores.ts";
import { buildMobileShell, SHELL_CONFIG_CHANGED_EVENT } from "./mobile-shell.ts";
import {
  createMobileScopedBackend,
  testMobileHabitatConnection,
} from "./settings-prefs-backend.ts";
import { DEBUG_CONFIG_CHANGED_EVENT } from "./debug-events.ts";

export type MobileSettingsStores = HabitatDebugSettingsStores;

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

function notifyDebugConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(DEBUG_CONFIG_CHANGED_EVENT));
}

export function createMobileSettingsStores(): MobileSettingsStores {
  const backend = createMobileScopedBackend();
  return createHabitatDebugSettingsStores({
    backend,
    testHabitat: testMobileHabitatConnection,
    async onHabitatSave(normalized) {
      window.satelliteShell = await buildMobileShell(
        normalized.habitatUrl,
        normalized.remoteAuthToken,
      );
    },
    notifyDebugChanged: notifyDebugConfigChanged,
    notifyShellConfigChanged,
  });
}
