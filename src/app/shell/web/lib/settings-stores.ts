import {
  createHubDebugSettingsStores,
  type HubDebugSettingsStores,
} from "../../shared/hub-debug-settings-stores.ts";
import { createWebScopedBackend } from "./settings-local-backend.ts";
import {
  installWebShellFromPrefs,
  SHELL_CONFIG_CHANGED_EVENT,
  testWebHubConnection,
} from "./web-shell.ts";
import { notifyDebugConfigChanged } from "@freeanima/frontend/shell-ui/spa/debug-config-events.ts";

export type WebSettingsStores = HubDebugSettingsStores;

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

export function createWebSettingsStores(): WebSettingsStores {
  const backend = createWebScopedBackend();
  return createHubDebugSettingsStores({
    backend,
    testHub: async (value) => {
      await testWebHubConnection(value.hubUrl, value.remoteAuthToken);
    },
    onHubSave(normalized) {
      installWebShellFromPrefs(normalized.hubUrl, normalized.remoteAuthToken);
    },
    notifyDebugChanged: notifyDebugConfigChanged,
    notifyShellConfigChanged,
  });
}
