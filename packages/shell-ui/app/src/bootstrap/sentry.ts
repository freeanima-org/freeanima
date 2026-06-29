import {
  DEFAULT_SHELL_DEBUG,
  type ShellDebugConfig,
} from "@freeanima/shell-sdk/shell-debug-config";
import type { SettingsBinding } from "@freeanima/shell-sdk/settings";

import { findDebugStore } from "../shell-app-context.tsx";

export const DEBUG_CONFIG_CHANGED_EVENT = "freeanima:debug-config-changed";

export function notifyDebugConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(DEBUG_CONFIG_CHANGED_EVENT));
}

import * as Sentry from "@sentry/react";

let sentryInitialized = false;

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request?.headers) {
    const headers = event.request.headers as Record<string, string>;
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "authorization") {
        headers[key] = "[Filtered]";
      }
    }
  }
  if (typeof event.message === "string") {
    event.message = event.message.replace(/Bearer\s+\S+/gi, "Bearer [Filtered]");
  }
  return event;
}

function applySentryConfig(config: ShellDebugConfig): void {
  if (sentryInitialized) {
    void Sentry.close(2000);
    sentryInitialized = false;
  }
  if (!config.sentryEnabled || !config.sentryDsn.trim()) return;

  Sentry.init({
    dsn: config.sentryDsn.trim(),
    enabled: true,
    beforeSend: scrubEvent,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0,
  });
  sentryInitialized = true;
}

async function loadDebugConfig(bindings: SettingsBinding[]): Promise<ShellDebugConfig> {
  const store = findDebugStore(bindings);
  if (!store) return { ...DEFAULT_SHELL_DEBUG };
  try {
    return (await store.load()) as ShellDebugConfig;
  } catch {
    return { ...DEFAULT_SHELL_DEBUG };
  }
}

export async function bootstrapSentryFromSettings(bindings: SettingsBinding[]): Promise<void> {
  try {
    applySentryConfig(await loadDebugConfig(bindings));
  } catch {
    /* skip */
  }

  window.addEventListener(DEBUG_CONFIG_CHANGED_EVENT, () => {
    void (async () => {
      applySentryConfig(await loadDebugConfig(bindings));
    })();
  });
}

export async function sendSentryTestEvent(): Promise<void> {
  Sentry.captureMessage("FreeAnima debug test", "info");
  await Sentry.flush(3000);
}

export { Sentry };
