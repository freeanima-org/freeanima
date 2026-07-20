/// <reference lib="dom" />
import { getTypedConsoleHabitatClient } from "@freeanima/platform/habitat/client.ts";

import { resolveApiOrigin } from "./habitat-origin.ts";
import { resolveHabitatFetch } from "./habitat-fetch.ts";

export function getHabitatRpcClient() {
  const origin = resolveApiOrigin();
  return getTypedConsoleHabitatClient({
    habitatUrl: origin,
    fetch: resolveHabitatFetch() as typeof fetch,
  });
}
