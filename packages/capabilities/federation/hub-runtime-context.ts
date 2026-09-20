import type { FederationHubWsDeps } from "./hub-ws-server.ts";
import {
  currentFederationHubWsService,
  ensureFederationHubWsService,
} from "./hub-runtime-context-service.ts";

export function bindFederationHubWsDeps(next: FederationHubWsDeps): void {
  ensureFederationHubWsService().set(next);
}

export function getFederationHubWsDeps(): FederationHubWsDeps | null {
  return currentFederationHubWsService()?.get() ?? null;
}
