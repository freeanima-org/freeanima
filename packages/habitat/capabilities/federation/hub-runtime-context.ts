import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import type { FederationHubWsDeps } from "./hub-ws-server.ts";
import { mountFederationHubWsService } from "./hub-runtime-context-service.ts";

export function bindFederationHubWsDeps(next: FederationHubWsDeps): void {
  mountFederationHubWsService(ensureProcessContext()).set(next);
}

export function getFederationHubWsDeps(): FederationHubWsDeps | null {
  return getProcessContext()?.federationHubWs?.get() ?? null;
}
