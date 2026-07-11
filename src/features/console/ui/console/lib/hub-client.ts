/// <reference lib="dom" />
import { getTypedConsoleHubClient } from "@freeanima/platform/hub";

import { resolveApiOrigin } from "./hub-origin.ts";
import { resolveHubFetch } from "./hub-fetch.ts";

export function getConsoleHubClient() {
  const origin = resolveApiOrigin();
  return getTypedConsoleHubClient({
    hubUrl: origin,
    fetch: resolveHubFetch() as typeof fetch,
  });
}
