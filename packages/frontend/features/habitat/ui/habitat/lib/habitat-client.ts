/// <reference lib="dom" />
import { getTypedHabitatUiClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import { resolveApiOrigin } from "./habitat-origin.ts";
import { resolveHabitatFetch } from "./habitat-fetch.ts";

export function getHabitatRpcClient() {
  const origin = resolveApiOrigin();
  return getTypedHabitatUiClient({
    habitatUrl: origin,
    fetch: resolveHabitatFetch(),
  });
}
