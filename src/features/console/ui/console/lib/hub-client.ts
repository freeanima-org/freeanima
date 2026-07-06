/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

import { resolveApiOrigin } from "./hub-origin.ts";
import { resolveHubFetch } from "./hub-fetch.ts";

export function getConsoleHubClient() {
  const origin = resolveApiOrigin();
  return getBundledHubClient({
    hubUrl: origin,
    profile: "console",
    fetch: resolveHubFetch() as typeof fetch,
  });
}
