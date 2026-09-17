import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import type { FederationHubWsDeps } from "./hub-ws-server.ts";
import { mountFederationHubWsService } from "./hub-runtime-context-service.ts";

export function bindFederationHubWsDeps(next: FederationHubWsDeps): void {
  mountFederationHubWsService(ensureRootContext()).set(next);
}

export function getFederationHubWsDeps(): FederationHubWsDeps | null {
  return getRootContextOrNull()?.federationHubWs?.get() ?? null;
}
