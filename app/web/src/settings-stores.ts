import {
  createDebugSettingsStore,
  createHubSettingsStore,
  HUB_SETTINGS_SCOPE,
  type SettingsStore,
} from "@freeanima/shell-sdk/settings";
import type { ShellClientConfig } from "@freeanima/shell-sdk/shell-client-config";
import type { ShellDebugConfig } from "@freeanima/shell-sdk/shell-debug-config";
import { normalizeShellClientConfig } from "@freeanima/shell-sdk/shell-client-config";
import { sendSentryTestEvent } from "@freeanima/shell-ui/sentry-test";

import { createWebScopedBackend } from "./settings-local-backend.ts";
import {
  installWebShellFromPrefs,
  SHELL_CONFIG_CHANGED_EVENT,
  testWebHubConnection,
} from "./web-shell.ts";

export type WebSettingsStores = {
  hub: SettingsStore<ShellClientConfig>;
  debug: SettingsStore<ShellDebugConfig>;
};

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

export function createWebSettingsStores(): WebSettingsStores {
  const backend = createWebScopedBackend();
  const hubBase = createHubSettingsStore(backend, {
    async test(value) {
      await testWebHubConnection(value.hubUrl, value.remoteAuthToken);
    },
  });
  const hub: SettingsStore<ShellClientConfig> = {
    scope: hubBase.scope,
    load: () => hubBase.load(),
    test: (value) => hubBase.test!(value),
    async save(value) {
      const normalized = normalizeShellClientConfig(value);
      await backend.save(HUB_SETTINGS_SCOPE, normalized);
      installWebShellFromPrefs(normalized.hubUrl, normalized.remoteAuthToken);
      notifyShellConfigChanged();
    },
  };
  const debugBase = createDebugSettingsStore(backend);
  const debug: SettingsStore<ShellDebugConfig> = {
    scope: debugBase.scope,
    load: () => debugBase.load(),
    async save(value) {
      await debugBase.save(value);
    },
    async test(value) {
      await debugBase.save(value);
      await sendSentryTestEvent();
    },
  };
  return { hub, debug };
}
