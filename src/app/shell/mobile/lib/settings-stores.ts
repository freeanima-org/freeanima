import {
  createHubDebugSettingsStores,
  type HubDebugSettingsStores,
} from "../../shared/hub-debug-settings-stores.ts";
import { buildMobileShell, SHELL_CONFIG_CHANGED_EVENT } from "./mobile-shell.ts";
import { createMobileScopedBackend, testMobileHubConnection } from "./settings-prefs-backend.ts";
import { DEBUG_CONFIG_CHANGED_EVENT } from "./debug-events.ts";

export type MobileSettingsStores = HubDebugSettingsStores;

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

function notifyDebugConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(DEBUG_CONFIG_CHANGED_EVENT));
}

export function createMobileSettingsStores(): MobileSettingsStores {
  const backend = createMobileScopedBackend();
  return createHubDebugSettingsStores({
    backend,
    testHub: testMobileHubConnection,
    async onHubSave(normalized) {
      window.satelliteShell = await buildMobileShell(normalized.hubUrl, normalized.remoteAuthToken);
    },
    notifyDebugChanged: notifyDebugConfigChanged,
    notifyShellConfigChanged,
  });
}
