import * as Sentry from "@sentry/react";

export async function sendSentryTestEvent(): Promise<void> {
  Sentry.captureMessage("FreeAnima debug test", "info");
  await Sentry.flush(3000);
}
