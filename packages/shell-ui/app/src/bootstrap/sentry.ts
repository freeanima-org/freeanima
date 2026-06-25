import * as Sentry from "@sentry/react";
import { DEFAULT_SHELL_DEBUG, type ShellDebugConfig } from "@freeanima/satellite-sdk";

import {
  DEBUG_CONFIG_CHANGED_EVENT,
  loadDebugSettingsFromApi,
} from "../debug/debug-settings-api.ts";

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

export async function bootstrapSentryFromSettings(): Promise<void> {
  try {
    const config = (await loadDebugSettingsFromApi()) ?? { ...DEFAULT_SHELL_DEBUG };
    applySentryConfig(config);
  } catch {
    /* 设置 API 不可用时跳过 */
  }

  window.addEventListener(DEBUG_CONFIG_CHANGED_EVENT, () => {
    void (async () => {
      const config = (await loadDebugSettingsFromApi()) ?? { ...DEFAULT_SHELL_DEBUG };
      applySentryConfig(config);
    })();
  });
}

export async function sendSentryTestEvent(): Promise<void> {
  Sentry.captureMessage("FreeAnima debug test", "info");
  await Sentry.flush(3000);
}

export { Sentry };
